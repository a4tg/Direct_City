import { habits, meiku } from './personality.js';

export const autonomy = {
  idle: [5000, 15000], inspect: [3000, 7000], explore: [3000, 7000],
  play: [4000, 8500], rest: [10000, 25000],
  walk: [2000, 5000], points: [24, 36, 58, 69],
  tired: 38, hungry: 45, 
  cooldown: { sleep: 45000, groom: 55000, play: 20000, inspect: 18000, rest: 25000, mischief: 240000 },
} as const;

export type Activity = 'observe' | 'boxTour' | 'idle' | 'explore' | 'inspect' | 'play' | 'groom' | 'rest' | 'sleep' | 'mischief';
type Memory = { action: Activity; at: number; reason: string; x: number };

export function decide(
  context: { energy: number; fullness: number; mood: number; tipped: boolean; mouse: number; lastMischief: number; friendship?: number; hasBed?: boolean; lastBoxTour?: number },
  history: readonly Memory[], now: number, random: () => number, forced?: Activity,
) {
  const tired = context.energy < autonomy.tired;
  const hungry = context.fullness < autonomy.hungry;
  const can = (action: Activity, cooldown: number = 0) =>
    !history.slice(-2).every(item => item.action === action) || history.length < 2
      ? !history.some(item => item.action === action && now - item.at < cooldown) : false;
  const trust = Math.min(1, (context.friendship ?? 0) / 100);
  const weights: [Activity, number, string][] = [
    ['idle', 18, 'Спокойная пауза'],
    ['explore', tired ? 0 : 16 * (.65 + meiku.curiosity / 2), 'Осмотр комнаты'],
    ['inspect', !context.tipped && can('inspect', autonomy.cooldown.inspect) ? (hungry ? 42 : 7) * (.65 + meiku.curiosity / 2) : 0, 'Интерес к миске'],
    ['play', !tired && Number.isFinite(context.mouse) && can('play', autonomy.cooldown.play) ? (context.mood >= 55 ? 24 : 9) * (.66 + meiku.playfulness / 2) : 0, 'Интерес к игрушке'],
    ['groom', can('groom', autonomy.cooldown.groom) ? 10 : 0, 'Умывание после паузы'],
    ['rest', can('rest', autonomy.cooldown.rest) ? tired ? 55 : context.mood < 45 ? 17 : 8 : 0, 'Спокойный отдых'],
    ['sleep', tired && (context.energy < 20 || can('sleep', autonomy.cooldown.sleep)) ? 95 : 0, 'Мало энергии'],
    ['observe', !tired && can('observe', habits.observeCooldown) ? 3 + trust * 7 : 0, 'Наблюдает за игроком'],
    ['boxTour', !tired && context.hasBed && now - (context.lastBoxTour ?? now) >= habits.boxTourCooldown ? habits.boxTourWeight * meiku.boxAttachment : 0, 'Сравнивает лежанку и коробку'],
    ['mischief', !tired && !context.tipped && now - context.lastMischief >= autonomy.cooldown.mischief ? 3 * (.66 + meiku.playfulness / 2) : 0, 'Миска доступна и пауза истекла'],
  ];
  let pool = weights.filter(([action, weight]) => weight > 0 && (action === 'sleep' || can(action)));
  if (tired) {
    const recovery = pool.filter(([action]) => action === 'sleep' || action === 'rest');
    if (recovery.length) pool = recovery;
  }
  const effectiveWeights = Object.fromEntries(pool.map(([action, weight]) => [action, weight]));
  if (forced && weights.some(([action, weight]) => action === forced && weight > 0)) return { action: forced, reason: 'Запуск из отладки', weights: effectiveWeights };
  if (!pool.length) return { action: 'idle' as Activity, reason: 'Пауза до следующего занятия', weights: effectiveWeights };
  let ticket = random() * pool.reduce((total, [, weight]) => total + weight, 0);
  const [action,,reason] = pool.find(([, weight]) => (ticket -= weight) < 0) ?? pool[pool.length - 1];
  return { action, reason, weights: effectiveWeights };
}

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
