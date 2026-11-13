import { buildApp } from './app.js';
const production = process.env.NODE_ENV === 'production';
const duplicateReward = Number(process.env.DUPLICATE_REWARD ?? 10);
if(!Number.isSafeInteger(duplicateReward) || duplicateReward < 0 || duplicateReward > 1000000) throw Error('Некорректная награда за повтор.');
const origin = process.env.APP_ORIGIN ?? 'http://localhost:5173';
const app = buildApp({
 dev:!production && process.env.DEV_TOOLS === 'true',
 origin, duplicateReward, secureCookies:origin.startsWith('https:'),
});
await app.listen({ host:process.env.HOST ?? '127.0.0.1', port:Number(process.env.PORT ?? 3001) });
console.log('Прямогород API запущен, порт',process.env.PORT??3001);