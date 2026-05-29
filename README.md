---
title: FileZiper
emoji: ⚡
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---
# ⚡ FileZiper ⚡

FileZiper is a complete, production-ready, high-performance Telegram Web Mini App + Telegram Bot that allows users to upload multiple files of any type, compress them into a single high-compression ZIP archive, download it instantly via a premium glassmorphic UI, or receive the ZIP binary directly in their Telegram chat.

Designed to be deployable using 100% free-tier resources (Vercel, Render/Railway, Supabase Database & Storage), memory-safe for massive uploads, and secure with a automated 1-hour automatic file expiration system.

---

## 🚀 Key Features

* **Telegram Auth Integration:** Automatically detects the Telegram user profile, name, and profile photo using the Telegram WebApp SDK.
* **Universal File Support:** Upload images, videos, audios, PDFs, APKs, documents, JSON, code, or any other binary file (max 50MB per file, up to 20 files).
* **High-Compression ZIP Engine:** Streaming compression via `archiver` with maximal compression settings (`zlib 9`), calculating live percentages and estimated remaining time.
* **Direct Bot Chat Integration:** Streams the generated ZIP directly to the user's Telegram thread using the Bot API (`sendDocument`).
* **Secure Expiry System:** Automatically purges all files from disk and Supabase Storage buckets after exactly 1 hour using a background cron manager (`node-cron`).
* **Premium Glassmorphic UI:** A state-of-the-art dark theme native to Telegram's aesthetic, built using React, Next.js 15, TailwindCSS, and Framer Motion.
* **Robust Error Handling:** Protects against browser timeouts (asynchronous zipping), network drops, invalid files, and oversized archives.

---

## 🛠️ Tech Stack & Architecture

```
                          ┌────────────────────────┐
                          │   Telegram Mini App    │
                          │   (Next.js / React)    │
                          └───────────┬────────────┘
                                      │
                         HTTPS Upload │ Long-poll Checking
                                      ▼
┌───────────────────┐     ┌────────────────────────┐     ┌───────────────────┐
│   Telegram Bot    │◄────┤    Express Backend     ├────►│ Supabase Database │
│    (Telegraf)     │     │      (Node.js)         │     │   (PostgreSQL)    │
└─────────┬─────────┘     └───────────┬────────────┘     └───────────────────┘
          │                           │
          │ Send Zip                  │ Stream Upload
          ▼                           ▼
┌───────────────────┐     ┌────────────────────────┐
│   Telegram Chat   │     │    Supabase Storage    │
│   (User Inbox)    │     │    (Signed S3 URL)     │
└───────────────────┘     └────────────────────────┘
```

* **Frontend:** Next.js 15 (App Router), React 19, TypeScript, TailwindCSS v4, Framer Motion, Canvas Confetti.
* **Backend:** Node.js, Express, Multer (disk storage for memory safety), Archiver (streaming compression).
* **Telegram Bot:** Telegraf.
* **Database & Storage:** Supabase (PostgreSQL database & private object storage bucket accessed via S3-signed temporary URLs).

---

## 📁 Repository Structure

```
FileZiper/
├── .github/
│   └── workflows/
│       └── ci.yml             # CI/CD validation workflow
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── bot.ts         # Telegram Bot setup & commands
│   │   │   └── supabase.ts    # Supabase Client connection
│   │   ├── middleware/
│   │   │   └── auth.ts        # HMAC Telegram auth signature validator
│   │   ├── routes/
│   │   │   ├── jobs.ts        # Live progress and history endpoints
│   │   │   └── upload.ts      # Multi-file uploads & background zipping
│   │   ├── services/
│   │   │   ├── cleanup.ts     # 1-hour cron file purger
│   │   │   ├── storage.ts     # Supabase Storage wrapper
│   │   │   └── zip.ts         # Archiver compression stream service
│   │   ├── types/
│   │   │   └── index.ts       # Shared backend interfaces
│   │   └── index.ts           # Server bootstrap entrypoint
│   ├── Dockerfile
│   ├── tsconfig.json
│   ├── schema.sql             # SQL DB installation script
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css    # Premium CSS design styles
│   │   │   ├── layout.tsx     # Next.js root layout with Telegram JS SDK
│   │   │   └── page.tsx       # Main Single Page App (SPA)
│   │   ├── hooks/
│   │   │   └── useTelegram.ts # Context accessor hook with Fallbacks
│   │   ├── services/
│   │   │   └── api.ts         # API integration client with Upload XHR Progress
│   │   └── types/
│   │       └── telegram.d.ts  # Typescript typing for Telegram WebApp
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml         # Dev cluster orchestrator
```

---

## 📊 Database Installation

Execute the contents of `backend/schema.sql` inside your Supabase SQL Editor. This initializes the `zip_jobs` table and applies key indexes:
```sql
CREATE INDEX idx_zip_jobs_user_id ON public.zip_jobs(user_id);
CREATE INDEX idx_zip_jobs_cleanup ON public.zip_jobs(expires_at, status) WHERE status = 'completed';
```
This optimizes history fetching and makes the background cron cleanups incredibly fast.

---

## ⚙️ Environment Configuration

### Backend Setup (`backend/.env`)
Create a `.env` file in the `backend/` directory based on `backend/.env.example`:
```env
PORT=3001
NODE_ENV=development
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_MINI_APP_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_to_bypass_rls
SUPABASE_STORAGE_BUCKET=fileziper
BYPASS_TG_AUTH=true # Set to false in production to validate signatures!
```

### Frontend Setup (`frontend/.env`)
Create a `.env` file in the `frontend/` directory based on `frontend/.env.example`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## 💻 Local Development Setup

Ensure you have Node.js (v20+) and `pnpm` installed.

### 1. Start the Backend & Bot
```bash
cd backend
pnpm install
pnpm dev
```
The server will boot on `http://localhost:3001` and the Telegram bot will start polling.

### 2. Start the Frontend Mini App
```bash
cd ../frontend
pnpm install
pnpm dev
```
Open `http://localhost:3000` in your browser. The mock interface allows you to select, upload, and track zipping progress locally.

### 3. Running with Docker
Run the entire cluster locally with one command:
```bash
docker-compose up --build
```

---

## 🤖 Telegram Bot Configuration

1. Contact [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot` and follow the instructions to get your **Bot Token**.
3. Enable inline mode or configure your commands:
   * `/start` - Launch Web App & Welcome screen
   * `/help` - Help guide
   * `/zip` - Fast App launcher
   * `/about` - App information
   * `/privacy` - Data expiry terms
4. In BotFather settings, select **Menu Button** -> **Configure Menu Button** -> Set target URL to your deployed frontend Vercel URL. This places a direct "🚀 Open FileZiper" button at the bottom-left corner of the user's bot keyboard, letting them launch the app with a single click!

---

## ☁️ Deployment Guide

### Frontend (Vercel - Free Tier)
1. Push your code to GitHub.
2. Link your repository to a new project in Vercel.
3. Configure `frontend` as the **Root Directory**.
4. Set the Framework Preset to **Next.js**.
5. Add the Environment Variable `NEXT_PUBLIC_BACKEND_URL` pointing to your deployed backend URL.
6. Click **Deploy**.

### Backend & Bot (Railway OR Render - Free Tier)
1. Link your repo to a new Web Service in Railway or Render.
2. Set `backend` as the **Root Directory**.
3. Set the build command to `pnpm build` and start command to `pnpm start`.
4. Configure all environment variables listed in the Backend Setup segment.
5. Click **Deploy**.

---

## 🔒 Security Measures

* **HMAC Signature Check:** In production, every backend endpoint checks the integrity of `window.Telegram.WebApp.initData` using a SHA-256 HMAC cryptographic token calculated from your secret `TELEGRAM_BOT_TOKEN`, preventing fake API uploads.
* **Input Sanitization:** Filenames and output ZIP names are sanitized using custom regex patterns to strip out path traversals (`../`), emojis, and special shell escape characters.
* **Disk Buffer Isolation:** Files are written directly to disk under randomized hash filenames during upload and immediately deleted as soon as the zipping task closes, guaranteeing a zero-byte trace.
* **Secure Signed URLs:** Generated ZIPs inside Supabase storage are set to private and are only readable via secure, signed S3 tokens that expire after exactly 1 hour.

---

## 📈 Scaling Guide (Memory-Safe Zipping)

Most compression nodes crash on large operations because they pull files completely into RAM. FileZiper solves this scaling bottleneck:
1. **Multi-Part Streaming:** Files are piped directly from disk read streams (`fs.createReadStream`) into the `archiver` zip stream pointer.
2. **Drained Write Streams:** The compiled zip buffer is simultaneously drained into an output write stream (`fs.createWriteStream`) to keep the RAM footprint constant at around ~35MB, regardless of whether you are zipping a 5MB or 1GB payload.
3. **Asynchronous Polling:** Rather than locking up the HTTP request thread during compression (which triggers Vercel/Render 30-second gateway timeouts), the API immediately yields a `202 Accepted` status with the `jobId`. The client transitions to a progress UI and polls `/api/jobs/:id` for state updates, preserving thread count.

---

## 👤 Author Credit

Built with ❤️ by **Yasir Ispawoo**  
🌐 [GitHub Profile](https://github.com/ispawoo)  
💻 Project Repository: `@FileZiper_bot`

