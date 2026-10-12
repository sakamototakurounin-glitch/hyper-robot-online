export const N=16, DELTA=[-16,1,16,-1];

const BASE_LAYOUTS=[
  {
    corners:[[2,2,0,3],[6,1,1,2],[10,3,0,1],[13,1,2,3],[1,6,0,1],[5,5,2,3],[11,6,0,3],[14,5,1,2],[3,10,0,1],[6,13,0,3],[1,14,1,2],[10,10,2,3],[13,12,0,1],[11,14,1,2],[5,9,1,2],[14,9,2,3]],
    segments:[[4,0,1],[11,0,1],[4,15,1],[10,15,1],[0,4,2],[0,11,2],[15,4,2],[15,11,2]]
  },
  {
    corners:[[3,1,2,3],[6,3,0,1],[1,5,1,2],[5,6,0,3],[9,1,1,2],[13,3,2,3],[10,6,0,1],[14,5,0,3],[2,9,2,3],[6,10,0,1],[1,13,1,2],[5,14,0,3],[10,9,0,3],[14,10,2,3],[9,13,1,2],[13,14,0,1]],
    segments:[[2,0,1],[8,0,1],[6,15,1],[13,15,1],[0,2,2],[0,9,2],[15,6,2],[15,13,2]]
  }
];

function transformItem(item,variant){let [x,y,...dirs]=item;if(variant>=4){x=15-x;dirs=dirs.map(d=>d===1?3:d===3?1:d)}for(let i=0;i<variant%4;i++){[x,y]=[15-y,x];dirs=dirs.map(d=>(d+1)%4)}return[x,y,...dirs]}
function buildTheme(base,variant){
  const board=Array(256).fill(0),add=(p,d)=>{board[p]|=1<<d;const q=p+DELTA[d];if(q>=0&&q<256)board[q]|=1<<((d+2)%4)};
  for(let i=0;i<16;i++){add(i,0);add(240+i,2);add(i*16,3);add(i*16+15,1)}
  const corners=base.corners.map(c=>transformItem(c,variant));
  for(const [x,y,a,b] of corners){add(y*16+x,a);add(y*16+x,b)}
  for(const p of [119,120,135,136])for(let d=0;d<4;d++)add(p,d);
  for(const [x,y,d] of base.segments.map(s=>transformItem(s,variant)))add(y*16+x,d);
  return{walls:board,corners};
}

export const wallThemes=BASE_LAYOUTS.flatMap(base=>Array.from({length:8},(_,variant)=>buildTheme(base,variant)));
export const walls=wallThemes[0].walls;
export const corners=wallThemes[0].corners;
export function slide(pos,r,d,board=walls){let p=pos[r];while(!(board[p]&(1<<d))){const q=p+DELTA[d];if(pos.some((v,i)=>i!==r&&v===q))break;p=q}return p}
const pack=p=>{let key=0,m=1;for(const v of p){key+=v*m;m*=256}return key};
const unpack=(key,count)=>{const p=[];for(let i=0;i<count;i++){p.push(key%256);key=Math.floor(key/256)}return p};
export function solve(initial,robot,target,maxDepth=10,board=walls){const count=initial.length,keys=[pack(initial)],parents=[-1],moves=[-1],depth=[0],seen=new Set(keys);for(let h=0;h<keys.length&&keys.length<850000;h++){const p=unpack(keys[h],count);if(robot===-1?p.includes(target):p[robot]===target){const path=[];for(let i=h;parents[i]>=0;i=parents[i])path.push(moves[i]);return path.reverse()}if(depth[h]>=maxDepth)continue;for(let r=0;r<count;r++)for(let d=0;d<4;d++){const to=slide(p,r,d,board);if(to===p[r])continue;const q=p.slice();q[r]=to;const k=pack(q);if(seen.has(k))continue;seen.add(k);keys.push(k);parents.push(h);moves.push(r*4+d);depth.push(depth[h]+1)}}return null}
function randomPositions(count){const banned=new Set([119,120,135,136]);const p=[];while(p.length<count){const v=Math.floor(Math.random()*256);if(!banned.has(v)&&!p.includes(v))p.push(v)}return p}
export function generatePuzzle(theme=0,robotCount=4,rainbowEnabled=false){const rainbow=!!rainbowEnabled&&Math.random()<.167;const count=Math.max(3,Math.min(6,Number(robotCount)||4)),index=Math.max(0,Math.min(wallThemes.length-1,Number(theme)||0)),layout=wallThemes[index],targets=layout.corners.map(c=>c[1]*16+c[0]);for(let attempt=0;attempt<50;attempt++){const initial=randomPositions(count),robot=rainbow?-1:Math.floor(Math.random()*count),target=targets[Math.floor(Math.random()*targets.length)];if(rainbow?initial.includes(target):initial[robot]===target)continue;const solution=solve(initial,robot,target,9,layout.walls);if(solution&&solution.length>=5)return{puzzle:{initial,robot,target,minimum:solution.length,wallTheme:index,walls:layout.walls},solution}}throw new Error('Puzzle generation failed')}
export function validatePath(puzzle,path){if(!Array.isArray(path)||path.length<1||path.length>80)return false;const pos=puzzle.initial.slice(),board=puzzle.walls||walls;for(const m of path){if(!Number.isInteger(m)||m<0||m>=pos.length*4)return false;const r=m>>2,d=m%4,to=slide(pos,r,d,board);if(to===pos[r])return false;pos[r]=to}return puzzle.robot===-1?pos.includes(puzzle.target):pos[puzzle.robot]===puzzle.target}
