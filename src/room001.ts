import type { Behavior, Progress } from './game/behavior';
import { room } from './game/balance';
import { upgradeAssets } from './game/upgrades';

export const assets = '/assets/room-001/processed';
export const layers = { light: 1, back: 2, inside: 3, rim: 4, pet: 5, prop: 6, effect: 7, hud: 8 };

export const props = {
  rug: { id: 'rug_soft', type: 'floor', x: room.rug, y: 92, width: 54, anchor: 'bottom', layer: layers.back,
    states: ['placed'], interactions: [], interactive: false },
  bed: { id: 'cat_bed', type: 'bed', x: room.box, y: 83, width: 43, anchor: 'bottom', layer: layers.back,
    states: ['empty', 'occupied'], interactions: ['rest'], interactive: true },
  box: { id: 'box', type: 'shelter', x: room.box, y: 83, width: 43, anchor: 'bottom', layer: layers.back,
    states: ['resting'], interactions: [], interactive: false },
  bowl: { id: 'bowl', type: 'food', x: room.bowl, y: 87, width: 19, anchor: 'bottom', layer: layers.prop,
    states: ['empty', 'full', 'spilled'], interactions: ['tidy'], interactive: true },
  mouse: { id: 'mouse', type: 'toy', x: room.mouse, y: 88, width: 21, anchor: 'bottom', layer: layers.prop,
    states: ['idle', 'upright', 'squashed'], interactions: ['play', 'drag'], interactive: true },
  bulb: { id: 'bulb', type: 'light', x: 62, y: 0, width: 14, anchor: 'top', layer: layers.prop,
    states: ['off', 'on'], interactions: ['toggle'], interactive: true },
} as const;

export function position(prop: { x: number; y: number; width: number; layer: number }, x: number = prop.x, layer: number = prop.layer) {
  return { left: x + '%', top: prop.y + '%', width: prop.width + '%', zIndex: layer };
}

export function roomObjects(pet: Behavior, progress: Progress) {
  const state = pet.animation.animationId;
  const feeding = state === 'eat';
  return {
    background: progress.ownedUpgrades.wallpaper_fresh ? upgradeAssets + '/wallpaper_fresh.png' : assets + '/room_base.png',
    rug: { ...props.rug, purchased: !!progress.ownedUpgrades.rug_soft, state: 'placed', image: upgradeAssets + '/rug_soft.png' },
    bed: { ...props.bed, purchased: !!progress.ownedUpgrades.cat_bed, state: progress.ownedUpgrades.cat_bed && state === 'sleep' && (pet.inBox || pet.destination === 'bed') ? 'occupied' : 'empty',
      image: upgradeAssets + '/cat_bed.png' },
    box: { ...props.box, state: 'resting' },
    bowl: { ...props.bowl, purchased: !!progress.ownedUpgrades.bowl_premium,
      emptyImage: progress.ownedUpgrades.bowl_premium ? upgradeAssets + '/bowl_premium_empty.png' : assets + '/bowl_empty.png',
      fullImage: progress.ownedUpgrades.bowl_premium ? upgradeAssets + '/bowl_premium_full.png' : assets + '/bowl_full.png',
      spilledImage: progress.ownedUpgrades.bowl_premium ? upgradeAssets + '/bowl_premium_full.png' : assets + '/bowl_spilled.png',
      state: progress.tipped ? 'spilled' : feeding ? 'full' : 'empty' },
    mouse: { ...props.mouse, x: pet.mouse, state: state === 'play' ? 'squashed' :
      state === 'walk' && pet.destination === 'play' ? 'upright' : 'idle' },
    bulb: { ...props.bulb, purchased: !!progress.ownedUpgrades.lamp_premium, state: progress.lampOn ? 'on' : 'off',
      offImage: progress.ownedUpgrades.lamp_premium ? upgradeAssets + '/lamp_premium_off.png' : assets + '/bulb_off.png',
      onImage: progress.ownedUpgrades.lamp_premium ? upgradeAssets + '/lamp_premium_on.png' : assets + '/bulb_on.png',
      glowImage: progress.ownedUpgrades.lamp_premium ? upgradeAssets + '/lamp_premium_glow.png' : assets + '/bulb_glow.png' },
  } as const;
}
