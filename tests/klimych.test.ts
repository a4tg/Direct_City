import test from 'node:test';
import assert from 'node:assert/strict';
import {levels,tools,initialWorkshop,applyResult,evaluateResult,scoring} from '../server/klimych-rules';
import {newRound,tick,togglePause,accept,checkGesture,resultOf,type Sample} from '../src/modules/klimych/engine';
function gesture(step:typeof levels[0]['steps'][0]){
 const p=(x:number,y:number,t=0)=>({x,y,t});
 let points:Sample[]=[p(step.zone.x,step.zone.y),p(step.zone.x,step.zone.y,10)];
 if(step.type==='rotate')points=Array.from({length:37},(_,i)=>p(step.zone.x+115*Math.cos((step.turn??0)*i/36),step.zone.y+115*Math.sin((step.turn??0)*i/36),i*80));
 if(step.type==='hold')points=[p(step.zone.x,step.zone.y),p(step.zone.x,step.zone.y,step.holdMs)];
 if(step.type==='drag')points=[step.from?{...step.from,t:0}:p(-50,700),p(step.zone.x,step.zone.y,500)];
 if(step.type==='trace')points=step.path!.flatMap((to,i,path)=>i?Array.from({length:10},(_,k)=>p(path[i-1].x+(to.x-path[i-1].x)*(k+1)/10,path[i-1].y+(to.y-path[i-1].y)*(k+1)/10,i*100+k)): [{...to,t:0}]);
 if(step.type==='sequence')points=step.sequence!.map((v,i)=>({...v,t:i*200}));
 return {points,source:step.type==='drag'&&!step.objectDrag?'tool' as const:'object' as const,tool:step.tool};
}
test('five complete repair sequences are playable with baseline tools and produce medals',()=>{
 assert.equal(levels.length,5);assert.equal(tools.length,16);
 let progress=initialWorkshop();
 for(const level of levels){
  assert.ok(progress.unlocked.includes(level.id));
  let round=newRound(level);
  for(const step of level.steps){
   const attempt=checkGesture(step,gesture(step),900);
   assert.ok(attempt.ok,level.id+'/'+step.id+': '+attempt.reason);
   round=accept(tick(round,3000),attempt);
  }
  assert.equal(round.status,'finished');
  const result=resultOf(round);assert.equal(result.completed,true);assert.ok(result.score>=scoring.bronze);
  progress=applyResult(progress,result);
 }
 assert.equal(progress.completed.length,5);
});
test('wrong tools, wrong zones, out-of-order operations and premature hold are rejected',()=>{
 const level=levels[0],inspect=level.steps[0];
 assert.equal(checkGesture(inspect,{...gesture(inspect),tool:'tool-01'},0).ok,false);
 assert.equal(checkGesture(inspect,{points:[{x:20,y:20,t:0}],source:'object',tool:'hand'},0).ok,false);
 const hold=level.steps.find(s=>s.type==='hold')!;
 assert.equal(checkGesture(hold,{...gesture(hold),points:[{...hold.zone,t:0},{...hold.zone,t:100}]},0).ok,false);
 const r=accept(newRound(level),{ok:false,precision:0,reason:'Не по порядку'});
 assert.equal(r.step,0);assert.equal(r.errors,1);
});
test('rotation rejects wrong direction, excessive force and jumping through the centre',()=>{
 const step=levels[0].steps[2],g=gesture(step);
 assert.equal(checkGesture(step,{...g,points:[...g.points].reverse()},0).ok,false);
 const over={...step,turn:Math.PI*2.2};
 assert.equal(checkGesture(step,gesture(over),0).ok,false);
 assert.equal(checkGesture(step,{...g,points:[{...step.zone,t:0},...g.points]},0).ok,false);
});
test('traces require the entire ordered path including return and reject a shortcut',()=>{
 const step=levels[3].steps.at(-1)!;
 assert.equal(checkGesture(step,gesture(step),0).ok,true);
 assert.equal(checkGesture(step,{...gesture(step),points:[{...step.path![0],t:0},{...step.path!.at(-1)!,t:100}]},0).ok,false);
});
test('sequence rejects reversed assembly and repair drag needs movement from its origin',()=>{
 const step=levels[1].steps.find(s=>s.type==='sequence')!;
 const g=gesture(step);
 assert.equal(checkGesture(step,{...g,points:[...g.points].reverse()},0).ok,false);
 const drag=levels[4].steps[0];
 assert.equal(checkGesture(drag,{...gesture(drag),points:[{...drag.zone,t:0},{...drag.zone,t:1}]},0).ok,false);
});
test('mallet timing, misses and early release change quality without silently advancing',()=>{
 const step=levels[0].steps[3];
 assert.equal(checkGesture(step,gesture(step),900).ok,true);
 assert.equal(checkGesture(step,gesture(step),0).ok,false);
 const good=evaluateResult(levels[0],levels[0].steps.map(s=>({stepId:s.id,precision:1})),0,50000);
 const rushed=evaluateResult(levels[0],levels[0].steps.map(s=>({stepId:s.id,precision:.5})),7,10000);
 assert.ok(good.score>rushed.score);assert.ok(good.quality>rushed.quality);
});
test('pause freezes time, timeout fails incomplete work and paused actions do not count',()=>{
 let r=newRound(levels[0]);r=tick(r,1000);r=togglePause(r);
 assert.equal(tick(r,10000).elapsedMs,1000);
 assert.equal(accept(r,{ok:true,precision:1,reason:''}),r);
 r=togglePause(r);r=tick(r,999999);assert.equal(r.status,'finished');
 assert.equal(resultOf(r).medal,'retry');assert.ok(resultOf(r).score<50);
});
test('best progress is monotonic, retries do not duplicate completion and no QR tools gate base jobs',()=>{
 const level=levels[0],perfect=evaluateResult(level,level.steps.map(s=>({stepId:s.id,precision:1})),0,15000);
 const progress=applyResult(initialWorkshop(),perfect);
 const again=applyResult(progress,perfect);
 assert.deepEqual(again,progress);
 const worse=evaluateResult(level,[],15,60000);
 assert.deepEqual(applyResult(progress,worse),progress);
 assert.ok(progress.unlocked.includes('tap'));
 assert.equal(initialWorkshop().unlocked.includes('drawer'),false);
});
