export type Clip<Id extends string> = {
  animationId: Id;
  duration: number;
  loop: boolean;
  priority: number;
  interruptible: boolean;
  reduced?: boolean;
  onComplete?: () => void;
};

export type Playback<Id extends string> = Clip<Id> & { started: number };

export function startClip<Id extends string>(active: Playback<Id> | undefined, clip: Clip<Id>, now: number) {
  if (active && !finished(active, now) && (!active.interruptible || active.priority > clip.priority)) return active;
  return { ...clip, started: now };
}

export function finished(active: Playback<string>, now: number) {
  return now >= active.started + active.duration;
}

export function frameIndex(active: Playback<string>, count: number, now: number) {
  const elapsed = Math.max(0, now - active.started);
  const progress = active.loop ? (elapsed % active.duration) / active.duration : Math.min(1, elapsed / active.duration);
  return Math.min(count - 1, Math.floor(progress * count));
}

type VisualClip = {
  mode: 'loop' | 'once' | 'hold' | 'sequence';
  frames: readonly number[];
  weights: readonly number[];
  anchor: readonly [number, number];
  impactFrame?: number;
};
const anchor = [256, 481] as const;
export const visualClips = {
  sleep: { mode: 'sequence', frames: [1,2,3,4,5,6,7,8], weights: [2,2,2,2,2,84,3,3], anchor },
  eat: { mode: 'sequence', frames: [1,2,3,4,5,4,5,6,7,8], weights: [1,1,1,1,1,1,1,1,1,1], anchor },
  groom: { mode: 'once', frames: [1,2,3,4,5,6,7,8], weights: [1,1,1,1,1,1,1,1], anchor },
  mischief: { mode: 'once', frames: [1,2,3,4,5,6,7,8], weights: [1,1,1,1,1,1,1,1], anchor, impactFrame: 5 },
} satisfies Record<string, VisualClip>;

const reducedSleep = [1,1,1,1,1,91,2,2];

export function visualFrame(clip: VisualClip, active: Playback<string>, now: number) {
  if (clip.mode === 'hold') return clip.frames[0];
  const weights = clip === visualClips.sleep && active.reduced ? reducedSleep : clip.weights;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const elapsed = Math.max(0, now - active.started);
  const progress = clip.mode === 'loop' ? elapsed % active.duration : Math.min(elapsed, active.duration);
  let remaining = progress / active.duration * total;
  for (let index = 0; index < weights.length; index++) {
    remaining -= weights[index];
    if (remaining < 0) return clip.frames[index];
  }
  return clip.frames[clip.frames.length - 1];
}
