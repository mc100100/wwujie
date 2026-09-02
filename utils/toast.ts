
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastEvent {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toast: ToastEvent) => void;

class ToastManager {
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(message: string, type: ToastType = 'info', duration = 3000) {
    const event: ToastEvent = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      type,
      duration
    };
    this.listeners.forEach(listener => listener(event));
  }

  success(msg: string, duration?: number) { this.notify(msg, 'success', duration); }
  error(msg: string, duration?: number) { this.notify(msg, 'error', duration); }
  info(msg: string, duration?: number) { this.notify(msg, 'info', duration); }
  warning(msg: string, duration?: number) { this.notify(msg, 'warning', duration); }
}

export const toast = new ToastManager();
