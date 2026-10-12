import { generatePuzzle, validatePath, wallThemes } from './engine.js';
import { HTML, CSS, CLIENT } from './ui.js';
import {manageBot,advanceBots} from './bot-controller.js';
import { ICONS } from './icons.js';

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const iconTypes={'favicon.ico':'image/x-icon','icon-32.png':'image/png','icon-152.png':'image/png','icon-167.png':'image/png','icon-180.png':'image/png','icon-192.png':'image/png','icon-512.png':'image/png'};
function iconResponse(name){const raw=atob(ICONS[name]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Response(bytes,{headers:{'content-type':iconTypes[name],'cache-control':'public, max-age=604800, immutable'}})}
const manifest=JSON.stringify({name:'ハイパーロボット ONLINE',short_name:'ハイパーロボット',start_url:'/',display:'standalone',background_color:'#0b121b',theme_color:'#0b121b',icons:[{src:'/icon-192.png?v=2',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'/icon-512.png?v=2',sizes:'512x512',type:'image/png',purpose:'any maskable'}]});
const id=()=>crypto.randomUUID();
const clean=(v,max=24)=>String(v||'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,max);
const roomKey=v=>clean(v,30).normalize('NFKC').toLocaleLowerCase('ja-JP');
const COUNTDOWN_MS=5000,TEMP_EVENT_MS=10000;
const choices={first:[45,60,75,90,105,120],rounds:[3,5,7,10,15,20],limit:[180,240,300,360,420,480,540,600],points:[0,5,10]};
async function body(req){try{return await req.json()}catch{return{}}}
async function auth(db,token){return token?(await db.prepare('SELECT * FROM players WHERE token=?').bind(token).first())||null:null}
async function event(db,roomId,kind,message,now=Date.now()){await db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(roomId,kind,message,now).run()}
const category=n=>n<=1?'solo':n===2?'duel':'multiplayer';
const rankSql='SELECT pr.*,p.name FROM player_rounds pr JOIN players p ON p.id=pr.player_id WHERE pr.round_id=? AND pr.best_moves IS NOT NULL ORDER BY pr.best_moves ASC,pr.best_search_ms ASC,pr.best_at ASC';

async function updateRoundPhase(db,round,now){
  if(round&&round.status==='countdown'&&now>=round.round_start_time){
    await db.prepare("UPDATE rounds SET status='solving' WHERE id=? AND status='countdown'").bind(round.id).run();
    round=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first();
  }
  return round;
}
async function finalize(db,round,room,now){
  if(!round)return round;
  round=await updateRoundPhase(db,round,now);
  if(round.status!=='done'&&(!round.deadline||now<round.deadline))return round;
  const ranked=(await db.prepare(rankSql).bind(round.id).all()).results,winner=ranked[0]||null;
  if(round.status!=='done'){
    const results=ranked.map((r,i)=>({playerId:r.player_id,name:r.name,rank:i+1,bestMoves:r.best_moves,bestSearchMs:r.best_search_ms,optimal:!!r.optimal_found}));
    const done=await db.prepare("UPDATE rounds SET status='done',finalized_at=?,winner_player_id=?,winning_moves=?,result_json=? WHERE id=? AND status!='done'").bind(now,winner?.player_id||null,winner?.best_moves||null,JSON.stringify(results),round.id).run();
    if(done.meta.changes){
      const q=[],awards=new Map(),award=(r,points,reason)=>{const a=awards.get(r.player_id)||{name:r.name,reasons:[]};a.reasons.push(reason+' ＋'+points+'点');awards.set(r.player_id,a)};
      if(winner&&room.win_points){q.push(db.prepare('UPDATE players SET score=score+? WHERE id=?').bind(room.win_points,winner.player_id));award(winner,room.win_points,'1位')}
      if(room.optimal_points)for(const r of ranked)if(r.optimal_found){q.push(db.prepare('UPDATE players SET score=score+? WHERE id=?').bind(room.optimal_points,r.player_id));award(r,room.optimal_points,'最短ボーナス')}
      for(const a of awards.values())q.push(db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(round.room_id,'score',a.name+'：'+a.reasons.join(' / '),now));
      q.push(db.prepare('UPDATE player_rounds SET answering=0 WHERE round_id=?').bind(round.id));
      q.push(db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(round.room_id,'winner',winner?winner.name+'が '+winner.best_moves+'手でラウンド獲得！':'時間切れ',now));
      await db.batch(q);
    }
    round=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first();
  }
  if(!round.stats_updated){
    const guard=await db.prepare('UPDATE rounds SET stats_updated=1 WHERE id=? AND stats_updated=0').bind(round.id).run();
    if(guard.meta.changes){
      const participants=(await db.prepare('SELECT pr.*,COALESCE(p.profile_id,p.id) AS profile_id,p.bot_level FROM player_rounds pr JOIN players p ON p.id=pr.player_id WHERE pr.round_id=?').bind(round.id).all()).results,minimum=JSON.parse(round.solution_json).length;
      for(const r of participants){
        if(r.bot_level)continue;
        const registered=r.best_moves!=null?1:0;
        await db.prepare(`INSERT INTO player_stats(player_id,category,total_rounds,wins,provisional_leader_rounds,registered_round_count,total_optimal_difference,total_first_register_ms,first_register_count,optimal_found_rounds)
          VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,category) DO UPDATE SET
          total_rounds=total_rounds+excluded.total_rounds,wins=wins+excluded.wins,provisional_leader_rounds=provisional_leader_rounds+excluded.provisional_leader_rounds,
          registered_round_count=registered_round_count+excluded.registered_round_count,total_optimal_difference=total_optimal_difference+excluded.total_optimal_difference,
          total_first_register_ms=total_first_register_ms+excluded.total_first_register_ms,first_register_count=first_register_count+excluded.first_register_count,
          optimal_found_rounds=optimal_found_rounds+excluded.optimal_found_rounds`).bind(r.profile_id,round.stats_category,1,winner&&winner.player_id===r.player_id?1:0,r.ever_leader?1:0,registered,registered?r.best_moves-minimum:0,r.first_search_ms||0,r.first_search_ms!=null?1:0,r.optimal_found?1:0).run();
      }
    }
    round=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first();
  }
  if(round.number>=room.total_rounds&&room.status==='playing')await db.prepare("UPDATE rooms SET status='awaiting_finish' WHERE id=?").bind(room.id).run();
  return round;
}
function statsView(rows){
  const out={solo:null,duel:null,multiplayer:null};
  for(const c of Object.keys(out)){
    const r=rows.find(x=>x.category===c)||{total_rounds:0,wins:0,provisional_leader_rounds:0,registered_round_count:0,total_optimal_difference:0,total_first_register_ms:0,first_register_count:0,optimal_found_rounds:0};
    out[c]={rounds:r.total_rounds,wins:r.wins,winRate:r.total_rounds?r.wins/r.total_rounds*100:0,leaderRate:r.total_rounds?r.provisional_leader_rounds/r.total_rounds*100:0,averageDifference:r.registered_round_count?r.total_optimal_difference/r.registered_round_count:0,averageFirstSeconds:r.first_register_count?r.total_first_register_ms/r.first_register_count/1000:0,optimalRate:r.total_rounds?r.optimal_found_rounds/r.total_rounds*100:0};
  }
  return out;
}
async function state(db,player,{botsAdvanced=false}={}){
  const now=Date.now();if(now-player.last_seen>4000)await db.prepare('UPDATE players SET last_seen=? WHERE id=?').bind(now,player.id).run();
  let room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(player.room_id).first();
  let round=room.current_round_id?await db.prepare('SELECT * FROM rounds WHERE id=?').bind(room.current_round_id).first():null;
  if(!botsAdvanced)round=await advanceBots(db,room,round,now,registerAnswer);round=await finalize(db,round,room,now);if(round?.status==='done'&&round.number>=room.total_rounds)room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(player.room_id).first();
  const profileId=player.profile_id||player.id;
  const [playersResult,eventsResult,personalResult,answeringResult,statsResult]=await Promise.all([
    db.prepare('SELECT id,name,is_host,score,last_seen,bot_level FROM players WHERE room_id=? AND last_seen>0 ORDER BY score DESC,joined_at ASC').bind(room.id).all(),
    db.prepare('SELECT id,kind,message,created_at FROM events WHERE room_id=? AND created_at>=? ORDER BY id ASC LIMIT 20').bind(room.id,now-TEMP_EVENT_MS).all(),
    round?db.prepare('SELECT pr.*,p.name FROM player_rounds pr JOIN players p ON p.id=pr.player_id WHERE pr.round_id=? AND pr.best_moves IS NOT NULL ORDER BY pr.best_at ASC').bind(round.id).all():Promise.resolve({results:[]}),
    round?db.prepare('SELECT p.id,p.name FROM player_rounds pr JOIN players p ON p.id=pr.player_id WHERE pr.round_id=? AND pr.answering=1 ORDER BY p.joined_at').bind(round.id).all():Promise.resolve({results:[]}),
    db.prepare('SELECT * FROM player_stats WHERE player_id=?').bind(profileId).all()
  ]);
  const players=playersResult.results,tempEvents=eventsResult.results,personal=personalResult.results,answering=answeringResult.results;
  const ranked=personal.slice().sort((a,b)=>a.best_moves-b.best_moves||a.best_search_ms-b.best_search_ms||a.best_at-b.best_at),leader=ranked[0]||null;
  const liveBest=ranked.map((r,i)=>({playerId:r.player_id,name:r.name,moves:r.best_moves,searchTimeMs:r.best_search_ms,rank:i+1,isLeader:i===0,updatedAt:r.best_at}));
  const stats=statsView(statsResult.results),minimum=round?JSON.parse(round.solution_json).length:null;
  const ranking=room.status==='finished'?players.map((p,i)=>({rank:i+1,id:p.id,name:p.name,score:p.score})):null;
  const lobbyBoard={initial:[34,61,194,221,81,174].slice(0,room.robot_count),walls:wallThemes[room.wall_theme]?.walls||wallThemes[0].walls};
  return{me:{id:player.id,profileId,name:player.name,isHost:!!player.is_host,stats},room:{id:room.id,name:room.name,status:room.status,ranking,lobbyBoard,settings:{firstSubmitSeconds:room.first_submit_seconds,totalRounds:room.total_rounds,roundLimitSeconds:room.round_limit_seconds,showMinimum:!!room.show_minimum,winPoints:room.win_points,optimalPoints:room.optimal_points,robotCount:room.robot_count,rainbowTargets:!!room.rainbow_targets}},players:players.map(p=>({...p,is_host:!!p.is_host,isBot:p.bot_level>0,online:p.bot_level>0||now-p.last_seen<12000})),round:round?{id:round.id,number:round.number,totalRounds:room.total_rounds,status:round.status,gameState:room.status==='finished'?'gameFinished':round.status==='done'?'roundFinished':round.status,puzzle:JSON.parse(round.puzzle_json),roundStartTime:round.round_start_time,deadline:round.deadline,maxDeadline:round.max_deadline,firstSubmitAt:round.first_submit_at,minimum:round.status==='done'||room.show_minimum?minimum:null,winnerPlayerId:round.winner_player_id,winningMoves:round.winning_moves,results:round.result_json?JSON.parse(round.result_json):null,solution:round.status==='done'?JSON.parse(round.solution_json):null}:null,live:{best:liveBest,leader:leader?{playerId:leader.player_id,name:leader.name,moves:leader.best_moves}:null,answering,events:tempEvents},serverNow:Date.now()};
}
async function currentRound(db,player){const room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(player.room_id).first();const round=room.current_round_id?await db.prepare('SELECT * FROM rounds WHERE id=?').bind(room.current_round_id).first():null;return{room,round}}

async function registerAnswer(db,player,room,round,pathMoves,searchMs,now,submissionId=id()){
    const oldLeader=await db.prepare(rankSql+' LIMIT 1').bind(round.id).first(),current=await db.prepare('SELECT * FROM player_rounds WHERE round_id=? AND player_id=?').bind(round.id,player.id).first();
    const better=!current||current.best_moves==null||pathMoves.length<current.best_moves||pathMoves.length===current.best_moves&&searchMs<current.best_search_ms,minimum=JSON.parse(round.solution_json).length;
    // A single D1 transaction claims this attempt and writes every registration effect.
    // The receipt makes retries idempotent, including concurrent polling requests.
    const receipt=id(),owned='EXISTS(SELECT 1 FROM submissions WHERE id=? AND receipt_token=?)';
    const results=await db.batch([
    db.prepare("INSERT OR IGNORE INTO submissions(id,round_id,player_id,moves,path_json,submitted_at,search_time_ms,receipt_token) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rounds WHERE id=? AND status!='done' AND round_start_time<=? AND deadline>?)").bind(submissionId,round.id,player.id,pathMoves.length,JSON.stringify(pathMoves),now,searchMs,receipt,round.id,now,now),
    db.prepare(`INSERT INTO player_rounds(round_id,player_id,best_moves,best_at,best_search_ms,first_moves,first_at,first_search_ms,optimal_found,answering)
      SELECT ?,?,?,?,?,?,?,?,?,0 WHERE ${owned} ON CONFLICT(round_id,player_id) DO UPDATE SET
      best_moves=CASE WHEN best_moves IS NULL OR excluded.best_moves<best_moves OR (excluded.best_moves=best_moves AND excluded.best_search_ms<best_search_ms) THEN excluded.best_moves ELSE best_moves END,
      best_at=CASE WHEN best_moves IS NULL OR excluded.best_moves<best_moves OR (excluded.best_moves=best_moves AND excluded.best_search_ms<best_search_ms) THEN excluded.best_at ELSE best_at END,
      best_search_ms=CASE WHEN best_moves IS NULL OR excluded.best_moves<best_moves OR (excluded.best_moves=best_moves AND excluded.best_search_ms<best_search_ms) THEN excluded.best_search_ms ELSE best_search_ms END,
      first_moves=COALESCE(first_moves,excluded.first_moves),first_at=COALESCE(first_at,excluded.first_at),first_search_ms=COALESCE(first_search_ms,excluded.first_search_ms),
      optimal_found=MAX(optimal_found,excluded.optimal_found),answering=0`).bind(round.id,player.id,pathMoves.length,now,searchMs,pathMoves.length,now,searchMs,pathMoves.length===minimum?1:0,submissionId,receipt),
    db.prepare(`UPDATE rounds SET first_submit_at=?,deadline=MIN(max_deadline,?) WHERE id=? AND (first_submit_at IS NULL OR first_submit_at>?) AND ${owned}`).bind(now,now+room.first_submit_seconds*1000,round.id,now,submissionId,receipt),
    db.prepare(`INSERT INTO events(room_id,kind,message,created_at) SELECT ?,?,?,? WHERE ${owned}`).bind(player.room_id,'submit',player.name+'が '+pathMoves.length+'手の解答を発見',now,submissionId,receipt)
    ]);
    if(!results[0].meta.changes)return false;
    const newLeader=await db.prepare(rankSql+' LIMIT 1').bind(round.id).first();if(newLeader&&(!oldLeader||newLeader.player_id!==oldLeader.player_id)){if(oldLeader)await db.prepare('UPDATE player_rounds SET leader_lost_at=? WHERE round_id=? AND player_id=?').bind(now,round.id,oldLeader.player_id).run();await db.prepare('UPDATE player_rounds SET ever_leader=1,leader_lost_at=NULL WHERE round_id=? AND player_id=?').bind(round.id,newLeader.player_id).run()}
    return better;
}

async function api(req,env,path){
  const db=env.DB;if(!db)return json({error:'データベースに接続できません'},503);
  const data=await body(req),token=req.headers.get('x-player-token')||data.token,profileId=clean(req.headers.get('x-profile-id')||data.profileId,64),now=Date.now();let player=await auth(db,token);
  if(player&&profileId&&!player.profile_id){
    await db.prepare(`INSERT INTO player_stats(player_id,category,total_rounds,wins,provisional_leader_rounds,registered_round_count,total_optimal_difference,total_first_register_ms,first_register_count,optimal_found_rounds)
      SELECT ?,category,total_rounds,wins,provisional_leader_rounds,registered_round_count,total_optimal_difference,total_first_register_ms,first_register_count,optimal_found_rounds FROM player_stats WHERE player_id=?
      ON CONFLICT(player_id,category) DO UPDATE SET total_rounds=total_rounds+excluded.total_rounds,wins=wins+excluded.wins,provisional_leader_rounds=provisional_leader_rounds+excluded.provisional_leader_rounds,registered_round_count=registered_round_count+excluded.registered_round_count,total_optimal_difference=total_optimal_difference+excluded.total_optimal_difference,total_first_register_ms=total_first_register_ms+excluded.total_first_register_ms,first_register_count=first_register_count+excluded.first_register_count,optimal_found_rounds=optimal_found_rounds+excluded.optimal_found_rounds`).bind(profileId,player.id).run();
    await db.batch([db.prepare('DELETE FROM player_stats WHERE player_id=?').bind(player.id),db.prepare('UPDATE players SET profile_id=? WHERE id=?').bind(profileId,player.id)]);player={...player,profile_id:profileId};
  }
  if(path==='/api/room/create'&&req.method==='POST'){
    const name=clean(data.name,16),roomName=clean(data.room,30),key=roomKey(roomName),first=Number(data.firstSubmitSeconds||60),total=Number(data.totalRounds||5),limit=Number(data.roundLimitSeconds||180),showMinimum=data.showMinimum?1:0,winPoints=Number(data.winPoints??5),optimalPoints=Number(data.optimalPoints??0),robotCount=Number(data.robotCount??4),rainbowTargets=data.rainbowTargets?1:0;
    if(!name||!key)return json({error:'名前とルーム名を入力してください'},400);
    if(!choices.first.includes(first)||!choices.rounds.includes(total)||!choices.limit.includes(limit)||!choices.points.includes(winPoints)||!choices.points.includes(optimalPoints)||![3,4,5,6].includes(robotCount))return json({error:'ゲーム設定が正しくありません'},400);
    if(await db.prepare('SELECT id FROM rooms WHERE room_key=?').bind(key).first())return json({error:'そのルーム名は使用中です'},409);
    const roomId=id(),playerId=id(),newToken=id()+id(),newProfileId=profileId||id(),wallTheme=Math.floor(Math.random()*16);
    await db.batch([db.prepare("INSERT INTO rooms(id,room_key,name,status,first_submit_seconds,total_rounds,round_limit_seconds,wall_theme,show_minimum,win_points,optimal_points,robot_count,rainbow_targets,created_at) VALUES(?,?,?,'lobby',?,?,?,?,?,?,?,?,?,?)").bind(roomId,key,roomName,first,total,limit,wallTheme,showMinimum,winPoints,optimalPoints,robotCount,rainbowTargets,now),db.prepare('INSERT INTO players(id,room_id,profile_id,name,token,is_host,score,joined_at,last_seen) VALUES(?,?,?,?,?,1,0,?,?)').bind(playerId,roomId,newProfileId,name,newToken,now,now),db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(roomId,'join',name+'がルームを作成',now)]);
    return json({token:newToken,profileId:newProfileId});
  }
  if(path==='/api/room/join'&&req.method==='POST'){
    const name=clean(data.name,16),key=roomKey(data.room);if(!name||!key)return json({error:'名前とルーム名を入力してください'},400);
    const room=await db.prepare('SELECT * FROM rooms WHERE room_key=?').bind(key).first();if(!room)return json({error:'ルームが見つかりません'},404);
    const duplicate=await db.prepare('SELECT id,last_seen,bot_level FROM players WHERE room_id=? AND name=?').bind(room.id,name).first();if(duplicate&&(duplicate.bot_level||now-duplicate.last_seen<120000))return json({error:'同じ名前のプレイヤーがいます'},409);
    if(duplicate)await db.prepare('DELETE FROM players WHERE id=?').bind(duplicate.id).run();
    const playerId=id(),newToken=id()+id(),newProfileId=profileId||id();await db.batch([db.prepare('INSERT INTO players(id,room_id,profile_id,name,token,is_host,score,joined_at,last_seen) VALUES(?,?,?,?,?,0,0,?,?)').bind(playerId,room.id,newProfileId,name,newToken,now,now),db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(room.id,'join',name+'が参加',now)]);return json({token:newToken,profileId:newProfileId});
  }
  if(!player)return json({error:'ルームに入り直してください'},401);
  if(path.startsWith('/api/bot/')){const result=await manageBot(db,player,path,data,now);return result.error?json({error:result.error},result.status):json(await state(db,player))}
  if(path==='/api/state'&&req.method==='POST')return json(await state(db,player));
  if(path==='/api/leave'&&req.method==='POST'){
    const {round}=await currentRound(db,player);if(round)await db.prepare('UPDATE player_rounds SET answering=0 WHERE round_id=? AND player_id=?').bind(round.id,player.id).run();
    await db.prepare('UPDATE players SET last_seen=0 WHERE id=?').bind(player.id).run();
    const next=await db.prepare('SELECT id,name FROM players WHERE room_id=? AND id!=? AND bot_level=0 AND last_seen>? ORDER BY joined_at ASC LIMIT 1').bind(player.room_id,player.id,now-120000).first();if(player.is_host&&next){await db.prepare('UPDATE players SET is_host=0 WHERE room_id=?').bind(player.room_id).run();await db.prepare('UPDATE players SET is_host=1 WHERE id=?').bind(next.id).run();await event(db,player.room_id,'join',next.name+'がホストになりました',now)}await event(db,player.room_id,'join',player.name+'が退出',now);return json({ok:true});
  }
  if(path==='/api/start'&&req.method==='POST'){
    if(!player.is_host)return json({error:'ルーム作成者だけが開始できます'},403);
    const room=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(player.room_id).first();if(room.status==='finished')return json({error:'設定した全ラウンドが終了しました'},409);
    let previousRainbow=false;if(room.current_round_id){const old=await db.prepare('SELECT status,number,puzzle_json FROM rounds WHERE id=?').bind(room.current_round_id).first();if(old&&old.status!=='done')return json({error:'ラウンド進行中です'},409);if(old&&old.number>=room.total_rounds)return json({error:'設定した全ラウンドが終了しました'},409);previousRainbow=!!old&&JSON.parse(old.puzzle_json).robot===-1}
    let generated;try{generated=generatePuzzle(room.wall_theme,room.robot_count,!!room.rainbow_targets&&!previousRainbow)}catch{return json({error:'問題生成に失敗しました。もう一度押してください'},503)}
    const number=(await db.prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM rounds WHERE room_id=?').bind(room.id).first()).n,roundId=id();
    const active=(await db.prepare('SELECT id FROM players WHERE room_id=? AND (bot_level>0 OR last_seen>?) AND last_seen>0 ORDER BY joined_at').bind(room.id,now-12000).all()).results,count=Math.max(1,active.length),cat=category(count),readyAt=Date.now(),roundStart=readyAt+COUNTDOWN_MS,maxDeadline=roundStart+room.round_limit_seconds*1000;
    const q=[db.prepare("INSERT INTO rounds(id,room_id,number,puzzle_json,solution_json,status,started_at,round_start_time,max_deadline,deadline,participant_count,stats_category) VALUES(?,?,?,?,?,'countdown',?,?,?,?,?,?)").bind(roundId,room.id,number,JSON.stringify(generated.puzzle),JSON.stringify(generated.solution),readyAt,roundStart,maxDeadline,maxDeadline,count,cat),db.prepare("UPDATE rooms SET status='playing',current_round_id=? WHERE id=?").bind(roundId,room.id),db.prepare('INSERT INTO events(room_id,kind,message,created_at) VALUES(?,?,?,?)').bind(room.id,'start','Round '+number+' 開始',readyAt)];
    for(const p of active)q.push(db.prepare('INSERT INTO player_rounds(round_id,player_id) VALUES(?,?)').bind(roundId,p.id));await db.batch(q);return json(await state(db,player));
  }
  if(path==='/api/finish'&&req.method==='POST'){
    if(!player.is_host)return json({error:'ホストだけがゲームを終了できます'},403);
    const {room,round}=await currentRound(db,player);if(!round||round.status!=='done'||round.number<room.total_rounds)return json({error:'全ラウンドがまだ終了していません'},409);
    if(room.status!=='finished'){await db.prepare("UPDATE rooms SET status='finished',room_key=? WHERE id=?").bind('__finished__'+room.id,room.id).run();await event(db,room.id,'finish','ゲーム終了',now)}
    return json(await state(db,player));
  }
  if(path==='/api/attempt'&&req.method==='POST'){
    let {round}=await currentRound(db,player);round=await updateRoundPhase(db,round,now);if(data.roundId&&round?.id!==data.roundId)return json({error:'ラウンドが切り替わりました'},409);if(!round||round.status!=='solving'||now<round.round_start_time||now>=round.deadline)return json({error:'現在は解答できません'},409);
    await db.prepare('INSERT INTO player_rounds(round_id,player_id,answering) VALUES(?,?,1) ON CONFLICT(round_id,player_id) DO UPDATE SET answering=1').bind(round.id,player.id).run();return json({ok:true});
  }
  if(path==='/api/cancel'&&req.method==='POST'){const {round}=await currentRound(db,player);if(round&&(!data.roundId||round.id===data.roundId))await db.prepare('UPDATE player_rounds SET answering=0 WHERE round_id=? AND player_id=?').bind(round.id,player.id).run();return json({ok:true})}
  if(path==='/api/submit'&&req.method==='POST'){
    let {room,round}=await currentRound(db,player);if(!round)return json({error:'ラウンドがありません'},409);if(data.roundId&&round.id!==data.roundId)return json({error:'ラウンドが切り替わりました'},409);await advanceBots(db,room,round,now,registerAnswer);round=await db.prepare('SELECT * FROM rounds WHERE id=?').bind(round.id).first();round=await finalize(db,round,room,now);
    const clear=()=>db.prepare('UPDATE player_rounds SET answering=0 WHERE round_id=? AND player_id=?').bind(round.id,player.id).run();
    if(round.status!=='solving'||now<round.round_start_time||now>=round.deadline){await clear();return json({error:'受付は終了しました'},409)}
    const pathMoves=data.moves;if(!validatePath(JSON.parse(round.puzzle_json),pathMoves)){await clear();return json({error:'ゴールに到達する正しい手順ではありません'},400)}
    const serverElapsed=now-round.round_start_time,searchMs=Math.round(Number(data.searchTimeMs));if(!Number.isFinite(searchMs)||searchMs<0||searchMs>room.round_limit_seconds*1000+5000||Math.abs(searchMs-serverElapsed)>10000){await clear();return json({error:'探索時間を確認できません。もう一度お試しください'},400)}
    const better=await registerAnswer(db,player,room,round,pathMoves,searchMs,now);const out=await state(db,player,{botsAdvanced:true});out.submission={moves:pathMoves.length,personalBest:better};return json(out);
  }
  return json({error:'見つかりません'},404);
}
export default{async fetch(req,env){const u=new URL(req.url);if(u.pathname.startsWith('/api/'))return api(req,env,u.pathname);const iconName=u.pathname==='/apple-touch-icon.png'?'icon-180.png':u.pathname.slice(1);if(iconTypes[iconName]&&ICONS[iconName])return iconResponse(iconName);if(u.pathname==='/manifest.webmanifest')return new Response(manifest,{headers:{'content-type':'application/manifest+json; charset=utf-8','cache-control':'public, max-age=3600'}});if(u.pathname==='/app-v3.css')return new Response(CSS,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'no-cache'}});if(u.pathname==='/app-v3.js')return new Response(CLIENT,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-cache'}});return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}})}};
