export const upgradeAssets = '/assets/room-001/upgrades';
export const upgrades = {
  rug_soft: { name: 'Мягкий коврик', price: 60, image: 'rug_soft.png',
    detail: 'Мягкий островок на старых досках.', reaction: 'Мэйку обнюхал коврик и довольно потоптался.' },
  bowl_premium: { name: 'Новая миска', price: 90, image: 'bowl_premium_full.png',
    detail: 'Миска с розовой лапкой вместо старой.', reaction: 'Мэйку разглядывает миску. Мяу!' },
  cat_bed: { name: 'Уютная лежанка', price: 150, image: 'cat_bed.png',
    detail: 'Мягкое место для сна вместо коробки.', reaction: 'Мэйку примеряется к новой лежанке. Здесь мягче!' },
  lamp_premium: { name: 'Новый светильник', price: 180, image: 'lamp_premium_on.png',
    detail: 'Плафон со звёздами и мягким светом.', reaction: 'Мэйку поднял голову. Откуда взялись звёзды?' },
  wallpaper_fresh: { name: 'Новые обои', price: 250, image: 'wallpaper_fresh.png',
    detail: 'Свежая отделка с розовыми полосками и звёздами.', reaction: 'Мэйку осмотрел стены и довольно замурлыкал.' },
} as const;

export type UpgradeId = keyof typeof upgrades;
export type OwnedUpgrades = Partial<Record<UpgradeId, true>>;
export const upgradeIds = Object.keys(upgrades) as UpgradeId[];

export function purchaseUpgrade<T extends { coins: number; ownedUpgrades: OwnedUpgrades }>(progress: T, id: UpgradeId) {
  if (progress.ownedUpgrades[id]) return { status: 'owned' } as const;
  const price = upgrades[id].price;
  if (progress.coins < price) return { status: 'short', missing: price - progress.coins } as const;
  return {
    status: 'bought',
    progress: { ...progress, coins: progress.coins - price, ownedUpgrades: { ...progress.ownedUpgrades, [id]: true } },
  } as const;
}

