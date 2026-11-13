import { spawnSync } from 'node:child_process';
import { cp } from 'node:fs/promises';
const build=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.server.build.json'],{stdio:'inherit',windowsHide:true});
if(build.status!==0)process.exit(build.status??1);
await cp('server/migrations','server-dist/migrations',{recursive:true});
await cp('server/content','server-dist/content',{recursive:true});