import { initial, petRewardLimit, room, timing } from './balance.js';
import { autonomy, decide, type Activity } from './autonomy.js';
import { attentionOdds, habits, meiku } from './personality.js';
import type { UpgradeId } from './upgrades.js';
import { finished, startClip, visualClips, visualFrame, type Playback } from './animation.js';

export type Progress = typeof initial;
type State = 'observe' | 'toyInspect' | 'innocent' | 'explore' | 'inspect' | 'rest' | 'sad' | 'idle' | 'walk' | 'sit' | 'sleep' | 'groom' | 'eat' | 'happy' | 'annoyed' | 'play' | 'mischief';
type Destination = 'toyInspect' | 'explore' | 'inspect' | 'rest' | 'bedRest' | 'bed' | 'happy' | 'idle' | 'eat' | 'play' | 'sleep' | 'mischief' | 'annoyed';
export type Behavior = {
  animation: Playback<State>;
  x: number;
  inBox: boolean;
  mouse: number;
  destination: Destination;
  lastRefusal: number;
  lastMischief: number;
  lastBoxTour?: number;
  scene?: Activity;
  attention?: 'happy' | 'neutral' | 'annoyed';
  attentionHistory?: ('happy' | 'neutral' | 'annoyed')[];
  resumeAfterRefusal?: Behavior;
  history?: (ReturnType<typeof decide> & { at: number; x: number })[];
  durationOnArrival?: number;
  bowlImpact?: boolean;
  upgradeReaction?: UpgradeId;
  motion?: { fromX: number; fromY: number; toY: number };
};

export const reactions: Record<State, string> = {
  observe: 'Мэйку смотрит на тебя. Возможно, оценивает.',
  toyInspect: 'Мэйку обнаружил подозрительного грызуна.',
  innocent: 'Миска упала сама. Мэйку свидетель.',
  explore: 'Мэйку оглядывается по сторонам.',
  inspect: 'Мэйку принюхивается. Он тут просто проходил.',
  rest: 'Мэйку устроился поудобнее и отдыхает.',
  sad: 'Мэйку робко выглядывает из коробки.',
  idle: 'Мэйку осматривает комнату.',
  walk: 'Топ-топ… Мэйку куда-то собрался.',
  sit: 'Мэйку присел и навострил уши.',
  sleep: 'Мэйку дремлет в коробке.',
  groom: 'Мэйку умывается.',
  eat: 'Хрум-хрум! Мэйку ест.',
  happy: 'Мур-р-р… Мэйку щурится от удовольствия!',
  annoyed: 'Мэйку отвернулся. У него важные кошачьи дела.',
  play: 'Мэйку подкрался к мышке!',
  mischief: 'Ой! Мэйку опрокинул миску.',
};

function enter(state: State, now: number, priority = 0, active?: Playback<State>, durationOverride?: number) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = durationOverride ?? (state === 'observe' ? habits.observeDuration : state === 'toyInspect' ? habits.toyInspectDuration : state === 'innocent' ? habits.innocenceDuration : state === 'sad' ? timing.intro : state === 'inspect' || state === 'explore' || state === 'rest' ? autonomy[state][0] : timing[state]);
  return startClip(active, {
    animationId: state,
    duration: reduced && ['walk', 'eat', 'groom', 'mischief'].includes(state) ? duration / 2 : duration,
    reduced,
    loop: ['idle', 'walk', 'sleep', 'groom', 'eat', 'play'].includes(state),
    priority,
    interruptible: state !== 'eat',
  }, now);
}

export function begin(now: number, returning = false): Behavior {
  return {
    animation: enter(returning ? 'idle' : 'sad', now), x: room.box, inBox: true,
    mouse: room.mouse, lastBoxTour: now, destination: 'idle', lastRefusal: -Infinity, lastMischief: now,
  };
}

export const spareBoxX = 17;
export const floorY = 85;
export const shelterY = 77;

export function inShelter(pet: Behavior) {
  return pet.inBox || ((pet.destination === 'bed' || pet.destination === 'bedRest') && !pet.motion);
}

export function petPosition(pet: Behavior, now: number) {
  if (!pet.motion) return { x: pet.x, y: inShelter(pet) ? shelterY : floorY };
  const fraction = Math.min(1, Math.max(0, (now - pet.animation.started) / pet.animation.duration));
  const eased = fraction * fraction * (3 - 2 * fraction);
  const { fromX, fromY, toY } = pet.motion;
  return { x: fromX + (pet.x - fromX) * eased, y: fromY + (toY - fromY) * eased };
}

function stopMotion(pet: Behavior, now: number): Behavior {
  return pet.motion ? { ...pet, x: petPosition(pet, now).x, motion: undefined, destination: 'idle' } : pet;
}

function walk(pet: Behavior, x: number, destination: Destination, now: number, priority = 0, duration?: number): Behavior {
  const animation = enter('walk', now, priority, pet.animation, duration);
  if (animation === pet.animation) return pet;
  const from = petPosition(pet, now);
  const toY = ['sleep','bed','rest','bedRest'].includes(destination) ? shelterY : floorY;
  return { ...pet, animation, x, inBox: false, destination, upgradeReaction: undefined, attention: undefined, scene: undefined,
    durationOnArrival: undefined, motion: { fromX: from.x, fromY: from.y, toY } };
}

export function decay(progress: Progress, now: number): Progress {
  if (!progress.savedAt || now < progress.savedAt) return { ...progress, savedAt: now };
  const minutes = 3 * Math.min(20, Math.floor((now - progress.savedAt) / timing.needsInterval));
  if (!minutes) return progress;
  return {
    ...progress,
    savedAt: now - (now - progress.savedAt) % timing.needsInterval,
    fullness: Math.min(progress.fullness, Math.max(20, progress.fullness - Math.ceil(minutes / 3))),
    energy: Math.min(progress.energy, Math.max(25, progress.energy - Math.ceil(minutes / 2))),
    mood: Math.min(progress.mood, Math.max(25, progress.mood - Math.ceil(minutes / 4))),
  };
}

export function busy(pet: Behavior) {
  const { animationId, priority } = pet.animation;
  return animationId === 'eat' || animationId === 'mischief' || animationId === 'annoyed' || (animationId === 'walk' && priority >= 2);
}

export function advance(pet: Behavior, progress: Progress, now: number, random: () => number, forced?: Activity): { pet: Behavior; progress: Progress } {
  if (pet.animation.animationId === 'mischief' && !pet.bowlImpact &&
      visualFrame(visualClips.mischief, pet.animation, now) >= visualClips.mischief.impactFrame) {
    pet = { ...pet, bowlImpact: true };
    if (!progress.tipped) progress = { ...progress, tipped: true };
  }
  if (!finished(pet.animation, now)) return { pet, progress };
  pet.animation.onComplete?.();
  const state = pet.animation.animationId;
  if (state === 'walk') {
    const destination = pet.destination === 'mischief' && progress.tipped ? 'idle' : pet.destination;
    return {
      pet: {
        ...pet, animation: enter(destination === 'bed' ? 'sleep' : destination === 'bedRest' ? 'rest' : destination, now, pet.animation.priority, undefined, destination === 'toyInspect' ? undefined : pet.durationOnArrival),
        destination,
        inBox: destination === 'sleep' || destination === 'rest',
        durationOnArrival: undefined,
        motion: undefined,
        bowlImpact: false,
        lastMischief: destination === 'mischief' ? now : pet.lastMischief,
      },
      progress,
    };
  }
  if (state === 'annoyed' && pet.resumeAfterRefusal) {
    const resumed = pet.resumeAfterRefusal;
    return { pet: { ...resumed, attentionHistory: pet.attentionHistory, lastRefusal: pet.lastRefusal,
      animation: { ...resumed.animation, started: resumed.animation.started + now - pet.animation.started } }, progress };
  }
  if (state === 'toyInspect') {
    return { pet: { ...pet, animation: enter('play', now, 0, undefined, pet.durationOnArrival) }, progress };
  }
  if (state === 'rest' && pet.scene === 'boxTour' && pet.destination === 'bedRest') {
    return { pet: { ...walk(pet, spareBoxX, 'rest', now, 0, autonomy.walk[0]),
      scene: 'boxTour', durationOnArrival: habits.boxRestDuration }, progress };
  }
  if (state === 'inspect') {
    const target = autonomy.points.find(x => x < pet.x - 15) ?? room.box;
    return { pet: walk(pet, target, 'idle', now, 0, autonomy.walk[0]), progress };
  }
  if (state === 'mischief') return { pet: { ...pet, animation: enter('innocent', now) }, progress };
  if (state === 'eat' || state === 'sleep' || state === 'play') {
    if (state === 'sleep') progress = { ...progress, energy: Math.min(100, progress.energy + 16) };
    if (state === 'play') progress = { ...progress, energy: Math.max(25, progress.energy - 7), mood: Math.min(100, progress.mood + 3) };
    return { pet: { ...pet, attention: undefined, scene: undefined, animation: enter(state === 'eat' ? 'happy' : 'idle', now) }, progress };
  }
  if (state !== 'idle') return { pet: { ...pet, animation: enter('idle', now, 0, undefined, between(autonomy.idle, random)), upgradeReaction: undefined, attention: undefined, scene: undefined }, progress };
  const history = pet.history ?? [];
  const decision = decide({ ...progress, mouse: pet.mouse, lastMischief: pet.lastMischief,
    hasBed: !!progress.ownedUpgrades.cat_bed, lastBoxTour: pet.lastBoxTour }, history, now, random, forced);
  const { action } = decision;
  const picks = autonomy.points.filter(x => Math.abs(x - pet.x) >= 10 &&
    !history.slice(-2).some(item => item.action === 'explore' && item.x === x));
  const bed = !!progress.ownedUpgrades.cat_bed && (action === 'sleep' || action === 'rest') && random() >= meiku.boxAttachment;
  const x = action === 'explore' ? picks[Math.floor(random() * picks.length)] ?? pet.x
    : action === 'inspect' || action === 'mischief' ? room.bowl - 13
    : action === 'play' ? mouseTarget(pet.mouse)
    : action === 'boxTour' ? room.box
    : action === 'rest' || action === 'sleep' ? bed || !progress.ownedUpgrades.cat_bed ? room.box : spareBoxX : pet.x;
  const recent = [...history, { ...decision, at: now, x }].slice(-5);
  if (action === 'idle' || action === 'groom' || action === 'observe') {
    return { pet: { ...pet, history: recent, scene: action, attention: undefined, animation: enter(action, now, 0, undefined,
      action === 'idle' ? between(autonomy.idle, random) : undefined) }, progress };
  }
  const destination = action === 'boxTour' ? 'bedRest' : action === 'play' ? 'toyInspect'
    : bed ? action === 'sleep' ? 'bed' : 'bedRest' : action;
  const distance = Math.abs(x - pet.x) / (room.max - room.min);
  const duration = autonomy.walk[0] + Math.min(1, distance) * (autonomy.walk[1] - autonomy.walk[0]);
  const durationOnArrival = action === 'boxTour' ? habits.bedTrialDuration : action === 'inspect' || action === 'explore' || action === 'play' || action === 'rest'
    ? between(autonomy[action], random) : undefined;
  return { pet: { ...walk(pet, x, destination, now, 0, duration), history: recent, durationOnArrival, scene: action,
    lastBoxTour: action === 'boxTour' ? now : pet.lastBoxTour }, progress };
}

function between([min, max]: readonly [number, number], random: () => number) {
  return min + random() * (max - min);
}

function mouseTarget(x: number) {
  return x + (x < 50 ? 11 : -11);
}

export function interact(pet: Behavior, progress: Progress, action: 'pet' | 'feed' | 'toy', now: number, random: () => number, mouse = pet.mouse): { pet: Behavior; progress: Progress } {
  if (busy(pet)) return { pet, progress };
  if (action === 'toy') {
    const moved = Math.min(room.max, Math.max(room.min, mouse));
    return { pet: { ...walk(pet, mouseTarget(moved), 'play', now, 1), mouse: moved }, progress };
  }
  const feeding = action === 'feed';
  if (feeding && (!progress.food || progress.fullness >= 100 || progress.tipped)) return { pet, progress };
  if (feeding && now - progress.lastCare < timing.reward) return { pet, progress };
  const mayRefuse = now - pet.lastRefusal >= timing.refusalRetry;
  const odds = attentionOdds(progress.friendship, progress.energy, progress.fullness, progress.mood);
  const response = feeding ? 1 : random();
  if (!feeding && mayRefuse && (pet.animation.animationId === 'sleep' ||
      (progress.friendship > 0 && response < odds.refusal))) {
    return {
      pet: { ...stopMotion(pet, now), upgradeReaction: undefined, attention: 'annoyed' as const,
        attentionHistory: [...pet.attentionHistory ?? [], 'annoyed' as const].slice(-5),
        resumeAfterRefusal: { ...pet, attention: undefined, resumeAfterRefusal: undefined },
        animation: enter('annoyed', now, 1, pet.animation), lastRefusal: now },
      progress,
    };
  }
  const attention = response < odds.refusal + odds.neutral ? 'neutral' : 'happy';
  const newWindow = now - progress.petWindow >= timing.petWindow;
  const rewards = newWindow ? 0 : progress.petRewards;
  if (now - progress.lastCare >= timing.reward && (feeding || rewards < petRewardLimit)) {
    progress = {
      ...progress,
      friendship: progress.friendship + (feeding ? 5 : 2),
      coins: progress.coins + (feeding ? 3 : 1),
      food: progress.food - Number(feeding),
      fullness: Math.min(100, progress.fullness + (feeding ? 30 : 0)),
      mood: Math.min(100, progress.mood + (feeding ? 8 : 5)),
      lastCare: now,
      petRewards: feeding ? progress.petRewards : rewards + 1,
      petWindow: feeding || !newWindow && progress.petWindow ? progress.petWindow : now,
    };
  }
  return {
    pet: feeding ? walk(pet, room.bowl + 2, 'eat', now, 2) : { ...stopMotion(pet, now), upgradeReaction: undefined, scene: undefined, attention,
      attentionHistory: (pet.attentionHistory ?? []).concat(attention).slice(-5),
      animation: enter(attention === 'happy' ? 'happy' : 'idle', now, 1, pet.animation, timing.happy) },
    progress,
  };
}


export function reactToUpgrade(pet: Behavior, id: UpgradeId, now: number) {
  if (busy(pet) || pet.upgradeReaction || pet.animation.animationId === 'sleep') return pet;
  const destinations = { rug_soft: room.rug, cat_bed: room.box, bowl_premium: room.bowl - 12 };
  const target = id === 'lamp_premium' || id === 'wallpaper_fresh' ? undefined : destinations[id];
  const next = target === undefined
    ? { ...stopMotion(pet, now), attention: undefined, scene: undefined, animation: enter('happy', now, 1, pet.animation) }
    : walk(pet, target, 'happy', now, 1);
  return { ...next, upgradeReaction: id };
}

export function restInBed(pet: Behavior, progress: Progress, now: number) {
  if (!progress.ownedUpgrades.cat_bed || busy(pet) || pet.destination === 'bed' &&
      (pet.animation.animationId === 'sleep' || pet.animation.animationId === 'walk')) return pet;
  return walk(pet, room.box, 'bed', now, 1);
}
