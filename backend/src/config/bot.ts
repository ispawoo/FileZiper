import fs from 'fs';
import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://fileziper-mini-app.vercel.app';

if (MINI_APP_URL && !MINI_APP_URL.startsWith('http')) {
  MINI_APP_URL = 'https://' + MINI_APP_URL;
}

if (!BOT_TOKEN) {
  console.warn('Warning: TELEGRAM_BOT_TOKEN is missing. Telegram bot features will not work.');
}

export const bot = new Telegraf(BOT_TOKEN || 'placeholder-token');

// Commands Definitions
const getWelcomeMessage = (name: string) => `
⚡ **Welcome to FileZiper, ${name}!** ⚡

I am your ultimate file compression and archiving assistant directly inside Telegram.

**What can I do?**
1️⃣ Zip multiple files, folders, or images together.
2️⃣ Support for **ANY** file type: images, videos, docs, pdfs, apks, or code!
3️⃣ Download ZIP instantly inside the app or **receive it directly in this chat**!
4️⃣ Files automatically expire and are deleted from our servers after **1 hour** for ultimate security.

👇 Click the button below to launch the **FileZiper Mini App** and get started!
`;

bot.start((ctx) => {
  const firstName = ctx.from.first_name || 'User';
  ctx.replyWithMarkdownV2(
    escapeMarkdown(getWelcomeMessage(firstName)),
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Open FileZiper', MINI_APP_URL)],
      [Markup.button.url('🌐 View Source on GitHub', 'https://github.com/ispawoo')],
    ])
  );
});

bot.help((ctx) => {
  const helpText = `
📖 **FileZiper Help Guide** 📖

Using FileZiper is incredibly simple:

1️⃣ Press the **🚀 Open FileZiper** button in this chat.
2️⃣ Drag & drop or select multiple files of any type.
3️⃣ Click **Compress Now** to package them into one high-compression ZIP file.
4️⃣ Once generated, download it instantly or let me **send it directly** to this chat!

💡 **Commands:**
• /start - Welcome message and launch app
• /help - Display this help guide
• /zip - Launch the FileZiper Web App
• /about - Read about FileZiper
• /privacy - View our privacy policy

🔒 *All uploaded files are automatically deleted after 1 hour. We respect your privacy.*
`;
  ctx.replyWithMarkdownV2(escapeMarkdown(helpText));
});

bot.command('zip', (ctx) => {
  ctx.reply(
    'Click the button below to launch the FileZiper Web App and start zipping your files!',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Open FileZiper', MINI_APP_URL)]
    ])
  );
});

bot.command('about', (ctx) => {
  const aboutText = `
ℹ️ **About FileZiper** ℹ️

• **Brand:** FileZiper
• **Purpose:** High-performance, secure multi-file compression directly inside Telegram.
• **Version:** 1.0.0 (Production Ready)
• **Developer:** Yasir Ispawoo
• **GitHub:** https://github.com/ispawoo
• **Tech Stack:** Next.js 15, Node.js Express, Supabase Storage, Archiver, Telegraf.

Designed to be lightweight, incredibly fast, and 100% free. Built with ❤️ by Yasir Ispawoo.
`;
  ctx.replyWithMarkdownV2(escapeMarkdown(aboutText));
});

bot.command('privacy', (ctx) => {
  const privacyText = `
🔒 **Privacy Policy & Security** 🔒

FileZiper is built with security and user privacy as our top priority:

1️⃣ **No Permanent Storage:** We do not keep your files.
2️⃣ **Automatic Deletion:** All files and completed ZIPs are permanently destroyed after **1 hour** of creation using a automated cron scheduler.
3️⃣ **Secure Connections:** All file transfers are secured with SSL/TLS encryption.
4️⃣ **No Account Required:** Authenticated purely using Telegram's secure identity token.

For any questions, feel free to contact:
• GitHub: https://github.com/ispawoo
`;
  ctx.replyWithMarkdownV2(escapeMarkdown(privacyText));
});

/**
 * Sends a generated ZIP file directly to a user's Telegram chat
 */
export async function sendZipToUser(userId: number, filePath: string, fileName: string): Promise<number | null> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    console.log(`Sending ZIP file (${fileName}) to user ${userId}...`);
    const message = await bot.telegram.sendDocument(
      userId,
      { source: filePath, filename: fileName },
      {
        caption: `🎁 **Here is your compressed ZIP archive!**\n📁 File: \`${fileName}\`\n⚡ Compressed using **FileZiper**.\n\n🔒 *Will be deleted from servers in 1 hour.*`,
        parse_mode: 'Markdown',
      }
    );
    
    console.log(`Successfully sent ZIP file to Telegram user ${userId}. Message ID: ${message.message_id}`);
    return message.message_id;
  } catch (error) {
    console.error(`Failed to send ZIP file to Telegram user ${userId}:`, error);
    return null;
  }
}

/**
 * Helper to escape special MarkdownV2 characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Starts the bot in polling or webhook mode
 */
export function startTelegramBot(): void {
  bot.launch()
    .then(() => {
      console.log('Telegram Bot successfully launched and polling for commands.');
    })
    .catch((error) => {
      console.error('Error launching Telegram Bot:', error);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
