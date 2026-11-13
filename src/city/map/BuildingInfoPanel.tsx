import React from 'react';
import type {Building,Brand} from '../types';
export function BuildingInfoPanel({building,brand,title,open,enter,close,scan}:{building:Building;brand:Brand;title:string;open:boolean;enter:()=>void;close:()=>void;scan:()=>void}){
 return <aside className={'building-info'+(open?'':' is-locked')} aria-label="Выбранное здание">
 <button className="info-close" onClick={close} aria-label="Закрыть карточку">×</button>
 <div className="info-meta"><span>{brand.name}</span><small>{open?'Дверь открыта':'Нужен QR-стикер'}</small></div>
 <h3>{title}</h3><p className="info-character">{brand.mascot}</p>
 <p className="info-description">{open?brand.worldRole:'Найдите коллекционный QR-стикер '+brand.name+', чтобы познакомиться.'}</p>
 {open?<button className="enter-building" onClick={enter}>Войти {building.moduleId==='pending'?'в здание':'в игру'} →</button>:<button className="enter-building" onClick={scan}>Открыть QR-сканер →</button>}
 </aside>;
}
