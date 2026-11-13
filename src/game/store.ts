import { create } from 'zustand';
import { advance, begin, busy, decay, interact, petPosition, reactToUpgrade, restInBed, type Progress } from './behavior';
import { finished } from './animation';
import { initial } from './balance';
import { autonomy, seededRandom, type Activity } from './autonomy';
import { habits } from './personality';
import { readProgress, saveKey, saveProgress, withSaveLock } from './save';
import { purchaseUpgrade, type UpgradeId } from './upgrades';

const started = Date.now();
const progress = decay(readProgress(started) ?? { ...initial, savedAt: started }, started);
let random = () => Math.random();

export const useGame = create(() => ({
  pet: begin(started, progress.friendship > 0),
  progress,
  pendingUpgrades: [] as UpgradeId[],
  care(action: 'pet' | 'feed' | 'toy', mouse?: number) {
    return transact((current, now) => {
      const { pet } = useGame.getState();
      commit(current, interact(pet, decay(current, now), action, now, random, mouse));
    });
  },
  tidy() {
    return transact(current => {
      if (current.tipped) commit(current, { progress: { ...current, tipped: false } });
    });
  },
  toggleLamp() {
    return transact(current => commit(current, { progress: { ...current, lampOn: !current.lampOn } }));
  },
  buy(id: UpgradeId) {
    return transact(current => {
      const result = purchaseUpgrade(current, id);
      if (result.status === 'bought') {
        commit(current, { progress: result.progress, pendingUpgrades: [...useGame.getState().pendingUpgrades, id] });
      }
      return result;
    });
  },
  showUpgrade() {
    const { pet, pendingUpgrades } = useGame.getState();
    if (!pendingUpgrades.length) return;
    const next = reactToUpgrade(pet, pendingUpgrades[0], Date.now());
    if (next !== pet) useGame.setState({ pet: next, pendingUpgrades: pendingUpgrades.slice(1) });
  },
  rest() {
    const { pet, progress } = useGame.getState();
    const next = restInBed(pet, progress, Date.now());
    if (next !== pet) useGame.setState({ pet: next });
  },
  tick() {
    if (document.hidden) return;
    const { pet, progress } = useGame.getState();
    const now = Date.now();
    const impactDue = pet.animation.animationId === 'mischief' && !pet.bowlImpact &&
      now >= pet.animation.started + pet.animation.duration / 2;
    if (!impactDue && !finished(pet.animation, now) && decay(progress, now) === progress) return;
    return transact((current, time) => {
      if (document.hidden) return;
      commit(current, advance(useGame.getState().pet, decay(current, time), time, random));
    });
  },
}));

type Patch = Partial<Pick<ReturnType<typeof useGame.getState>, 'pet' | 'progress' | 'pendingUpgrades'>>;
function transact<T>(run: (current: Progress, now: number) => T): Promise<T> {
  return withSaveLock(() => {
    const now = Date.now();
    return run(readProgress(now) ?? useGame.getState().progress, now);
  });
}

function commit(current: Progress, patch: Patch) {
  const { progress } = patch;
  if (progress && progress !== current) saveProgress(progress);
  useGame.setState({ ...patch, progress: progress ?? current });
}


const listeners = new AbortController();
window.addEventListener('storage', event => {
  if (event.key !== saveKey) return;
  const current = readProgress(Date.now());
  if (current) useGame.setState({ progress: current });
}, { signal: listeners.signal });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  void transact((current, now) => {
    const { pet } = useGame.getState();
    const updated = decay(current, now);
    const preserve = busy(pet) || pet.animation.animationId === 'sleep';
    if (preserve) commit(current, advance(pet, updated, now, random));
    else commit(current, { progress: updated, pet: { ...pet, animation: begin(now, true).animation, motion: undefined, x: petPosition(pet, now).x,
      destination: pet.motion ? 'idle' : pet.destination, scene: undefined, attention: undefined, upgradeReaction: undefined } });
  });
}, { signal: listeners.signal });

if (import.meta.env.DEV) {
  Object.assign(window, {
    meikuDebug: {
      seed(value: number) { random = seededRandom(value); },
      state: () => useGame.getState(),
      scene: (action: Activity) => {
        const { pet, progress } = useGame.getState();
        if (busy(pet) || pet.animation.animationId === 'sleep' || pet.upgradeReaction) return false;
        const now = Date.now();
        const idle = begin(now, true);
        const fixture = {
          ...pet, history: [], motion: undefined, inBox: false, destination: idle.destination,
          lastMischief: now - autonomy.cooldown.mischief, lastBoxTour: now - habits.boxTourCooldown,
          animation: { ...idle.animation, started: now - idle.animation.duration },
        };
        const result = advance(fixture, progress, now, random, action);
        if (result.pet.scene !== action) return false;
        useGame.setState({ pet: { ...result.pet,
          lastMischief: pet.lastMischief, lastBoxTour: action === 'boxTour' ? now : pet.lastBoxTour } });
        return true;
      },
    },
  });
}
import.meta.hot?.dispose(() => listeners.abort());
