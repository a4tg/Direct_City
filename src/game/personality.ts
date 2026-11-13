export const meiku = {
  curiosity: .72,
  playfulness: .68,
  affection: .64,
  stubbornness: .38,
  boxAttachment: .62,
} as const;

export const habits = {
  boxTourCooldown: 480000,
  boxTourWeight: 3,
  observeCooldown: 65000,
  observeDuration: 4200,
  toyInspectDuration: 1400,
  bedTrialDuration: 3500,
  boxRestDuration: 12000,
  innocenceDuration: 2200,
} as const;

export function attentionOdds(friendship: number, energy: number, fullness: number, mood: number) {
  const trust = Math.min(1, Math.max(0, friendship / 100));
  const comfort = (energy + fullness + mood) / 300;
  return {
    trust,
    refusal: Math.max(.04, Math.min(.30, .08 + meiku.stubbornness * .26 - trust * .08 - comfort * .05)),
    neutral: Math.max(.12, .48 - meiku.affection * .26 - trust * .14 - comfort * .10),
  };
}
