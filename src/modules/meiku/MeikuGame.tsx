import { useEffect, useState } from 'react';

import { levels, timing } from '../../game/balance';
import { autonomy } from '../../game/autonomy';
import { habits, meiku, attentionOdds } from '../../game/personality';
import { busy } from '../../game/behavior';
import { Room } from '../../Room';
import { Shop } from '../../Shop';
import { useGame } from '../../game/store';
import '../../style.css';

const showDebug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
const tabs = [
  { name: 'Дом', icon: '⌂', detail: '' },
  { name: 'Гардероб', icon: '♧', detail: 'Здесь появятся наряды Мэйку.' },
  { name: 'Магазин', icon: '♢', detail: '' },
  { name: 'События', icon: '✧', detail: 'Здесь появятся истории и сезонные события.' },
];


export function MeikuGame() {
  const [tab, setTab] = useState(0);
  const { pet, progress: game, care } = useGame();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void useGame.getState().tick();
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  const level = levels.filter(points => game.friendship >= points).length;
  const goal = levels[level];
  const floor = levels[level - 1];
  const blocked = busy(pet);
  const feedBlocked = now - game.lastCare < timing.reward || game.tipped;
  const feedHint = game.tipped ? 'Подними миску' : !game.food ? 'Корм закончился' : game.fullness >= 100 ? 'Мэйку сыт' : 'Покормить';

  return <div className="app">
    <header>
      <div><span className="brand">МИР МЭЙКУ-ТЯН</span><h1>{tab === 0 ? 'Дом Мэйку' : tabs[tab].name}</h1></div>
      <span className="coins" aria-label={'Мэйку-монеты: ' + game.coins}>✦ {game.coins}</span>
    </header>
    <main>
      {tab === 0 ? <>
        <section className="friend" aria-label="Дружба">
          <span className="heart" aria-hidden="true">♥</span>
          <div className="friend-text"><strong>Дружба · Уровень {level}</strong>
            <progress aria-label="Прогресс дружбы" value={goal ? game.friendship - floor : 1} max={goal ? goal - floor : 1} />
          </div>
          <small>{goal ? game.friendship + ' / ' + goal : 'Максимум'}</small>
        </section>
        <Room now={now} blocked={blocked} />
        <div className="care">
          <button disabled={blocked} onClick={() => care('pet')}><span aria-hidden="true">♡</span> Погладить</button>
          <button disabled={blocked || feedBlocked || !game.food || game.fullness >= 100} onClick={() => care('feed')}><span aria-hidden="true">◡</span> {feedHint}</button>
        </div>
        <p className="supplies">Сытость {game.fullness}% <span>·</span> Корм: {game.food} порц.</p>
      </> : tab === 2 ? <Shop openRoom={() => setTab(0)} /> : <section className="placeholder"><span aria-hidden="true">{tabs[tab].icon}</span><h2>Скоро здесь</h2><p>{tabs[tab].detail}</p></section>}
      {showDebug && <details>
        <summary>Отладка поведения</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({
          состояние: pet.animation.animationId, цель: pet.destination, x: pet.x,
          сценка: pet.scene ?? null, веса: pet.history?.at(-1)?.weights ?? {}, история: pet.history ?? [],
          черты: meiku, реакции: pet.attentionHistory ?? [],
          вероятностьВнимания: attentionOdds(game.friendship, game.energy, game.fullness, game.mood),
          паузыМс: autonomy.cooldown,
          коробкаЧерезМс: Math.max(0, habits.boxTourCooldown - (now - (pet.lastBoxTour ?? now))),
          пакостьЧерезМс: Math.max(0, autonomy.cooldown.mischief - (now - pet.lastMischief)),
        }, null, 2)}</pre>
        <p>В консоли meikuDebug.seed(42) задаёт последовательность. meikuDebug.scene('boxTour') запускает доступную сценку.</p>
      </details>}
    </main>
    <nav aria-label="Разделы игры">
      {tabs.map(({ name, icon }, index) => <button key={name} aria-current={tab === index ? 'page' : undefined} onClick={() => setTab(index)}><span aria-hidden="true">{icon}</span>{name}</button>)}
    </nav>
  </div>;
}


