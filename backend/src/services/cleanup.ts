import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { supabase } from '../config/supabase.js';
import { deleteFromStorage } from './storage.js';

/**
 * Cleanup job that runs every hour to delete expired ZIPs from Storage and local temporary files
 */
export function startCleanupCron(): void {
  // Cron schedule: Run at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running hourly cleanup job...');
    await performCleanup();
  });
}

/**
 * Performs the cleanup of expired files
 */
export async function performCleanup(): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Query database for jobs that have expired, are completed, and are not yet marked as expired
    const { data: expiredJobs, error } = await supabase
      .from('zip_jobs')
      .select('*')
      .lt('expires_at', now)
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching expired jobs:', error);
      return;
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      console.log('No expired jobs found.');
      return;
    }

    console.log(`Found ${expiredJobs.length} expired jobs to clean up.`);

    for (const job of expiredJobs) {
      // 1. Delete zip file from Supabase Storage
      if (job.zip_path) {
        try {
          await deleteFromStorage(job.zip_path);
        } catch (storageError: any) {
          console.error(`Failed to delete storage file for job ${job.id}:`, storageError.message);
        }
      }

      // 2. Delete local temp files if they still exist
      if (job.original_files && Array.isArray(job.original_files)) {
        for (const file of job.original_files) {
          if (file.tempPath && fs.existsSync(file.tempPath)) {
            try {
              fs.unlinkSync(file.tempPath);
              console.log(`Deleted local temp file: ${file.tempPath}`);
            } catch (fsError: any) {
              console.error(`Failed to delete local temp file ${file.tempPath}:`, fsError.message);
            }
          }
        }
      }

      // Also try to delete any local ZIP file at the same ID (if any remains)
      const localZipDir = path.join(process.cwd(), 'temp', 'zips');
      const localZipPath = path.join(localZipDir, `${job.id}.zip`);
      if (fs.existsSync(localZipPath)) {
        try {
          fs.unlinkSync(localZipPath);
          console.log(`Deleted local temp zip: ${localZipPath}`);
        } catch (fsError: any) {
          console.error(`Failed to delete local temp zip ${localZipPath}:`, fsError.message);
        }
      }

      // 3. Update database record status to 'expired' and clear zip path
      const { error: updateError } = await supabase
        .from('zip_jobs')
        .update({
          status: 'expired',
          zip_path: null,
          download_url: null,
        })
        .eq('id', job.id);

      if (updateError) {
        console.error(`Failed to update status to expired for job ${job.id}:`, updateError.message);
      } else {
        console.log(`Job ${job.id} marked as expired in database.`);
      }
    }

    console.log('Cleanup job finished.');
  } catch (error) {
    console.error('Cleanup execution failed:', error);
  }
}
