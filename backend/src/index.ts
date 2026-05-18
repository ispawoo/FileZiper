import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';
import jobsRouter from './routes/jobs.js';
import { startTelegramBot } from './config/bot.js';
import { ensureBucketExists } from './services/storage.js';
import { startCleanupCron, performCleanup } from './services/cleanup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: '*', // In production, replace with specific frontend URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Create required directories if they don't exist
const dirs = [
  path.join(process.cwd(), 'temp'),
  path.join(process.cwd(), 'temp', 'uploads'),
  path.join(process.cwd(), 'temp', 'zips')
];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created local directory: ${dir}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'FileZiper Backend is running smoothly.' });
});

// App routes
app.use('/api/upload', uploadRouter);
app.use('/api/jobs', jobsRouter);

// Start server and dependencies
async function bootstrap() {
  try {
    console.log('Initializing FileZiper Backend...');

    // 1. Ensure Supabase Storage Bucket exists
    await ensureBucketExists();

    // 2. Start Cron Cleanup Job
    startCleanupCron();
    console.log('Hourly cleanup cron job scheduled.');

    // Proactively run a cleanup at startup just in case there are orphan files
    performCleanup().catch(err => console.error('Startup cleanup failed:', err));

    // 3. Start Telegram Bot
    startTelegramBot();

    // 4. Listen on PORT
    app.listen(PORT, () => {
      console.log(`FileZiper API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap backend:', error);
    process.exit(1);
  }
}

bootstrap();
