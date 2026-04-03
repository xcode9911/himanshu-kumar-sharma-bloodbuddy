import { NativeModules, Platform } from 'react-native';

/**
 * Robust detection of Detox environment.
 */
export const isDetoxTest = (): boolean => {
  // 1. Check for launch arguments on iOS via SettingsManager
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings;
    if (settings && (settings.isDetox === 'YES' || settings.isDetox === 'true' || settings.isDetox === true)) {
      return true;
    }
  }
  
  // 2. Check for global flag (can be set in entry point if needed)
  // @ts-ignore
  if (global.__DETOX__ || global.detox) return true;

  // 3. Heuristic: check process.env if available (sometimes set by test runners)
  // @ts-ignore
  if (typeof process !== 'undefined' && (process.env.DETOX === 'true' || process.env.NODE_ENV === 'test')) {
    return true;
  }

  return false;
};
