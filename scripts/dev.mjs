import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const processes=[
 spawn(process.execPath,['--import','tsx','server/start.ts'],{stdio:'inherit',windowsHide:true}),
 spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','localhost','--port','5173','--strictPort'],{stdio:'inherit',windowsHide:true}),
];
let stopping=false;
function stop(code=0){
 if(stopping)return;stopping=true;
 for(const process of processes)process.kill();
 process.exitCode=code;
}
process.on('SIGINT',()=>stop());
process.on('SIGTERM',()=>stop());
for(const child of processes)child.on('exit',code=>stop(code??0));