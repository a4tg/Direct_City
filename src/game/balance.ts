import type { OwnedUpgrades } from './upgrades.js';

export const levels = [0, 12, 30, 60, 100];
export const initial = {
  friendship: 0, coins: 0, food: 3, fullness: 35, lastCare: 0,
  energy: 75, mood: 50, savedAt: 0, tipped: false, lampOn: true, petRewards: 0, petWindow: 0, ownedUpgrades: {} as OwnedUpgrades,
};
export const timing = {
  intro: 12000, idle: 7200, walk: 900, sit: 5400, sleep: 10000, groom: 3800,
  eat: 1800, happy: 2200, annoyed: 2100, play: 3400, mischief: 1700,
  reward: 4200, petWindow: 300000, refusalRetry: 16000, mischiefCooldown: 90000,
  needsInterval: 180000,
};
export const chance = { refusal: .18, mischief: .12, sleep: .13, tiredSleep: .34, sit: .45, groom: .63, play: .76, cheerfulPlay: .87 };
export const petRewardLimit = 5;
export const room = { box: 50, bowl: 80, rug: 50, min: 18, max: 82, mouse: 19 };
