import type { Progress } from '../../game/behavior';

export type SyncCheckpoint = { revision:number; serialized:string };
export function resolveMeikuSave(
 remote:Partial<Progress>|undefined, revision:number, local:Progress|null,
 legacy:Progress|null, checkpoint:SyncCheckpoint|null, forceServer=false,
) {
 if(forceServer&&remote)return {progress:remote,upload:false,conflict:false,baseRevision:revision};
 if(!remote)return {progress:local??legacy??{},upload:true,conflict:false,baseRevision:revision};
 const localChanged=local&&JSON.stringify(local)!==JSON.stringify(remote)&&(checkpoint
  ? JSON.stringify(local)!==checkpoint.serialized
  : local.savedAt>=(remote.savedAt??0));
 if(localChanged) {
  const conflict=!checkpoint||checkpoint.revision!==revision;
  return {progress:local,upload:!conflict,conflict,baseRevision:checkpoint?.revision??revision};
 }
 return {progress:remote,upload:false,conflict:false,baseRevision:revision};
}
