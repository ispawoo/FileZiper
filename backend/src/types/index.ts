export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface UploadedFileMetadata {
  name: string;
  size: number;
  mimeType: string;
  tempPath: string; // Path where file is temporarily stored
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ZipJob {
  id: string; // UUID
  userId: number; // Telegram User ID
  status: JobStatus;
  originalFiles: UploadedFileMetadata[];
  zipName: string;
  zipSize?: number;
  zipPath?: string; // Supabase storage path or relative URL
  downloadUrl?: string; // Signed / temporary URL
  telegramMessageId?: number;
  downloadCount: number;
  expiresAt: string; // ISO String
  createdAt: string; // ISO String
  errorMessage?: string;
}

export interface StorageConfig {
  bucket: string;
  supabaseUrl: string;
  supabaseKey: string;
}
