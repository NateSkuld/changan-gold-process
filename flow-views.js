import { PLANT_NODES, PLANT_EDGES, PLANT_STAGES } from './plant-flow.js';

// Reading views of the same graph, never additional plant equipment.
export const PROCESS_CIRCUITS = [
  { id:'primary', title:'一段磨浮', description:'格子磨与双螺旋分级 → 溢流磨与旋流分级 → 第一段粗选、精选。', nodeIds:['ore-bin','mill-primary','spiral-classifier','mill-polishing','cyclone-primary','conditioner-1','rougher-1','rougher-2','cleaner-1','cleaner-2','cleaner-3'] },
  { id:'secondary', title:'二段磨浮', description:'粗选Ⅱ后矿浆 → 第二段磨矿分级 → 粗选Ⅲ、Ⅳ与两次扫选、精选Ⅳ、Ⅴ。', nodeIds:['rougher-2','mill-secondary','cyclone-secondary','conditioner-3','rougher-3','rougher-4','scavenger-1','scavenger-2','cleaner-4','cleaner-5'] },
  { id:'regrind', title:'中矿再磨', description:'Φ150 与 JM1500 闭路 → 再磨再选 → 精选Ⅳ、Ⅴ；暂定中矿来路保留虚线。', nodeIds:['cyclone-regrind','stirred-mill','regrind-flotation','cleaner-4','cleaner-5'] },
  { id:'recovery', title:'精尾矿脱水', description:'精选Ⅲ / Ⅴ → 浓密 → 压滤 → 精矿库；澄清与滤液汇入回水，尾矿另行浓密。', nodeIds:['cleaner-3','cleaner-5','concentrate-thickener','lamella-group','filter-press','concentrate-storage','tailings-thickener','tailings-storage','return-water'] },
];
const NODE_BY_ID=new Map(PLANT_NODES.map(node=>[node.id,node]));
const xy=(x,z)=>[x,0,z];
const LAYOUTS={
  primary:{'ore-bin':xy(-9,-6),'mill-primary':xy(-3,-6),'spiral-classifier':xy(-3,0),'mill-polishing':xy(3,-6),'cyclone-primary':xy(3,0),'conditioner-1':xy(9,0),'rougher-1':xy(9,6),'rougher-2':xy(15,6),'cleaner-1':xy(3,6),'cleaner-2':xy(-3,6),'cleaner-3':xy(-9,6)},
  secondary:{'rougher-2':xy(-9,-6),'cyclone-secondary':xy(-3,-6),'mill-secondary':xy(-3,0),'conditioner-3':xy(3,-6),'rougher-3':xy(9,-6),'rougher-4':xy(9,0),'scavenger-1':xy(9,6),'scavenger-2':xy(3,6),'cleaner-4':xy(3,0),'cleaner-5':xy(-3,6)},
  regrind:{'cyclone-regrind':xy(-3,-3),'stirred-mill':xy(-3,3),'regrind-flotation':xy(3,-3),'cleaner-4':xy(3,3),'cleaner-5':xy(9,3)},
  recovery:{'cleaner-3':xy(-12,-3),'cleaner-5':xy(-12,3),'concentrate-thickener':xy(-6,0),'lamella-group':xy(-6,-6),'filter-press':xy(0,0),'concentrate-storage':xy(6,0),'tailings-thickener':xy(-6,7),'tailings-storage':xy(0,7),'return-water':xy(6,-6)},
  grinding:{'mill-primary':xy(-8,3),'spiral-classifier':xy(-8,-3),'mill-polishing':xy(0,3),'cyclone-primary':xy(0,-3),'mill-secondary':xy(8,3),'cyclone-secondary':xy(8,-3)},
  flotation:{'conditioner-1':xy(-12,-6),'rougher-1':xy(-6,-6),'rougher-2':xy(0,-6),'cleaner-1':xy(-6,0),'cleaner-2':xy(-6,6),'cleaner-3':xy(0,6),'conditioner-3':xy(6,-6),'rougher-3':xy(6,0),'rougher-4':xy(12,0),'scavenger-1':xy(12,-6),'scavenger-2':xy(18,-6),'cleaner-4':xy(12,6),'cleaner-5':xy(6,6)},
  regrinding:{'stirred-mill':xy(-3,3),'cyclone-regrind':xy(-3,-3),'regrind-flotation':xy(3,-3)},
  dewatering:{'concentrate-thickener':xy(-6,0),'lamella-group':xy(-6,-6),'filter-press':xy(0,0),'concentrate-storage':xy(6,0)},
  water:{'tailings-thickener':xy(-6,0),'tailings-storage':xy(0,0),'return-water':xy(6,0)},
};
export function resolveFlowView({stage='all',circuit=null}={}){
  const chosen=circuit?PROCESS_CIRCUITS.find(item=>item.id===circuit):null;
  if(circuit&&!chosen)throw new RangeError(`Unknown process circuit: ${circuit}`);
  if(!circuit&&stage!=='all'&&!PLANT_STAGES.some(item=>item.id===stage))throw new RangeError(`Unknown plant stage: ${stage}`);
  const activeNodes=chosen?chosen.nodeIds.map(id=>NODE_BY_ID.get(id)):stage==='all'?[...PLANT_NODES]:PLANT_NODES.filter(node=>node.stage===stage);
  const ids=new Set(activeNodes.map(node=>node.id)),layout=LAYOUTS[circuit||stage]||{};
  const positions=new Map(activeNodes.map(node=>[node.id,[...(layout[node.id]||node.position)]]));
  const edges=PLANT_EDGES.filter(edge=>ids.has(edge.from)||ids.has(edge.to)),boundaryById=new Map();
  for(const edge of edges){
    if(ids.has(edge.from)&&ids.has(edge.to))continue;
    const incoming=ids.has(edge.to),id=incoming?edge.from:edge.to;
    if(!boundaryById.has(id))boundaryById.set(id,{id,node:NODE_BY_ID.get(id),incoming:false,outgoing:false,edges:[],peers:[]});
    const item=boundaryById.get(id);item[incoming?'incoming':'outgoing']=true;item.edges.push(edge);item.peers.push(incoming?edge.to:edge.from);
  }
  const activePositions=[...positions.values()],minX=Math.min(...activePositions.map(p=>p[0])),maxX=Math.max(...activePositions.map(p=>p[0])),minZ=Math.min(...activePositions.map(p=>p[2])),maxZ=Math.max(...activePositions.map(p=>p[2]));
  const boundaries=[...boundaryById.values()];
  for(const side of ['left','right']){
    const items=boundaries.filter(item=>(item.incoming?'left':'right')===side);
    items.sort((a,b)=>a.peers.reduce((s,id)=>s+positions.get(id)[2],0)/a.peers.length-b.peers.reduce((s,id)=>s+positions.get(id)[2],0)/b.peers.length||a.id.localeCompare(b.id));
    const span=Math.max(maxZ-minZ,(items.length-1)*2.7),center=(minZ+maxZ)/2;
    items.forEach((item,index)=>{
      item.position=[side==='left'?minX-4.1:maxX+4.1,0,items.length===1?center:center-span/2+index*span/(items.length-1)];
      item.direction=item.incoming&&item.outgoing?'both':item.incoming?'incoming':'outgoing';item.uncertain=item.edges.some(edge=>edge.uncertain);
      item.label=`${item.direction==='both'?'往返':item.incoming?'来自':'去往'} · ${item.node.label}${item.uncertain?' · 含待核对':''}`;
      item.detail=item.edges.map(edge=>`${NODE_BY_ID.get(edge.from).label} → ${NODE_BY_ID.get(edge.to).label}${edge.label?'：'+edge.label:''}${edge.uncertain&&!edge.label?.includes('待核对')?' · 待核对':''}`).join('；');
      positions.set(item.id,[...item.position]);
    });
  }
  return{id:circuit||stage,kind:circuit?'circuit':'stage',title:chosen?.title||PLANT_STAGES.find(item=>item.id===stage)?.name||'选厂全景',activeNodes,boundaries,positions,edges};
}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function simplify(points){return points.filter((p,i)=>!i||distance(p,points[i-1])>.001).filter((p,i,all)=>!i||i===all.length-1||Math.abs((p[0]-all[i-1][0])*(all[i+1][1]-p[1])-(p[1]-all[i-1][1])*(all[i+1][0]-p[0]))>.001);}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],s=dx*dx+dz*dz,t=s?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/s)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
function trim(points,startRadius,endRadius){
  const result=simplify(points).map(p=>[...p]);if(result.length<2||distance(result[0],result[1])<startRadius+.3||distance(result.at(-1),result.at(-2))<endRadius+.3)return null;
  for(const[i,j,r]of [[0,1,startRadius],[result.length-1,result.length-2,endRadius]]){const d=distance(result[i],result[j]);result[i][0]+=(result[j][0]-result[i][0])*r/d;result[i][1]+=(result[j][1]-result[i][1])*r/d;}
  return result;
}
const HEIGHTS={main:.42,return:1.12,concentrate:.7,tailings:.4,water:.28};
// Geometry only: these heights separate streams, never assert surveyed elevations.
export function routeFlowEdges(view){
  const boundaryIds=new Set(view.boundaries.map(item=>item.id));
  const obstacles=[...view.positions].map(([id,p])=>({id,p:[p[0],p[2]],radius:boundaryIds.has(id)?.75:1.95}));
  const xs=obstacles.map(item=>item.p[0]),zs=obstacles.map(item=>item.p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const laneValues=values=>{const unique=[...new Set(values)].sort((a,b)=>a-b),lanes=[unique[0]-2.4,unique.at(-1)+2.4];unique.forEach((value,index)=>{if(index&&value-unique[index-1]>2.2)lanes.push((value+unique[index-1])/2);});return lanes;};
  const xLanes=laneValues(xs),zLanes=laneValues(zs),routes=[];
  const ordered=[...view.edges].sort((a,b)=>(a.kind==='return')-(b.kind==='return'));
  for(const edge of ordered){
    const s3=view.positions.get(edge.from),t3=view.positions.get(edge.to),s=[s3[0],s3[2]],t=[t3[0],t3[2]],sr=boundaryIds.has(edge.from)?.62:1.72,tr=boundaryIds.has(edge.to)?.62:1.72,laneHeight=HEIGHTS[edge.kind]??.42;
    const heightFor=(id,start)=>{
      if(boundaryIds.has(id))return .62;
      const type=NODE_BY_ID.get(id).type;
      if(type==='cyclone')return start&&edge.kind==='main'?2.65:start&&edge.kind==='return'?.6:2.15;
      // Symbol ports explain high overflow / low underflow. These are diagram
      // coordinates, not measured plant pipe elevations or manufacturer dimensions.
      if(type==='thickener')return start?(edge.kind==='water'?1.45:.4):1.15;
      if(type==='filter')return start?(edge.kind==='water'?.45:.4):1.3;
      if(type==='lamella')return start?(edge.kind==='water'?1.5:.4):1.35;
      if(type==='water')return 1.1;
      if(type==='storage'&&edge.from==='filter-press')return .4;
      return edge.kind==='concentrate'?1.5:.8;
    };
    if(edge.via?.length){
      const via=edge.via.map(p=>p.length>=3?[...p]:[p[0],laneHeight,p[1]]),sd=[via[0][0]-s[0],via[0][2]-s[1]],td=[via.at(-1)[0]-t[0],via.at(-1)[2]-t[1]],sl=Math.hypot(...sd)||1,tl=Math.hypot(...td)||1;
      routes.push({edge,points:[[s[0]+sd[0]*sr/sl,heightFor(edge.from,true),s[1]+sd[1]*sr/sl],...via,[t[0]+td[0]*tr/tl,heightFor(edge.to,false),t[1]+td[1]*tr/tl]],boundary:boundaryIds.has(edge.from)||boundaryIds.has(edge.to)});continue;
    }
    const candidates=[];
    if(edge.kind!=='return')candidates.push([s,t],[s,[s[0],t[1]],t],[s,[t[0],s[1]],t]);
    for(const x of xLanes)candidates.push([s,[x,s[1]],[x,t[1]],t]);for(const z of zLanes)candidates.push([s,[s[0],z],[t[0],z],t]);
    for(const x of [minX-2.4,maxX+2.4])for(const z of [minZ-2.4,maxZ+2.4])candidates.push([s,[x,s[1]],[x,z],[t[0],z],t],[s,[s[0],z],[x,z],[x,t[1]],t]);
    let best=null,bestScore=Infinity;
    for(const candidate of candidates){
      const path=trim(candidate,sr,tr);if(!path||edge.kind==='return'&&path.length<3)continue;let score=(path.length-2)*.25;
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i];score+=distance(a,b);
        for(const o of obstacles){if(i===1&&o.id===edge.from||i===path.length-1&&o.id===edge.to)continue;if(segmentDistance(o.p,a,b)<o.radius)score+=1000;}
        for(const previous of routes)for(let j=1;j<previous.points.length;j++){
          const pa=[previous.points[j-1][0],previous.points[j-1][2]],pb=[previous.points[j][0],previous.points[j][2]];
          if(segmentDistance([(a[0]+b[0])/2,(a[1]+b[1])/2],pa,pb)<.3&&segmentDistance([(pa[0]+pb[0])/2,(pa[1]+pb[1])/2],a,b)<.3)score+=12;
        }
      }
      if(score<bestScore){best=path;bestScore=score;}
    }
    best ||= trim([s,t],sr,tr)||[s,t];
    const points=best.map((p,i)=>[p[0],i===0?heightFor(edge.from,true):i===best.length-1?heightFor(edge.to,false):laneHeight,p[1]]);
    if(points.length===2)points.splice(1,0,[(points[0][0]+points[1][0])/2,laneHeight,(points[0][2]+points[1][2])/2]);
    routes.push({edge,points,boundary:boundaryIds.has(edge.from)||boundaryIds.has(edge.to)});
  }
  return view.edges.map(edge=>routes.find(route=>route.edge===edge));
}
