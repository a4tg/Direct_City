import { useState } from 'react';
import { upgradeAssets, upgradeIds, upgrades, type UpgradeId } from './game/upgrades';
import { useGame } from './game/store';

export function Shop({ openRoom }: { openRoom: () => void }) {
  const owned = useGame(game => game.progress.ownedUpgrades);
  const buy = useGame(game => game.buy);
  const [notice, setNotice] = useState('');
  const [purchased, setPurchased] = useState(false);

  async function order(id: UpgradeId) {
    const result = await buy(id);
    setPurchased(result.status === 'bought');
    if (result.status === 'short') {
      setNotice('Не хватает монет. Нужно ещё: ' + result.missing + '.');
      return;
    }
    setNotice(result.status === 'bought' ? 'Покупка установлена в комнате.' : 'Это улучшение уже установлено.');
  }

  return <section className="shop" aria-labelledby="shop-title">
    <h2 id="shop-title">Уют для Мэйку</h2>
    <p>Выбирайте обновки для комнаты в любом порядке.</p>
    <div className="shop-notice">
      <span role="status">{notice}</span>
      {purchased && <button type="button" onClick={openRoom}>Посмотреть дома</button>}
    </div>
    <ul className="shop-items">
      {upgradeIds.map(id => {
        const item = upgrades[id];
        return <li key={id} className="shop-item">
          <img src={upgradeAssets + '/' + item.image} alt="" loading="lazy" />
          <div><h3>{item.name}</h3><p>{item.detail}</p>
            <span className="shop-price" aria-label={'Мэйку-монеты: ' + item.price}>✦ {item.price}</span>
          </div>
          <button type="button" aria-label={owned[id] ? item.name + ' — установлено' : 'Купить: ' + item.name}
            disabled={owned[id]} onClick={() => order(id)}>{owned[id] ? 'Установлено' : 'Купить'}</button>
        </li>;
      })}
    </ul>
  </section>;
}

