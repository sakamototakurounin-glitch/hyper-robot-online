import {slide,validatePath} from './engine.js';
export const BOT_PROFILES = [null,
 {first:[18,50],error:[1,4],firstOptimal:.08,optimal:.275,optimalTime:[50,120],improve:.68,gap:[16,34],max:2},
 {first:[12,38],error:[0,3],firstOptimal:.16,optimal:.425,optimalTime:[35,90],improve:.78,gap:[12,28],max:3},
 {first:[8,30],error:[0,2],firstOptimal:.26,optimal:.575,optimalTime:[25,70],improve:.83,gap:[9,23],max:3},
 {first:[5,21],error:[0,1],firstOptimal:.40,optimal:.64,optimalTime:[16,48],improve:.91,gap:[6,16],max:4},
 {first:[4,18],error:[0,1],firstOptimal:.52,optimal:.65,optimalTime:[14,42],improve:.94,gap:[5,14],max:4}];
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const between=(a,b,r)=>a+(b-a)*r();
const natural=([a,b],r)=>a+(b-a)*(r()+r()+r())/3;
export function traits(r=Math.random){return{thought:between(.85,1.15,r),accuracy:between(-.05,.05,r),improvement:between(.9,1.1,r),input:between(-.1,.1,r)}}
// Replayable randomness makes simultaneous server requests derive the same plan.
export function randomFor(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export function schedule(level,minimum,limit,individual,r=Math.random){
 const p=BOT_PROFILES[level],difficulty=clip(1+(minimum-7)*.035,.93,1.14),scale=Math.min(1,limit/180);
 const firstOptimal=r()<clip(p.firstOptimal+individual.accuracy-(difficulty-1)*.25,.02,.65);
 const optimal=r()<clip(p.optimal+individual.accuracy-(difficulty-1)*.25,.02,.65);
 let error=Math.floor(between(p.error[0],p.error[1]+1,r));if(!optimal)error=Math.max(1,error);if(difficulty>1.05)error++;
 const first=natural(p.first,r)*difficulty*individual.thought*scale;
 const optimalAt=natural(p.optimalTime,r)*difficulty*scale;
 const entries=[{at:first,error:firstOptimal?0:Math.max(1,error)}];let time=first,current=entries[0].error;
 for(let i=0;i<p.max&&current>1;i++){if(r()>p.improve)break;time+=natural(p.gap,r)*individual.improvement*difficulty*scale;current=Math.max(1,current-1-Math.floor(r()*Math.max(1,current-1)));entries.push({at:time,error:current})}
 if(optimal&&!firstOptimal){const at=Math.max(first,optimalAt);while(entries.length&&entries.at(-1).at>=at)entries.pop();entries.push({at,error:0})}
 return entries.filter(e=>e.at<limit-4);
}
// Construct real, validated alternatives by detouring before replaying a valid suffix.
// No zero-length moves are counted. Bound work so six-robot boards remain responsive.
export function candidates(puzzle,solution){
 const found=new Map([[solution.length,solution]]),states=[puzzle.initial.slice()];let pos=states[0].slice();
 for(const m of solution){pos=pos.slice();pos[m>>2]=slide(pos,m>>2,m%4,puzzle.walls);states.push(pos)}
 for(let i=0;i<solution.length;i++)for(let robot=0;robot<pos.length;robot++)for(let d=0;d<4;d++){
  const p=states[i].slice(),to=slide(p,robot,d,puzzle.walls);if(to===p[robot])continue;p[robot]=to;
  const path=[...solution.slice(0,i),robot*4+d,...solution.slice(i)];if(validatePath(puzzle,path))found.set(path.length,path);
  const back=slide(p,robot,(d+2)%4,puzzle.walls);if(back===states[i][robot]){for(let n=1;n<=4;n++){const loop=[...solution.slice(0,i),...Array(n).fill([robot*4+d,robot*4+(d+2)%4]).flat(),...solution.slice(i)];if(validatePath(puzzle,loop))found.set(loop.length,loop)}}
 }
 const base=[...found.values()];for(const route of base){const extra=route.length-solution.length;if(extra<=0)continue;for(let n=2;n<=4;n++){const prefix=route.slice(0,route.length-solution.length);const trial=[...Array(n).fill(prefix).flat(),...solution];if(trial.length<=solution.length+8&&validatePath(puzzle,trial))found.set(trial.length,trial)}}
 return [...found.values()].sort((a,b)=>a.length-b.length);
}
export function makePlan(bot,round,routes){
 const r=randomFor(round.id+bot.id),individual=JSON.parse(bot.bot_traits),minimum=JSON.parse(round.solution_json).length,limit=(round.max_deadline-round.round_start_time)/1000;
 const entries=schedule(bot.bot_level,minimum,limit,individual,r);let last=Infinity,end=0;const plan=[];
 for(const e of entries){const pool=routes.filter(p=>p.length<last&&(e.error===0?p.length===minimum:p.length>minimum));if(!pool.length)continue;pool.sort((a,b)=>Math.abs(a.length-minimum-e.error)-Math.abs(b.length-minimum-e.error));const path=pool[0];
  const intervals=path.map(()=>Math.round(clip(between(.7,1.3,r)+individual.input,.7,1.3)*500)),duration=intervals.reduce((a,b)=>a+b,0);
  const finish=Math.max(e.at*1000,end+duration+1000),start=finish-duration;if(start<1000||finish>=limit*1000)continue;
  plan.push({start:round.round_start_time+start,end:round.round_start_time+finish,path,intervals});end=finish;last=path.length;
 }return plan;
}
