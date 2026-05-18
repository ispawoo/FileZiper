-- =========================================================================
-- FILEZIPPER SUPABASE DATABASE SCHEMA
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create zip_jobs table to track file compression details
CREATE TABLE IF NOT EXISTS public.zip_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,                  -- Telegram user ID (BIGINT is required as TG IDs exceed standard INT)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'expired'
    original_files JSONB NOT NULL,             -- Array of metadata objects: name, size, mimeType, tempPath
    zip_name VARCHAR(255) NOT NULL,            -- Sanitized name of the output ZIP archive
    zip_size BIGINT DEFAULT 0,                 -- Final file size of the generated ZIP in bytes
    zip_path VARCHAR(255),                     -- Remote path inside Supabase Storage bucket
    download_url TEXT,                         -- Current temporary signed URL for downloading
    telegram_message_id BIGINT,                -- ID of the bot message sending the ZIP to user chat
    compression_percentage INTEGER DEFAULT 0,  -- Live compression progress indicator (0 to 100)
    error_message TEXT,                        -- Detailed error logs in case of compression failures
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Date and time when files are scheduled to expire (1 hour after creation)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Record insertion timestamp
);

-- =========================================================================
-- DATABASE INDEXES & OPTIMIZATIONS
-- =========================================================================

-- Index by user_id to speed up history lookups for the user dashboard
CREATE INDEX IF NOT EXISTS idx_zip_jobs_user_id ON public.zip_jobs(user_id);

-- Composite index to speed up background cleanup cron queries
CREATE INDEX IF NOT EXISTS idx_zip_jobs_cleanup ON public.zip_jobs(expires_at, status) 
WHERE status = 'completed';

-- Enable Row Level Security (RLS) on the table
ALTER TABLE public.zip_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions from service role key (for backend operations)
CREATE POLICY "Allow service role full access" 
ON public.zip_jobs 
USING (true) 
WITH CHECK (true);
