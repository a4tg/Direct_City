import {defineConfig,loadEnv} from 'vite';
import {watch,existsSync} from 'node:fs';
import {syncMapAssets,defaultMapSource} from './scripts/sync-map-assets.mjs';
export default defineConfig(({mode})=>{
 const sourceDir=process.env.MAP_SOURCE_DIR??loadEnv(mode,process.cwd(),'').MAP_SOURCE_DIR??defaultMapSource;
 return {
 plugins:[{
  name:'pryamogorod-map-assets',
  buildStart(){syncMapAssets({sourceDir});},
  configureServer(server){
   if(!existsSync(sourceDir))return;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const watcher=watch(sourceDir,{recursive:true},(_,filename)=>{
    if(!filename||!String(filename).toLowerCase().endsWith('.png'))return;
    clearTimeout(timer);timer=setTimeout(()=>{try{syncMapAssets({sourceDir});}catch(e){server.config.logger.error('Ассеты карты: '+(e as Error).message);}},600);
   });
   server.httpServer?.once('close',()=>{clearTimeout(timer);watcher.close();});
  },
 }],
 server:{proxy:{'/api':{target:'http://127.0.0.1:3001',changeOrigin:false}}},
 };
});
