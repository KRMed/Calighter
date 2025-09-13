export function saveSetting<T = unknown>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set({ [key]: value }, () => {
                const err = chrome.runtime?.lastError;
                if (err) return reject(err);
                resolve();
            });
        } catch (e) {
            reject(e);
        }
    });
}

export function loadSetting<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get([key], (result) => {
                const err = chrome.runtime?.lastError;
                if (err) return resolve(defaultValue);
                const value = result?.[key];
                resolve((value !== undefined ? (value as T) : defaultValue));
            });
        } catch {
            resolve(defaultValue);
        }
    });
}

export const DARK_MODE_KEY = 'darkMode';
export const CALENDAR_ID_KEY = 'selectedCalendarId';

export function loadDarkModeSetting(): Promise<boolean> {
    return loadSetting<boolean>(DARK_MODE_KEY, false);
}

export function saveDarkModeSetting(enabled: boolean): Promise<void> {
    return saveSetting<boolean>(DARK_MODE_KEY, enabled);
}

export function loadPreviousCalendar(): Promise<string | null> {
    return loadSetting<string | null>(CALENDAR_ID_KEY, null);
}

export function savePreviousCalendar(id: string): Promise<void> {
    return saveSetting<string>(CALENDAR_ID_KEY, id);
}
