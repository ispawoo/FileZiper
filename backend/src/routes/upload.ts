import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { AuthenticatedRequest, validateTelegramAuth } from '../middleware/auth.js';
import { compressFiles } from '../services/zip.js';
import { uploadZipToStorage, getSignedDownloadUrl } from '../services/storage.js';
import { sendZipToUser } from '../config/bot.js';
import { supabase } from '../config/supabase.js';
import { UploadedFileMetadata } from '../types/index.js';

const router = Router();

// Configure Multer for disk storage to handle large files memory-safely
const tempDir = path.join(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Sanitize and randomize filename to avoid collisions and security threats
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).readUIntLE(0, 6);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // limit individual files to 50MB
    files: 20, // limit to 20 files per zip
  },
});

/**
 * POST /api/upload
 * Accepts multiple files, initializes a zipping job, compresses them, uploads to Supabase storage, and sends via Bot.
 */
router.post('/', validateTelegramAuth, upload.array('files'), async (req: AuthenticatedRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Telegram user profile not detected.' });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded. Please upload at least one file.' });
  }

  // Generate job ID
  const jobId = crypto.randomUUID();
  const zipName = req.body.zipName ? req.body.zipName.trim() : `fileziper-${Date.now()}.zip`;
  
  // Clean zipName to prevent directory traversal
  const sanitizedZipName = zipName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const finalZipName = sanitizedZipName.endsWith('.zip') ? sanitizedZipName : `${sanitizedZipName}.zip`;

  // Parse uploaded files metadata
  const originalFiles: UploadedFileMetadata[] = files.map((file) => ({
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    tempPath: file.path,
  }));

  const totalOriginalSize = originalFiles.reduce((sum, f) => sum + f.size, 0);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiry

  try {
    // 1. Insert job into Supabase database as 'pending'
    const { error: dbError } = await supabase
      .from('zip_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        status: 'pending',
        original_files: originalFiles,
        zip_name: finalZipName,
        zip_size: 0,
        download_count: 0,
        compression_percentage: 0,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Failed to create ZIP job record:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Respond immediately with the job ID to allow the frontend to transition to progress screen
    res.status(202).json({
      success: true,
      jobId,
      message: 'Upload successful. Compression job started.',
      expiresAt,
    });

    // 2. Start compression process in background
    runBackgroundCompression(jobId, user.id, originalFiles, finalZipName, expiresAt);

  } catch (error: any) {
    console.error('Error initiating upload job:', error);
    // Cleanup any uploaded temp files on failure
    for (const file of originalFiles) {
      if (fs.existsSync(file.tempPath)) {
        fs.unlinkSync(file.tempPath);
      }
    }
    return res.status(500).json({ error: error.message || 'Failed to start compression job.' });
  }
});

/**
 * Handles the background zipping, storage uploading, and telegram bot notification
 */
async function runBackgroundCompression(
  jobId: string,
  userId: number,
  originalFiles: UploadedFileMetadata[],
  zipName: string,
  expiresAt: string
) {
  const localZipDir = path.join(process.cwd(), 'temp', 'zips');
  const localZipPath = path.join(localZipDir, `${jobId}.zip`);

  try {
    // Update DB status to 'processing'
    await supabase.from('zip_jobs').update({ status: 'processing' }).eq('id', jobId);

    // Compress files locally
    console.log(`Starting compression for job ${jobId}...`);
    const finalZipSize = await compressFiles(originalFiles, localZipPath, async (progress) => {
      // Real-time compression percentage update in database
      await supabase
        .from('zip_jobs')
        .update({ compression_percentage: progress.percentage })
        .eq('id', jobId);
    });

    console.log(`Compression complete for job ${jobId}. Final size: ${finalZipSize} bytes.`);

    // Upload ZIP to Supabase storage
    const storageFileName = `${jobId}/${zipName}`;
    console.log(`Uploading ZIP to Supabase storage: ${storageFileName}...`);
    const storagePath = await uploadZipToStorage(localZipPath, storageFileName);

    // Generate signed download URL (1 hour)
    const downloadUrl = await getSignedDownloadUrl(storagePath, 3600);

    // 3. Send ZIP directly to User's Telegram chat via Bot
    let telegramMessageId: number | null = null;
    try {
      telegramMessageId = await sendZipToUser(userId, localZipPath, zipName);
    } catch (botError) {
      console.error(`Telegram Bot was unable to send file directly to user ${userId}:`, botError);
    }

    // 4. Update job in database to 'completed'
    const { error: finalUpdateError } = await supabase
      .from('zip_jobs')
      .update({
        status: 'completed',
        zip_size: finalZipSize,
        zip_path: storagePath,
        download_url: downloadUrl,
        telegram_message_id: telegramMessageId,
        compression_percentage: 100,
      })
      .eq('id', jobId);

    if (finalUpdateError) {
      console.error(`Error finalising job ${jobId} in DB:`, finalUpdateError.message);
    }

    // 5. Cleanup local temp files
    console.log(`Cleaning up local temporary files for job ${jobId}...`);
    
    // Clean original files
    for (const file of originalFiles) {
      if (fs.existsSync(file.tempPath)) {
        fs.unlinkSync(file.tempPath);
      }
    }
    
    // Clean local generated ZIP file
    if (fs.existsSync(localZipPath)) {
      fs.unlinkSync(localZipPath);
    }

    console.log(`Job ${jobId} finished and local storage cleared.`);

  } catch (err: any) {
    console.error(`Error in background zipping job ${jobId}:`, err);
    
    // Update job to failed
    await supabase
      .from('zip_jobs')
      .update({
        status: 'failed',
        error_message: err.message || 'An unknown error occurred during compression.',
      })
      .eq('id', jobId);

    // Cleanup local files
    for (const file of originalFiles) {
      if (fs.existsSync(file.tempPath)) {
        fs.unlinkSync(file.tempPath);
      }
    }
    if (fs.existsSync(localZipPath)) {
      fs.unlinkSync(localZipPath);
    }
  }
}

export default router;
