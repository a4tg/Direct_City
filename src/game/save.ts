import { initial } from './balance';
import type { Progress } from './behavior';

export let saveKey = 'meiku-world';
export function setSaveScope(key: string) { saveKey = key; }

export function readProgress(now: number): Progress | undefined {
  try {
    const raw = localStorage.getItem(saveKey);
    if (!raw) return;
    const { state, version } = JSON.parse(raw);
    if (!state || (version !== 0 && version !== 1 && version !== undefined)) return;
    return { ...initial, ...state, ownedUpgrades: state.ownedUpgrades ?? {},
      savedAt: version === 1 ? state.savedAt ?? now : now };
  } catch {
    return;
  }
}

export function saveProgress(progress: Progress) {
  localStorage.setItem(saveKey, JSON.stringify({ state: progress, version: 1 }));
}

export function withSaveLock<T>(run: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(saveKey, run) : Promise.resolve().then(run);
}

