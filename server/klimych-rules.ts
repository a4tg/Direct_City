// Pure data and rules shared by the browser and server. No Node APIs.
export type Point={x:number;y:number};
export type Action='tap'|'hold'|'drag'|'trace'|'rotate'|'sequence';
export type RepairStep={
 id:string;type:Action;tool:string;zone:Point;radius:number;instruction:string;
 success:string;error:string;effect:string;
 from?:Point;path?:Point[];sequence?:Point[];holdMs?:number;turn?:number;timed?:boolean;objectDrag?:boolean;
};
export type RepairLevel={id:string;title:string;problem:string;duration:number;objectId:string;steps:RepairStep[]};
export const scoring={qualityWeight:.7,timeWeight:.3,speedQualityGate:70,gold:90,silver:70,bronze:50,errorPenalty:7,accuracyPenalty:20};
const names=['Молоток','Разводной ключ','Шуруповёрт','Пассатижи','Отвёртка','Рулетка','Дрель','Топор','Вантуз','Ножовка','Паяльник','Строительный уровень','Струбцина','Сантехнический ключ','Киянка','Ящик с инструментами'];
export const tools=names.map((name,i)=>({id:'tool-'+String(i+1).padStart(2,'0'),designId:'klimych-'+String(i+1).padStart(2,'0'),name,image:'/assets/klimych/tools/'+String(i+1).padStart(2,'0')+'.png'}));
export const toolName=(id:string)=>id==='hand'?'Рука':tools.find(t=>t.id===id)?.name??id;
const step=(id:string,type:Action,tool:string,x:number,y:number,instruction:string,effect:string,extra:Partial<RepairStep>={}):RepairStep=>({
 id,type,tool,zone:{x,y},radius:100,instruction,effect,success:'Есть. Работаем дальше.',error:'Мимо цели. Проверь место и инструмент.',...extra,
});
export const levels:RepairLevel[]=[
 {id:'stool',title:'Шаткая табуретка',problem:'Ножка ходит в соединении. Сначала найдём люфт.',duration:60,objectId:'stool',steps:[
  step('inspect','tap','hand',600,350,'Коснись разболтавшегося соединения справа.','inspected'),
  step('place-driver','drag','tool-05',600,350,'Перетащи отвёртку из панели на крепление.','driver-ready'),
  step('tighten','rotate','tool-05',600,350,'По часовой стрелке: проведи ¾ круга по кольцу. Отпусти у метки.','tightened',{turn:Math.PI*1.5}),
  step('seat','tap','tool-15',580,430,'Выбери киянку. Один удар, когда бегунок войдёт в светлую зону.','seated',{timed:true}),
  step('clamp','hold','tool-13',600,350,'Выбери струбцину и удерживай соединение 5 секунд.','fixed',{holdMs:5000}),
  step('check','trace','hand',500,280,'Проведи рукой по сиденью слева направо: проверяем устойчивость.','verified',{path:[{x:300,y:280},{x:500,y:280},{x:700,y:280}]}),
 ]},
 {id:'tap',title:'Протекающий кран',problem:'Из носика капает. Разборка только после перекрытия воды.',duration:90,objectId:'tap',steps:[
  step('water-off','rotate','hand',230,490,'Перекрой воду: поверни нижний вентиль на ¾ круга по часовой стрелке.','water-off',{turn:Math.PI*1.5}),
  step('place-wrench','drag','tool-02',510,320,'Перетащи разводной ключ на гайку корпуса.','wrench-ready'),
  step('loosen','rotate','tool-02',510,320,'Ослабь гайку: ¾ круга против часовой стрелки.','opened',{turn:-Math.PI*1.5}),
  step('cover','tap','tool-05',510,230,'Отвёрткой сними доступную крышку — прокладка под ней.','cover-off'),
  step('gasket','drag','hand',510,350,'Перетащи новую прокладку с лотка слева в открытый корпус.','gasket-new',{from:{x:170,y:350},objectDrag:true}),
  step('assemble','sequence','hand',510,230,'Собери по порядку: 1 — крышка, 2 — рукоятка. Коснись деталей.','assembled',{sequence:[{x:510,y:230},{x:710,y:220}]}),
  step('secure','rotate','tool-02',510,320,'Ключом подтяни гайку: ¾ круга, без лишнего усилия.','secured',{turn:Math.PI*1.5}),
  step('test','hold','hand',230,490,'Открой тестовую подачу: удерживай вентиль 3 секунды, следи за носиком.','verified',{holdMs:3000}),
 ]},
 {id:'shelf',title:'Кривая полка',problem:'Правый край ниже левого. Крепить можно только после выравнивания.',duration:90,objectId:'shelf',steps:[
  step('level-in','drag','tool-12',500,300,'Перетащи строительный уровень на полку.','measured'),
  step('measure','trace','tool-06',500,380,'Рулеткой проведи от левой точки крепления к правой.','spacing',{path:[{x:280,y:380},{x:500,y:380},{x:720,y:380}]}),
  step('align','drag','hand',720,300,'Подними правый край: перетащи его от нижней метки к верхней.','aligned',{from:{x:720,y:400},objectDrag:true}),
  step('left-screw','hold','tool-03',280,380,'Шуруповёртом удерживай левый крепёж 3 секунды.','left-fixed',{holdMs:3000}),
  step('right-screw','hold','tool-03',720,380,'Теперь правый крепёж — 3 секунды.','right-fixed',{holdMs:3000}),
  step('level-out','drag','tool-12',500,300,'Ещё раз установи уровень: пузырёк должен оказаться в центре.','verified'),
 ]},
 {id:'door',title:'Скрипучая дверь',problem:'У верхней петли ослаблен крепёж. На съёмном штифте вылез фиксатор.',duration:110,objectId:'door',steps:[
  step('inspect','tap','hand',330,250,'Осмотри верхнюю петлю. Нижняя исправна.','inspected'),
  step('play-check','drag','hand',400,250,'Проверь люфт: слегка потяни створку вправо.','play-checked',{from:{x:330,y:250},objectDrag:true,radius:100}),
  step('screws','rotate','tool-05',330,250,'Подтяни винт верхней петли отвёрткой: ¾ круга.','tightened',{turn:Math.PI*1.5}),
  step('clip','drag','tool-04',330,285,'Пассатижами верни выступающий пружинный фиксатор штифта в паз.','clip-seated',{from:{x:420,y:285},objectDrag:true,radius:100}),
  step('swing','trace','hand',650,430,'Проведи ручку двери по пунктирной дуге и обратно.','verified',{path:[{x:690,y:400},{x:650,y:470},{x:550,y:520},{x:650,y:470},{x:690,y:400}],radius:100}),
 ]},
 {id:'drawer',title:'Сломанный ящик',problem:'Направляющая съехала из-за ослабленного крепления.',duration:110,objectId:'drawer',steps:[
  step('pull','drag','hand',500,520,'Потяни ящик на себя: от ручки к нижней метке.','out',{from:{x:500,y:350},objectDrag:true}),
  step('inspect','tap','hand',680,330,'Осмотри правую направляющую.','inspected'),
  step('loose','tap','tool-05',680,330,'Отвёрткой проверь ослабленный винт справа.','located'),
  step('measure','trace','tool-06',500,430,'Рулеткой проверь параллельность по контрольной линии.','measured',{path:[{x:280,y:430},{x:500,y:430},{x:720,y:430}]}),
  step('align','drag','hand',680,330,'Верни направляющую к контрольной риске: снизу вверх.','aligned',{from:{x:680,y:410},objectDrag:true}),
  step('fix','hold','tool-03',680,330,'Шуруповёртом подтяни винт, удерживая 4 секунды.','fixed',{holdMs:4000}),
  step('push','drag','hand',500,350,'Задвинь ящик от нижней метки обратно к ручке.','in',{from:{x:500,y:520},objectDrag:true}),
  step('glide','trace','hand',500,430,'Проверь ход: проведи ручку вниз и обратно по направляющей.','verified',{path:[{x:500,y:350},{x:500,y:520},{x:500,y:350}]}),
 ]},
];
export type Completion={stepId:string;precision:number};
export type RepairResult={levelId:string;quality:number;timeScore:number;score:number;elapsedMs:number;errors:number;medal:'gold'|'silver'|'bronze'|'retry';completed:boolean;steps:Completion[]};
export function evaluateResult(level:RepairLevel,steps:Completion[],errors:number,elapsedMs:number):RepairResult {
 const completed=steps.length===level.steps.length&&steps.every((s,i)=>s.stepId===level.steps[i].id);
 const accuracy=steps.length?steps.reduce((n,s)=>n+Math.max(0,Math.min(1,s.precision)),0)/steps.length:0;
 const quality=Math.max(0,Math.round((100-errors*scoring.errorPenalty-(1-accuracy)*scoring.accuracyPenalty)*(completed?1:steps.length/level.steps.length)));
 const timeScore=Math.max(0,Math.min(100,Math.round(100*(1-elapsedMs/(level.duration*1000))*1.5)));
 let score=Math.round(quality*scoring.qualityWeight+(quality>=scoring.speedQualityGate?timeScore*scoring.timeWeight:0));
 if(!completed)score=Math.min(49,score);
 return {levelId:level.id,quality,timeScore,score,elapsedMs,errors,medal:score>=scoring.gold?'gold':score>=scoring.silver?'silver':score>=scoring.bronze?'bronze':'retry',completed,steps};
}
export type WorkshopProgress={version:1;tutorialSeen:boolean;best:Record<string,RepairResult>;completed:string[];unlocked:string[]};
export function initialWorkshop():WorkshopProgress{return {version:1,tutorialSeen:false,best:{},completed:[],unlocked:[levels[0].id]};}
export function applyResult(progress:WorkshopProgress,result:RepairResult):WorkshopProgress {
 const best={...progress.best};
 if(!best[result.levelId]||best[result.levelId].score<result.score||best[result.levelId].score===result.score&&best[result.levelId].elapsedMs>result.elapsedMs)best[result.levelId]=result;
 const completed=[...new Set([...progress.completed,...(result.completed&&result.score>=scoring.bronze?[result.levelId]:[])])];
 const unlocked=levels.filter((_,i)=>i===0||completed.includes(levels[i-1].id)).map(l=>l.id);
 return {...progress,best,completed,unlocked};
}
