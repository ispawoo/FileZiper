import fs from 'fs';
import { supabase } from '../config/supabase.js';

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'fileziper';

/**
 * Ensures that the bucket exists and is public/private as required
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      console.log(`Bucket '${BUCKET_NAME}' does not exist. Creating...`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // We want files to be private and accessed via Signed URLs!
        fileSizeLimit: 104857600, // 100MB free limit
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log(`Bucket '${BUCKET_NAME}' created successfully.`);
      }
    }
  } catch (error) {
    console.error('Failed to ensure bucket exists:', error);
  }
}

/**
 * Uploads a local file to Supabase Storage
 */
export async function uploadZipToStorage(localFilePath: string, storageFileName: string): Promise<string> {
  // Ensure the bucket exists first
  await ensureBucketExists();

  const fileStream = fs.createReadStream(localFilePath);
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storageFileName, fileStream, {
      contentType: 'application/zip',
      duplex: 'drain',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return data.path;
}

/**
 * Generates a signed temporary URL for downloading a file
 */
export async function getSignedDownloadUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete ${storagePath} from Supabase Storage:`, error.message);
  } else {
    console.log(`Deleted ${storagePath} from Supabase Storage.`);
  }
}
