import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { UploadedFileMetadata } from '../types/index.js';

interface CompressionProgress {
  percentage: number;
  processedBytes: number;
  totalBytes: number;
  estimatedRemainingMs: number;
}

export function compressFiles(
  files: UploadedFileMetadata[],
  outputPath: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Ensure parent output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 1 }, // Fastest compression level for better UX
    });

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const startTime = Date.now();

    output.on('close', () => {
      const finalSize = archive.pointer();
      resolve(finalSize);
    });

    output.on('end', () => {
      console.log('Data has been drained');
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Track progress
    archive.on('progress', (data) => {
      if (onProgress && totalBytes > 0) {
        const processedBytes = data.fs.processedBytes;
        const percentage = Math.min(
          Math.round((processedBytes / totalBytes) * 100),
          99 // Reserve 100% for the actual file close event
        );
        
        const elapsedMs = Date.now() - startTime;
        const bytesPerMs = processedBytes / elapsedMs;
        const remainingBytes = totalBytes - processedBytes;
        const estimatedRemainingMs = bytesPerMs > 0 ? Math.round(remainingBytes / bytesPerMs) : 0;

        onProgress({
          percentage,
          processedBytes,
          totalBytes,
          estimatedRemainingMs,
        });
      }
    });

    archive.pipe(output);

    // Add each file to the archive
    for (const file of files) {
      if (!fs.existsSync(file.tempPath)) {
        console.error(`File does not exist: ${file.tempPath}`);
        continue;
      }
      
      // Keep folders structures if the user uploaded files inside folders
      // We can use the file.name which might contain folders (e.g. "folder/subfolder/file.png")
      archive.file(file.tempPath, { name: file.name });
    }

    // Add auto-credit text file
    const creditsText = `Thank you for using FileZiper!\n\nThis archive was securely generated using the Premium Compressor engine.\n\n📱 Telegram Bot: @FileZiper_bot\n🌐 Web App: https://fileziper.vercel.app\n\nEnjoy your compressed files!`;
    archive.append(creditsText, { name: 'FileZiper_Credits.txt' });

    archive.finalize();
  });
}
