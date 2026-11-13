import test from 'node:test';
import assert from 'node:assert/strict';
import { initial } from '../src/game/balance';
import { resolveMeikuSave, type SyncCheckpoint } from '../src/city/modules/meikuSync';
const remote={...initial,coins:1000500000,friendship:49,savedAt:100};
const checkpoint:SyncCheckpoint={revision:3,serialized:JSON.stringify(remote)};
test('unsent local progress is retained and retried against its known server revision',()=>{
 const local={...remote,coins:1000500001,savedAt:200};
 const result=resolveMeikuSave(remote,3,local,null,checkpoint);
 assert.equal(result.progress,local);assert.equal(result.upload,true);
 assert.equal(result.conflict,false);assert.equal(result.baseRevision,3);
});
test('changes on another device preserve the local copy and pause automatic overwrite',()=>{
 const local={...remote,coins:1000500001,savedAt:200};
 const newerRemote={...remote,friendship:55,savedAt:250};
 const result=resolveMeikuSave(newerRemote,4,local,null,checkpoint);
 assert.equal(result.progress,local);assert.equal(result.upload,false);
 assert.equal(result.conflict,true);assert.equal(result.baseRevision,3);
});
test('unchanged local data accepts a new server revision',()=>{
 const newerRemote={...remote,friendship:55,savedAt:250};
 const result=resolveMeikuSave(newerRemote,4,remote,null,checkpoint);
 assert.equal(result.progress,newerRemote);assert.equal(result.conflict,false);
 assert.equal(result.upload,false);assert.equal(result.baseRevision,4);
});
test('old local saves without a checkpoint are preserved conservatively',()=>{
 const local={...remote,coins:1000500001,savedAt:200};
 const result=resolveMeikuSave(remote,3,local,null,null);
 assert.equal(result.progress,local);assert.equal(result.conflict,true);assert.equal(result.upload,false);
 assert.equal(resolveMeikuSave(remote,3,local,null,null,true).progress,remote);
});
test('legacy migration retains the large balance and ownership only when no server or scoped copy exists',()=>{
 const legacy={...remote,ownedUpgrades:{bed:true}};
 assert.equal(resolveMeikuSave(undefined,0,null,legacy,null).progress,legacy);
 assert.equal(resolveMeikuSave(undefined,0,remote,legacy,null).progress,remote);
 assert.equal(resolveMeikuSave(remote,3,null,legacy,null).progress,remote);
 assert.equal(resolveMeikuSave(undefined,0,null,null,null).upload,true);
});

test('a committed request with a lost response is recognized when server and local payloads match',()=>{
 const local={...remote,coins:1000500001,savedAt:200};
 const result=resolveMeikuSave(local,4,local,null,checkpoint);
 assert.equal(result.conflict,false);assert.equal(result.upload,false);assert.equal(result.baseRevision,4);
});
test('legacy scoped changes with equal savedAt are not silently discarded',()=>{
 const local={...remote,coins:1000500001};
 const result=resolveMeikuSave(remote,3,local,null,null);
 assert.equal(result.progress,local);assert.equal(result.conflict,true);
});

