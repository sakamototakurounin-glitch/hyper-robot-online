import {traits,candidates,makePlan} from './bots.js';
import {validatePath,slide} from './engine.js';
export async function manageBot(db,host,path,data,now){
 const fail=(error,status=409)=>({error,status});
 if(!host.is_host)return fail('ホストだけがボットを管理できます',403);
 const room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(host.room_id).first();
 if(room.status!=='lobby'||room.current_round_id)return fail('ボットはゲーム開始前のロビーでのみ変更できます');
 if(!['/api/bot/add','/api/bot/remove','/api/bot/level'].includes(path))return fail('操作が見つかりません',404);
 const level=Number(data.level);if(path!=='/api/bot/remove'&&![1,2,3,4,5].includes(level))return fail('強さを選択してください',400);
 const allowed="EXISTS(SELECT 1 FROM rooms r JOIN players h ON h.room_id=r.id WHERE r.id=? AND h.id=? AND h.is_host=1 AND h.last_seen>0 AND r.status='lobby' AND r.current_round_id IS NULL)";
 let changed;
 if(path==='/api/bot/add'){
  const botId=crypto.randomUUID();
  changed=await db.prepare(`INSERT INTO players(id,room_id,name,token,is_host,score,joined_at,last_seen,bot_level,bot_traits) SELECT ?,?,'Bot '||(SELECT COALESCE(MAX(CAST(substr(name,5) AS INTEGER)),0)+1 FROM players WHERE room_id=? AND name LIKE 'Bot %'),?,0,0,?,?,?,? WHERE ${allowed}`).bind(botId,room.id,room.id,crypto.randomUUID()+crypto.randomUUID(),now,now,level,JSON.stringify(traits()),room.id,host.id).run();
 }else{
  const bot=await db.prepare('SELECT * FROM players WHERE id=? AND room_id=? AND bot_level>0 AND last_seen>0').bind(data.botId,room.id).first();if(!bot)return fail('ボットが見つかりません',404);
  if(path==='/api/bot/remove')changed=await db.prepare(`UPDATE players SET last_seen=0 WHERE id=? AND ${allowed}`).bind(bot.id,room.id,host.id).run();
  else changed=await db.prepare(`UPDATE players SET bot_level=? WHERE id=? AND ${allowed}`).bind(level,bot.id,room.id,host.id).run();
 }return changed.meta.changes?{ok:true}:fail('ボットはゲーム開始前のロビーでのみ変更できます');
}
export async function advanceBots(db,room,round,now,register){
 if(!round||round.status==='done'||now<round.round_start_time)return round;
 const bots=(await db.prepare('SELECT p.*,pr.best_moves,pr.first_at,pr.optimal_found,pr.answering,br.plan_json,br.think_json FROM players p JOIN player_rounds pr ON pr.player_id=p.id LEFT JOIN bot_rounds br ON br.player_id=p.id AND br.round_id=pr.round_id WHERE pr.round_id=? AND p.bot_level>0 AND p.last_seen>0').bind(round.id).all()).results;
 if(!bots.length)return round;
 let routes;const all=[];
 for(const bot of bots){
  let saved=bot.plan_json?bot:null;
  if(!saved){routes??=candidates(JSON.parse(round.puzzle_json),JSON.parse(round.solution_json));const plan=makePlan(bot,round,routes);await db.prepare('INSERT OR IGNORE INTO bot_rounds(round_id,player_id,plan_json) VALUES(?,?,?)').bind(round.id,bot.id,JSON.stringify(plan)).run();saved=await db.prepare('SELECT plan_json FROM bot_rounds WHERE round_id=? AND player_id=?').bind(round.id,bot.id).first()}
  JSON.parse(saved.plan_json).forEach((entry,i)=>all.push({...entry,bot,key:'bot:'+round.id+':'+bot.id+':'+i}));
 }
 all.sort((a,b)=>a.end-b.end||a.key.localeCompare(b.key));
 let current=round;
 for(const e of all){if(e.end>now||e.bot.best_moves!=null&&e.bot.best_moves<=e.path.length)continue;
  current=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first();
  if(current.status==='done'||e.end>=current.deadline||e.start<current.round_start_time)continue;
  const best=await db.prepare('SELECT best_moves FROM player_rounds WHERE round_id=? AND player_id=?').bind(round.id,e.bot.id).first();if(best?.best_moves!=null&&best.best_moves<=e.path.length)continue;
  if(validatePath(JSON.parse(round.puzzle_json),e.path)){await register(db,e.bot,room,current,e.path,e.end-round.round_start_time,e.end,e.key);Object.assign(e.bot,await db.prepare('SELECT best_moves,first_at,optimal_found,answering FROM player_rounds WHERE round_id=? AND player_id=?').bind(round.id,e.bot.id).first());current=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first()}
 }
 const updates=[];
 for(const bot of bots){const pending=all.filter(e=>e.bot.id===bot.id&&e.end>now&&e.end<current.deadline&&(bot.best_moves==null||e.path.length<bot.best_moves)),entry=pending[0],typing=current.status!=='done'&&now<current.deadline&&entry&&entry.start<=now;
  if(Number(bot.answering)!==(typing?1:0))updates.push(db.prepare("UPDATE player_rounds SET answering=CASE WHEN ?=1 AND (best_moves IS NULL OR best_moves>?) AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND status!='done' AND deadline>?) THEN 1 ELSE 0 END WHERE round_id=? AND player_id=?").bind(typing?1:0,entry?.path.length??0,round.id,now,round.id,bot.id));
  const best=bot;
  let step=0,positions=null;
  if(typing){const puzzle=JSON.parse(round.puzzle_json);positions=puzzle.initial.slice();let elapsed=entry.start;for(const interval of entry.intervals){elapsed+=interval;if(elapsed>now)break;const move=entry.path[step++];positions[move>>2]=slide(positions,move>>2,move%4,puzzle.walls)}}
  const think={botId:bot.id,displayName:bot.name,level:bot.bot_level,isBot:true,individualSkillModifier:JSON.parse(bot.bot_traits),botThinkingStartTime:round.round_start_time,currentBestMoves:best?.best_moves??null,firstRegisterTime:best?.first_at??null,optimalFound:!!best?.optimal_found,currentCandidate:entry?.path??null,nextThinkTime:entry?.start??null,answerState:typing?{status:'input',step,positions}: {status:current.status==='done'||now>=current.deadline?'ended':'thinking'}};
  const thinkJson=JSON.stringify(think);if(bot.think_json!==thinkJson)updates.push(db.prepare('UPDATE bot_rounds SET think_json=?,updated_at=? WHERE round_id=? AND player_id=? AND updated_at<=?').bind(thinkJson,now,round.id,bot.id,now));
 }
 if(updates.length)await db.batch(updates);
 return current;
}
