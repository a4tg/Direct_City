import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { frameIndex, visualClips, visualFrame } from './game/animation';
import { inShelter, petPosition, spareBoxX, reactions } from './game/behavior';
import { room } from './game/balance';
import { upgrades } from './game/upgrades';
import { useGame } from './game/store';

import { assets, layers, position, roomObjects } from './room001';
const sprites = '/assets/meiku';
const frames = {
  observe: ['idle'], toyInspect: ['idle'], innocent: ['idle'], explore: ['idle'], inspect: ['idle'], rest: ['sit'], sad: ['sad-box'], idle: ['idle'], walk: ['idle'], sit: ['sit'],
  sleep: ['sleep'], groom: ['groom'], eat: ['eat'], happy: ['walk'],
  annoyed: ['annoyed'], play: ['idle'], mischief: ['walk'],
};
const folders = { sleep: 'sleep', eat: 'eating', groom: 'grooming', mischief: 'mischief' } as const;
const decoded = new Map<string, HTMLImageElement>();

function framePath(folder: string, number: number) {
  return `${sprites}/animations/${folder}/${folder}_0${number}.png`;
}

function prepareFrame(url: string) {
  if (decoded.has(url)) return;
  const image = new Image();
  decoded.set(url, image);
  image.src = url;
  void image.decode().catch(() => decoded.delete(url));
}

const boxFrames = { idle: ['idle-box'], happy: ['happy-box'] };

export function Room({ now, blocked }: { now: number; blocked: boolean }) {
  const { pet, progress, care, tidy, toggleLamp, rest, pendingUpgrades, showUpgrade } = useGame();
  const scene = useRef<HTMLElement>(null);
  const stroke = useRef<{ pointer: number; x: number; y: number; distance: number } | null>(null);
  const drag = useRef<{ pointer: number; start: number } | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const state = pet.animation.animationId;
  const { box, bowl, mouse, bulb, background, rug, bed } = roomObjects(pet, progress);
  const sheltered = inShelter(pet);
  const [motionTime, setMotionTime] = useState(now);
  const motion = pet.motion;
  useEffect(() => {
    if (!motion) return;
    const end = pet.animation.started + pet.animation.duration;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotionTime(end);
      return;
    }
    let frame = requestAnimationFrame(function update() {
      const time = Date.now();
      setMotionTime(time);
      if (time < end) frame = requestAnimationFrame(update);
    });
    return () => cancelAnimationFrame(frame);
  }, [motion, pet.animation]);
  const location = petPosition(pet, motion ? Math.max(motionTime, pet.animation.started) : now);
  const spareBox = { ...box, x: spareBoxX, y: 80, width: 25 };
  const cardboard = bed.purchased ? spareBox : box;
  const inSpareBox = bed.purchased && pet.inBox && pet.x === spareBoxX;
  const sleepingInBed = bed.state === 'occupied' && !inSpareBox;
  useEffect(() => {
    if (pendingUpgrades.length) showUpgrade();
  }, [pet, pendingUpgrades, showUpgrade]);
  const sequence = sheltered && (state === 'idle' || state === 'happy') ? boxFrames[state] : frames[state];
  const sprite = sequence[frameIndex(pet.animation, sequence.length, now)];
  const action = state in folders ? state as keyof typeof folders : undefined;
  const upcoming = state === 'walk' && (pet.destination === 'bed' || pet.destination === 'sleep')
    ? 'sleep' : state === 'walk' && (pet.destination === 'eat' || pet.destination === 'mischief') ? pet.destination : action;
  const clip = action ? visualClips[action] : undefined;
  const playback = pet.animation;
  const fallback = state === 'eat' ? assets + '/meiku_eat.png' : sprites + '/' + sprite + '.png';
  const [pose, setPose] = useState({ playback, frame: 1 });
  useEffect(() => {
    if (!upcoming) return;
    for (let number = 1; number <= 8; number++) prepareFrame(framePath(folders[upcoming], number));
  }, [upcoming]);
  useEffect(() => {
    if (!clip) return;
    let request = 0;
    let previous = 0;
    let impactChecked = false;
    const update = () => {
      const time = Date.now();
      const frame = visualFrame(clip, playback, time);
      if (action === 'mischief' && !impactChecked && frame >= visualClips.mischief.impactFrame) {
        impactChecked = true;
        useGame.getState().tick();
      }
      if (frame !== previous) {
        previous = frame;
        setPose({ playback, frame });
      }
      if (time < playback.started + playback.duration) request = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(request);
  }, [action, clip, playback]);
  let frame = pose.playback === playback ? pose.frame : 1;
  if (action === 'mischief' && !pet.bowlImpact) frame = Math.min(frame, visualClips.mischief.impactFrame - 1);
  const frameUrl = action ? framePath(folders[action], frame) : fallback;
  const [failedFrame, setFailedFrame] = useState('');
  const idlePhase = Math.floor((now - playback.started) / 250) % 48;
  const idleFrame = idlePhase === 12 || idlePhase === 14 ? 2 : idlePhase === 13 ? 3 : idlePhase === 26 ? 5 : idlePhase === 39 ? 6 : 1;
  const walkFrame = Math.floor(Math.max(0, motionTime - playback.started) / 110) % 8 + 1;
  const ambient = !playback.reduced && state === 'walk' ? framePath('walk', walkFrame)
    : !sheltered && (state === 'idle' || state === 'observe' || state === 'explore' || state === 'inspect') ? framePath('idle', playback.reduced ? 1 : idleFrame) : '';
  const displayFrame = ambient || frameUrl;
  const animated = (!!clip || !!ambient) && failedFrame !== displayFrame;
  const thought = state === 'sleep' || (pet.destination === 'sleep' || pet.destination === 'bed') && state === 'walk' ? '💤'
    : state === 'play' || pet.destination === 'play' && state === 'walk' ? '🐭'
    : progress.fullness < 45 && ['idle', 'sad', 'sit'].includes(state) ? '🥣' : '';
  const reaction = state === 'mischief' && !pet.bowlImpact ? 'Мэйку присматривается к миске…' : pet.attention === 'neutral' ? 'Мэйку спокойно принял поглаживание.'
    : pet.attention === 'happy' ? 'Мр-р-р… Кажется, ты заслужил мурчание.'
    : pet.scene === 'boxTour' && pet.destination === 'rest' ? 'Лежанка хороша. Но коробка лучше.'
    : reactions[state];
  const thoughtLabel = thought === '💤' ? 'Хочется спать' : thought === '🐭' ? 'Хочется играть' : 'Хочется есть';

  function startStroke(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stroke.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
  }

  function moveStroke(event: PointerEvent<HTMLButtonElement>) {
    const active = stroke.current;
    if (!active || active.pointer !== event.pointerId) return;
    active.distance += Math.hypot(event.clientX - active.x, event.clientY - active.y);
    active.x = event.clientX;
    active.y = event.clientY;
  }

  function endStroke(event: PointerEvent<HTMLButtonElement>) {
    if (stroke.current?.pointer !== event.pointerId) return;
    moveStroke(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    const tap = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (tap || stroke.current.distance >= 18) care('pet');
    stroke.current = null;
  }

  function mousePosition(clientX: number) {
    const bounds = scene.current!.getBoundingClientRect();
    return Math.min(room.max, Math.max(room.min, (clientX - bounds.left) / bounds.width * 100));
  }

  return <section ref={scene} className={'room ' + state} aria-label="Комната Мэйку">
    <img className="room-art" src={background} alt="Комната со звёздными обоями и деревянным полом" />
    <span className="room-label" style={{ zIndex: layers.hud }}>01 · КОРОБОЧНОЕ КОРОЛЕВСТВО</span>
    <img className={'bulb-glow' + (bulb.state === 'on' ? ' lit' : '')} style={{ left: bulb.x + '%', zIndex: layers.light }}
      src={bulb.glowImage} alt="" />
    <button type="button" className={'room-prop bulb' + (bulb.purchased ? ' premium' : '')} style={position(bulb)}
      aria-label="Свет в комнате" aria-pressed={bulb.state === 'on'} onClick={toggleLamp}>
      <img src={bulb.offImage} alt="" />
      <img className={bulb.state === 'on' ? 'lit' : ''} src={bulb.onImage} alt="" />
    </button>
    {rug.purchased && <img className="room-prop rug" style={position(rug)} src={rug.image} alt="Мягкий коврик" />}
    {bed.purchased && <>
      <img className="room-prop bed-back" style={position(bed)} src={bed.image} alt="" />
      <img className="room-prop bed-rim" style={position(bed, bed.x, layers.rim)} src={bed.image} alt="" />
      <button type="button" className="room-prop bed-action" style={position(bed, bed.x, layers.back)}
        aria-label="Позвать Мэйку в лежанку" disabled={blocked || sleepingInBed} onClick={rest} />
    </>}
    {<img className="room-prop box-back" style={position(cardboard)} src={assets + '/cardboard_box.png'} alt="Картонная коробка" />}
    <button className={'kitten' + (sheltered ? ' in-box' : '') + (motion ? ' moving' : '')} type="button"
      aria-label="Погладить Мэйку" disabled={blocked} style={{ left: location.x + '%', top: (location.y - (inSpareBox ? 2 : 0)) + '%', width: inSpareBox ? '32%' : undefined,
        zIndex: sheltered ? layers.inside : layers.pet }}
      onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={endStroke}
      onLostPointerCapture={() => { stroke.current = null; }}
      onClick={event => { if (event.detail === 0) care('pet'); }}>
      {!sheltered && <span className="pet-shadow" aria-hidden="true" />}
      <span className={'pet-pose' + (animated ? ' frame-clip' : '')} key={state + sprite}>
        <img src={animated ? displayFrame : fallback} alt="" draggable={false}
          style={animated ? { translate: '0 6.055%', scale: motion && pet.x < motion.fromX ? '-1 1' : undefined } : undefined}
          onError={() => { if (animated) setFailedFrame(displayFrame); }} />
      </span>
      {state === 'happy' && <span key={pet.animation.started} className="purr" aria-hidden="true">♥</span>}
    </button>
    {thought && <span className="thought" role="img" aria-label={thoughtLabel} style={{ left: location.x + '%', zIndex: layers.effect }}>{thought}</span>}
    {<img className="room-prop box-rim" style={position(cardboard, cardboard.x, layers.rim)} src={assets + '/cardboard_box.png'} alt="" />}
    <button className={'room-prop toy ' + mouse.state} type="button" aria-label="Поиграть с мышкой" disabled={blocked}
      style={position(mouse, mouseX ?? mouse.x)}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointer: event.pointerId, start: event.clientX };
      }}
      onPointerMove={event => {
        if (drag.current?.pointer === event.pointerId && Math.abs(event.clientX - drag.current.start) > 5) {
          setMouseX(mousePosition(event.clientX));
        }
      }}
      onPointerUp={event => {
        if (drag.current?.pointer !== event.pointerId) return;
        care('toy', Math.abs(event.clientX - drag.current.start) > 5 ? mousePosition(event.clientX) : pet.mouse);
        drag.current = null;
        setMouseX(null);
      }}
      onLostPointerCapture={() => { drag.current = null; setMouseX(null); }}
      onClick={event => { if (event.detail === 0) care('toy'); }}>
      <img src={assets + '/mouse_' + mouse.state + '.png'} alt="" draggable={false} />
    </button>
    <div className={'room-prop bowl ' + bowl.state + (bowl.purchased ? ' premium' : '')} style={position(bowl)} data-state={bowl.state}>
      <img src={bowl.emptyImage} alt={bowl.state === 'empty' ? 'Пустая миска' : ''} />
      <img className="bowl-food" src={bowl.fullImage} alt={bowl.state === 'full' ? 'Миска с кормом' : ''} />
      {bowl.state === 'spilled' && <button type="button" className="tidy" onClick={tidy} aria-label="Поднять миску">
        <img src={bowl.spilledImage} alt="" />
        <span>Поднять</span>
      </button>}
    </div>
    <p className="reaction" style={{ zIndex: layers.hud }} role="status">{pet.upgradeReaction ? upgrades[pet.upgradeReaction].reaction : sleepingInBed ? 'Мэйку свернулся клубочком в лежанке.' : reaction}</p>
  </section>;
}
