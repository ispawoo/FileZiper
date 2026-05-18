const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface UploadResponse {
  success: boolean;
  jobId: string;
  expiresAt: string;
  message: string;
}

export interface JobStatusResponse {
  success: boolean;
  job: {
    id: string;
    user_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
    original_files: Array<{ name: string; size: number; mimeType: string }>;
    zip_name: string;
    zip_size?: number;
    download_url?: string;
    compression_percentage: number;
    expires_at: string;
    created_at: string;
    error_message?: string;
  };
}

export interface HistoryResponse {
  success: boolean;
  jobs: Array<{
    id: string;
    user_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
    original_files: Array<{ name: string; size: number; mimeType: string }>;
    zip_name: string;
    zip_size: number;
    download_url?: string;
    compression_percentage: number;
    expires_at: string;
    created_at: string;
  }>;
  metrics: {
    totalJobs: number;
    totalFilesCompressed: number;
    totalStorageUsed: number;
  };
}

/**
 * Uploads multiple files to the backend with progress tracking
 */
export function uploadFiles(
  files: File[],
  zipName: string,
  authHeader: string,
  onProgress: (percentage: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // Append files to form data
    files.forEach((file) => {
      formData.append('files', file);
    });

    if (zipName) {
      formData.append('zipName', zipName);
    }

    xhr.open('POST', `${BACKEND_URL}/api/upload`);
    
    // Set headers
    if (authHeader) {
      xhr.setRequestHeader('Authorization', authHeader);
    }

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response as UploadResponse);
        } catch (e) {
          reject(new Error('Invalid response from upload server.'));
        }
      } else {
        try {
          const errResponse = JSON.parse(xhr.responseText);
          reject(new Error(errResponse.error || `Upload failed with status ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Please check your connection.'));
    };

    xhr.send(formData);
  });
}

/**
 * Fetches the live status of a zip job
 */
export async function getJobStatus(jobId: string, authHeader: string): Promise<JobStatusResponse> {
  const headers: HeadersInit = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch status: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches the user history and compression metrics
 */
export async function getHistory(authHeader: string): Promise<HistoryResponse> {
  const headers: HeadersInit = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const res = await fetch(`${BACKEND_URL}/api/jobs/history`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch history: ${res.status}`);
  }

  return res.json();
}
