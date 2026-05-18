import { useEffect, useState } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [platform, setPlatform] = useState<string>('browser');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Let Telegram know the Mini App is ready to be shown
      tg.ready();
      // Expand the webapp to full height
      tg.expand();

      setWebApp(tg);
      setInitData(tg.initData || '');
      setPlatform(tg.platform || 'browser');
      
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      } else if (process.env.NODE_ENV === 'development') {
        // Fallback for local browser testing
        setUser({
          id: 123456789,
          first_name: 'Yasir',
          last_name: 'Ispawoo',
          username: 'ispawoo',
          is_premium: true,
        });
      }
    }
  }, []);

  const triggerHaptic = (type: 'success' | 'error' | 'warning' = 'success') => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.notificationOccurred(type);
    }
  };

  const showAlert = (message: string, callback?: () => void) => {
    if (webApp) {
      webApp.showAlert(message, callback);
    } else {
      alert(message);
      if (callback) callback();
    }
  };

  const showConfirm = (message: string, callback: (confirmed: boolean) => void) => {
    if (webApp) {
      webApp.showConfirm(message, callback);
    } else {
      const confirmed = window.confirm(message);
      callback(confirmed);
    }
  };

  const closeApp = () => {
    if (webApp) {
      webApp.close();
    }
  };

  // Mocked Auth token for Dev mode testing
  const getAuthHeader = () => {
    if (initData) {
      return `Bearer ${initData}`;
    }
    // In local dev without TG shell, send mock validation params
    if (process.env.NODE_ENV === 'development') {
      return 'Bearer query_id=dev&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Yasir%22%2C%22last_name%22%3A%22Ispawoo%22%2C%22username%22%3A%22ispawoo%22%7D&hash=mock';
    }
    return '';
  };

  return {
    webApp,
    user,
    initData,
    platform,
    triggerHaptic,
    showAlert,
    showConfirm,
    closeApp,
    getAuthHeader,
    isInTelegram: !!webApp && platform !== 'browser',
  };
}
export default useTelegram;
