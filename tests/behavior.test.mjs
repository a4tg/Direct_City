import { attentionOdds, habits } from '../.test-build/personality.js';
import { decide, seededRandom } from '../.test-build/autonomy.js';
import { purchaseUpgrade } from '../.test-build/upgrades.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { advance, begin, busy, decay, interact, petPosition, reactToUpgrade, restInBed } from '../.test-build/behavior.js';
import { initial, timing, room } from '../.test-build/balance.js';
import { finished, frameIndex, startClip, visualClips, visualFrame } from '../.test-build/animation.js';

const now = 100000;
const progress = { ...initial, savedAt: now };
const roll = value => () => value;
const end = (pet, data, value = .9) => advance(pet, data, pet.animation.started + pet.animation.duration, roll(value));

test('feeding approaches the bowl, blocks competing actions, then reacts', () => {
  const walk = interact(begin(now), progress, 'feed', now, roll(.9));
  assert.equal(walk.pet.animation.animationId, 'walk');
  assert.equal(walk.pet.x, room.bowl + 2);
  assert.equal(busy(walk.pet), true);
  assert.equal(walk.progress.food, 2);
  assert.equal(walk.progress.fullness, 65);
  assert.equal(walk.progress.coins, 3);
  assert.equal(walk.progress.friendship, 5);
  const eat = end(walk.pet, walk.progress);
  assert.equal(eat.pet.animation.animationId, 'eat');
  assert.equal(interact(eat.pet, eat.progress, 'toy', now + 1000, roll(.9)).pet, eat.pet);
  assert.equal(end(eat.pet, eat.progress).pet.animation.animationId, 'happy');
});

test('petting is rewarded once per cooldown, and a refusal cannot repeat on immediate retry', () => {
  const first = interact(begin(now), progress, 'pet', now, roll(.9));
  assert.equal(first.progress.friendship, 2);
  assert.equal(first.progress.coins, 1);
  assert.equal(interact(first.pet, first.progress, 'pet', now + 1, roll(.9)).progress, first.progress);
  const refused = interact(first.pet, first.progress, 'pet', now + timing.reward, roll(0));
  assert.equal(refused.pet.animation.animationId, 'annoyed');
  assert.equal(refused.progress, first.progress);
  const idle = end(refused.pet, refused.progress);
  assert.equal(interact(idle.pet, idle.progress, 'pet', idle.pet.animation.started, roll(0)).pet.attention, 'neutral');
});

test('ambient choices, toy bounds and mischief are deterministic', () => {
  const idle = begin(now, true);
  assert.equal(end(idle, progress, 0).pet.animation.animationId, 'idle');
  assert.equal(advance(idle, progress, now + timing.idle, roll(.9), 'groom').pet.animation.animationId, 'groom');
  const sleep = end(idle, { ...progress, energy: 30 }, .8);
  assert.equal(end(sleep.pet, sleep.progress).pet.animation.animationId, 'sleep');
  const toy = interact(idle, progress, 'toy', now, roll(.9), 999);
  assert.equal(toy.pet.mouse, room.max);
  assert.equal(end(toy.pet, toy.progress).pet.animation.animationId, 'play');
  const approach = end({ ...idle, lastMischief: now - 240000 }, progress, .999);
  const mischief = end(approach.pet, approach.progress);
  assert.equal(mischief.progress.tipped, false);
  const impact = mischief.pet.animation.started + mischief.pet.animation.duration / 2;
  assert.equal(advance(mischief.pet, mischief.progress, impact - 1, roll(.9)).progress.tipped, false);
  const tipped = advance(mischief.pet, mischief.progress, impact, roll(.9));
  assert.equal(advance(tipped.pet, { ...tipped.progress, tipped: false }, impact + 1, roll(.9)).progress.tipped, false);
  assert.equal(tipped.pet.animation.animationId, 'mischief');
  assert.equal(tipped.progress.tipped, true);
  assert.equal(interact(tipped.pet, tipped.progress, 'feed', now + 10000, roll(.9)).progress.food, 3);
  assert.equal(end(tipped.pet, tipped.progress).pet.animation.animationId, 'innocent');
});

test('offline decay is capped and preserves resources and friendship', () => {
  const before = { ...progress, fullness: 90, friendship: 15, coins: 20 };
  const after = decay(before, now + 100000 * timing.needsInterval);
  assert.equal(after.fullness, 70);
  assert.equal(after.energy, 45);
  assert.equal(after.mood, 35);
  assert.equal(after.food, before.food);
  assert.equal(after.coins, before.coins);
  assert.equal(after.friendship, before.friendship);
  assert.equal(decay(after, after.savedAt), after);
});

test('a higher priority clip wins and an uninterruptible clip finishes first', () => {
  const clip = { animationId: 'eat', duration: 100, loop: true, priority: 2, interruptible: false };
  const active = startClip(undefined, clip, now);
  const next = { ...clip, animationId: 'idle', priority: 0, interruptible: true };
  assert.equal(startClip(active, next, now + 80), active);
  assert.equal(frameIndex(active, 4, now + 75), 3);
  assert.ok(finished(active, now + 100));
  assert.equal(startClip(active, next, now + 100).animationId, 'idle');
});

test('petting continues to react after the reward budget runs out', () => {
  const capped = { ...progress, petWindow: now, petRewards: 5 };
  const result = interact(begin(now), capped, 'pet', now, roll(.9));
  assert.equal(result.pet.animation.animationId, 'happy');
  assert.equal(result.progress, capped);
  const later = interact(begin(now), capped, 'pet', now + timing.petWindow, roll(.9));
  assert.equal(later.progress.friendship, 2);
  assert.equal(later.progress.petRewards, 1);
});

test('upgrades can be bought independently and a repeat never deducts coins', () => {
  const start = { ...progress, coins: 250 };
  const result = purchaseUpgrade(start, 'wallpaper_fresh');
  assert.equal(result.status, 'bought');
  assert.equal(result.progress.coins, 0);
  assert.deepEqual(result.progress.ownedUpgrades, { wallpaper_fresh: true });
  assert.deepEqual(purchaseUpgrade(result.progress, 'wallpaper_fresh'), { status: 'owned' });
  assert.deepEqual(purchaseUpgrade(result.progress, 'rug_soft'), { status: 'short', missing: 60 });
  assert.equal(start.coins, 250);
  assert.deepEqual(start.ownedUpgrades, {});
});

test('autonomous sleep can choose the purchased bed', () => {
  const idle = begin(now, true);
  assert.equal(restInBed(idle, progress, now), idle);
  const furnished = { ...progress, ownedUpgrades: { cat_bed: true } };
  const approach = restInBed(idle, furnished, now);
  const bed = end(approach, furnished).pet;
  assert.equal(bed.animation.animationId, 'sleep');
  assert.equal(bed.x, room.box);
  assert.equal(bed.inBox, false);
  assert.equal(end(end(idle, { ...progress, energy: 10 }, .8).pet, progress).pet.inBox, true);
  assert.equal(end(end(idle, { ...furnished, energy: 10 }, .8).pet, furnished).pet.destination, 'bed');
});

test('purchase reactions preserve feeding priority and finish cleanly', () => {
  const pet = begin(now);
  const feeding = interact(pet, progress, 'feed', now, roll(.9));
  assert.equal(reactToUpgrade(feeding.pet, 'rug_soft', now), feeding.pet);
  const walk = reactToUpgrade(pet, 'rug_soft', now);
  assert.equal(walk.x, room.rug);
  const reaction = end(walk, progress).pet;
  assert.equal(reaction.animation.animationId, 'happy');
  assert.equal(reaction.upgradeReaction, 'rug_soft');
  assert.equal(end(reaction, progress).pet.upgradeReaction, undefined);
});


test('motion starts at the current anchor, reaches the furniture, and redirects without a jump', () => {
  const pet = begin(now);
  const first = interact(pet, progress, 'toy', now, roll(.9), room.mouse).pet;
  assert.deepEqual(petPosition(first, now), petPosition(pet, now));
  const halfway = now + timing.walk / 2;
  const redirected = interact(first, progress, 'feed', halfway, roll(.9)).pet;
  assert.deepEqual(petPosition(redirected, halfway), petPosition(first, halfway));
  const arrival = halfway + timing.walk;
  const eating = advance(redirected, progress, arrival, roll(.9)).pet;
  assert.equal(eating.animation.animationId, 'eat');
  assert.deepEqual(petPosition(eating, arrival), petPosition(redirected, arrival));
});

test('sleep holds frame six and wakes near the end without replaying the intro', () => {
  const playback = { started: now, duration: timing.sleep };
  for (const reduced of [false, true]) {
    const clip = { ...playback, reduced };
    assert.equal(visualFrame(visualClips.sleep, clip, now), 1);
    assert.equal(visualFrame(visualClips.sleep, clip, now + 5000), 6);
    assert.equal(visualFrame(visualClips.sleep, clip, now + 9999), 8);
  }
});

test('mischief applies its impact even if the next tick is after the clip', () => {
  const initialPet = begin(now, true);
  const idle = { ...initialPet, lastMischief: now - 240000 };
  const approach = end(idle, progress, .999);
  const arrival = end(approach.pet, approach.progress);
  const late = end(arrival.pet, arrival.progress);
  assert.equal(late.progress.tipped, true);
  assert.equal(late.pet.animation.animationId, 'innocent');
});

test('autonomy runs for two and ten minutes without passive rewards', () => {
  const random = seededRandom(42);
  let pet = begin(now, true);
  let data = { ...progress, coins: 1000500016, ownedUpgrades: { cat_bed: true } };
  const actions = new Set();
  for (let t = now; t <= now + 600000; t += 250) {
    ({ pet, progress: data } = advance(pet, decay(data, t), t, random));
    actions.add(pet.animation.animationId);
    assert.equal(data.coins, 1000500016);
    assert.equal(data.friendship, progress.friendship);
    assert.equal(data.food, progress.food);
    if (t === now + 120000) assert.ok(actions.size >= 4);
  }
  assert.ok(actions.size >= 6);
  assert.ok(pet.history.length <= 5);
});

test('needs and unavailable props affect autonomous selection', () => {
  const context = { ...progress, energy: 5, mouse: NaN, lastMischief: now };
  assert.equal(decide(context, [], now, () => .99).action, 'sleep');
  const awake = { ...context, energy: 90, fullness: 25 };
  assert.equal(decide(awake, [], now, () => .6).action, 'inspect');
  for (let index = 0; index < 100; index++) {
    const { action } = decide({ ...awake, tipped: true }, [], now, () => index / 100);
    assert.ok(!['play', 'inspect', 'mischief'].includes(action));
  }
});

test('friendship increases trust without removing refusals or changing reward amounts', () => {
  const cautious = attentionOdds(1, 60, 60, 60);
  const trusting = attentionOdds(100, 60, 60, 60);
  assert.ok(trusting.refusal > 0 && trusting.refusal < cautious.refusal);
  const active = begin(now, true);
  const low = { ...progress, friendship: 1, energy: 60, fullness: 60, mood: 60 };
  const high = { ...low, friendship: 100 };
  const refused = interact(active, low, 'pet', now, roll(.1));
  assert.equal(refused.pet.animation.animationId, 'annoyed');
  assert.equal(end(refused.pet, refused.progress).pet.animation.animationId, 'idle');
  const accepted = interact(active, high, 'pet', now, roll(.1));
  assert.equal(accepted.pet.attention, 'neutral');
  assert.equal(accepted.progress.friendship, 102);
  assert.equal(accepted.progress.coins, 1);
});

test('box scene reaches the bed before choosing the box and can be interrupted', () => {
  const pet = { ...begin(now, true), lastBoxTour: now - habits.boxTourCooldown };
  const data = { ...progress, ownedUpgrades: { cat_bed: true } };
  const walk = advance(pet, data, now + timing.idle, roll(.9), 'boxTour');
  assert.equal(walk.pet.destination, 'bedRest');
  const bed = end(walk.pet, walk.progress);
  assert.equal(bed.pet.animation.animationId, 'rest');
  const leave = end(bed.pet, bed.progress);
  assert.equal(leave.pet.animation.animationId, 'walk');
  assert.notEqual(leave.pet.x, bed.pet.x);
  assert.equal(end(leave.pet, leave.progress).pet.inBox, true);
  const interrupt = interact(bed.pet, bed.progress, 'feed', bed.pet.animation.started + 1, roll(.9));
  assert.equal(interrupt.pet.destination, 'eat');
  assert.equal(interrupt.pet.scene, undefined);
  assert.equal(leave.progress.coins, data.coins);
});