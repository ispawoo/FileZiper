import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
}

/**
 * Middleware to validate Telegram Web App initData
 */
export function validateTelegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // If in development mode and bypass is enabled, we can mock auth
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_TG_AUTH === 'true') {
    req.user = {
      id: Number(process.env.MOCK_USER_ID || '123456789'),
      first_name: 'Yasir',
      last_name: 'Ispawoo',
      username: 'ispawoo',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
  }

  // Header format should be: Bearer <telegram_init_data>
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Unauthorized: Invalid Authorization format.' });
  }

  const initData = parts[1];
  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized: Empty initData.' });
  }

  if (!BOT_TOKEN) {
    console.error('CRITICAL: TELEGRAM_BOT_TOKEN is not configured on the backend.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const isValid = verifyInitData(initData, BOT_TOKEN);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized: Telegram authentication failed.' });
    }

    // Extract user info from initData
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (userJson) {
      req.user = JSON.parse(userJson);
    }

    next();
  } catch (error) {
    console.error('Telegram auth verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Error parsing session.' });
  }
}

/**
 * Validates Telegram initData signature
 */
function verifyInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  // Filter out hash and sort parameters alphabetically
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      pairs.push(`${key}=${value}`);
    }
  });
  pairs.sort();

  const dataCheckString = pairs.join('\n');

  // Generate WebApp secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppsData')
    .update(botToken)
    .digest();

  // Generate validation hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}
