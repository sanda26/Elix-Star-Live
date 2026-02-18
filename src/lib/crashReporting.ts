import { IS_STORE_BUILD } from '../config/build';

class CrashReportingService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Only initialize in store builds or when explicitly enabled
      if (IS_STORE_BUILD || import.meta.env.VITE_ENABLE_CRASH_REPORTING === 'true') {
        // Firebase Crashlytics will be initialized natively
        // For web, we'll use a simple error logging system
        this.isInitialized = true;
        console.log('Crash reporting initialized');
      }
    } catch (error) {
      console.warn('Failed to initialize crash reporting:', error);
    }
  }

  async logError(error: Error, context?: Record<string, any>) {
    if (!this.isInitialized) return;

    try {
      // Log to console for now - in native builds, this will use Crashlytics
      console.error('Crash Report:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context,
      });

      // In native builds, Crashlytics will automatically capture unhandled errors
    } catch (err) {
      console.warn('Failed to log error:', err);
    }
  }

  async logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (!this.isInitialized) return;

    try {
      console.log('[' + level.toUpperCase() + '] ' + message);
    } catch (err) {
      console.warn('Failed to log message:', err);
    }
  }

  async setUserIdentifier(userId: string) {
    if (!this.isInitialized) return;

    try {
      console.log('User ID set for crash reporting:', userId);
    } catch (err) {
      console.warn('Failed to set user identifier:', err);
    }
  }

  async setCustomKey(key: string, value: string) {
    if (!this.isInitialized) return;

    try {
      console.log('Custom key set:', key, value);
    } catch (err) {
      console.warn('Failed to set custom key:', err);
    }
  }
}

export const crashReporting = new CrashReportingService();