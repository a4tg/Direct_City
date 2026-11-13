import { useState } from 'react';
import type { Catalog,World } from './types';
export function Collection({catalog,world}:{catalog:Catalog;world:World}) {
 const [brandId,setBrandId]=useState(catalog.brands[0]?.id??'');
 const brand=catalog.brands.find(item=>item.id===brandId);
 const designs=catalog.designs.filter(item=>item.brandId===brandId);
 return <section>
  <h2>Альбом встреч</h2><p>В коллекции {world.collection.length} из {catalog.designs.length} дизайнов.</p>
  <label className="field">Коллекция<select value={brandId} onChange={event=>setBrandId(event.target.value)}>
   {catalog.brands.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>
  <p>{brand?.theme}</p>
  <div className="album">{designs.map(design=>{
   const owned=world.collection.includes(design.id);
   return <article key={design.id} className={'sticker'+(owned?' owned':'')}>
    <div>{owned&&design.image?<img src={design.image} alt=""/>:<span>{owned?'✓':String(design.slot).padStart(2,'0')}</span>}</div>
    <strong>{design.name}</strong><small>{owned?'В коллекции':'Ещё не найден'}</small>
   </article>;
  })}</div>
 </section>;
}