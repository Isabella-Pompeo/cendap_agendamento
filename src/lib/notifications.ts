export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported'
  | 'ios-install-required';

export const APPOINTMENT_NOTIFICATIONS_KEY = 'cendapAppointmentNotificationsEnabled';

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isIOSLikeDevice() {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const hasTouch = window.navigator.maxTouchPoints > 1;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && hasTouch);
}

export function isStandaloneWebApp() {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return Boolean(
    navigatorWithStandalone.standalone ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function getAppointmentNotificationsEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(APPOINTMENT_NOTIFICATIONS_KEY) === 'true';
}

export function setAppointmentNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APPOINTMENT_NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined') return 'unsupported';
  if ('Notification' in window) return Notification.permission;
  if (isIOSLikeDevice() && !isStandaloneWebApp()) return 'ios-install-required';
  return 'unsupported';
}

export async function registerNotificationServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register('/notification-sw.js');
  } catch (error) {
    console.warn('Service worker de notificacao nao registrado:', error);
    return null;
  }
}

export async function requestAppointmentNotificationPermission(): Promise<BrowserNotificationPermission> {
  const currentPermission = getBrowserNotificationPermission();

  if (currentPermission !== 'default') {
    if (currentPermission === 'granted') {
      await registerNotificationServiceWorker();
      setAppointmentNotificationsEnabled(true);
    }

    return currentPermission;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return currentPermission;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerNotificationServiceWorker();
      setAppointmentNotificationsEnabled(true);
    }
    return permission;
  } catch {
    return getBrowserNotificationPermission();
  }
}
