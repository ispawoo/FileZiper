import { Router, Response } from 'express';
import { AuthenticatedRequest, validateTelegramAuth } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/jobs/history
 * Retrieves the history of zip jobs created by the authenticated Telegram user
 */
router.get('/history', validateTelegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Telegram profile not detected.' });
  }

  try {
    const { data: jobs, error } = await supabase
      .from('zip_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to query user job history:', error);
      return res.status(500).json({ error: 'Database query failed.' });
    }

    // Compute metrics
    const totalJobs = jobs ? jobs.length : 0;
    const completedJobs = jobs ? jobs.filter((j) => j.status === 'completed') : [];
    const totalFilesCompressed = completedJobs.reduce((sum, j) => {
      return sum + (Array.isArray(j.original_files) ? j.original_files.length : 0);
    }, 0);
    const totalStorageUsed = completedJobs.reduce((sum, j) => sum + (Number(j.zip_size) || 0), 0);

    return res.status(200).json({
      success: true,
      jobs: jobs || [],
      metrics: {
        totalJobs,
        totalFilesCompressed,
        totalStorageUsed,
      },
    });
  } catch (error) {
    console.error('Error fetching job history:', error);
    return res.status(500).json({ error: 'Failed to retrieve job history.' });
  }
});

/**
 * GET /api/jobs/:id
 * Retrieves the live status of a single zip job by UUID
 */
router.get('/:id', validateTelegramAuth, async (req: AuthenticatedRequest, res: Response) => {
  const jobId = req.params.id;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Telegram profile not detected.' });
  }

  try {
    const { data: job, error } = await supabase
      .from('zip_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error(`Error querying job status for ${jobId}:`, error);
      return res.status(404).json({ error: 'Zip job not found.' });
    }

    // Verify ownership
    if (Number(job.user_id) !== user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this zip job.' });
    }

    // If job is completed and download URL is requested, check if we need to refresh the signed URL
    // (since it might expire in 1 hour).
    let downloadUrl = job.download_url;
    const expiresAt = new Date(job.expires_at).getTime();
    const now = Date.now();

    if (job.status === 'completed' && expiresAt < now) {
      // Job is expired
      return res.status(200).json({
        success: true,
        job: {
          ...job,
          status: 'expired',
          download_url: null,
          zip_path: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      job: {
        ...job,
        download_url: downloadUrl,
      },
    });
  } catch (error) {
    console.error('Error querying job details:', error);
    return res.status(500).json({ error: 'Failed to query job status.' });
  }
});

export default router;
