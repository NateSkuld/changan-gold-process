import * as THREE from 'three';
import { PLANT_NODES, PLANT_EDGES } from './plant-flow.js';

export const FLOW_FOCUS_OPTIONS=[
  {id:'all',label:'全部矿流',description:'追踪已确认的矿浆输送、返砂与精矿分支；待核对连接保留虚线。'},
  {id:'grinding',label:'磨矿返砂',description:'观察磨机排浆进入分级，以及螺旋返砂、旋流器底流返回磨机的闭路。'},
  {id:'overflow',label:'分级溢流',description:'沿螺旋与旋流器溢流，追踪调浆桶和浮选入口。'},
  {id:'concentrate',label:'泡沫精矿',description:'沿已确认的泡沫精矿分支，追踪逐级精选与浓密入口。'},
  {id:'dewatering',label:'精矿脱水',description:'精选Ⅲ、Ⅴ精矿进入浓密，浓密与斜板底流进入压滤；末段滤饼以静态箭头指向精矿库。'},
  {id:'water',label:'澄清与回水',description:'沿展板已有水路，观察浓密溢流进入斜板，以及斜板末端溢流、压滤滤液和尾矿浓密溢流水汇入高位水池。'},
];
const NODES=new Map(PLANT_NODES.map(node=>[node.id,node]));
const key=edge=>`${edge.from}>${edge.to}`;
const GRINDING=new Set([
  'mill-primary>spiral-classifier','spiral-classifier>mill-primary',
  'mill-polishing>cyclone-primary','cyclone-primary>mill-polishing',
  'mill-secondary>cyclone-secondary','cyclone-secondary>mill-secondary',
  'stirred-mill>cyclone-regrind','cyclone-regrind>stirred-mill',
]);
const OVERFLOW=new Set([
  'spiral-classifier>cyclone-primary','cyclone-primary>conditioner-1','conditioner-1>rougher-1',
  'cyclone-secondary>conditioner-3','conditioner-3>rougher-3','cyclone-regrind>regrind-flotation',
]);
const DEWATERING=new Set([
  'cleaner-3>concentrate-thickener','cleaner-5>concentrate-thickener',
  'concentrate-thickener>filter-press','lamella-group>filter-press',
  'filter-press>concentrate-storage',
]);
const CAKE_ROUTE='filter-press>concentrate-storage';
export const WATER_FLOW_COLOR=0x65bed2;
const WET_SOURCE_TYPES=new Set(['mill','spiral','cyclone','conditioning','flotation','stirred','thickener','lamella']);
const SOURCE_EDGES=new Map(PLANT_EDGES.map(edge=>[key(edge),edge]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function optionFor(id){const option=FLOW_FOCUS_OPTIONS.find(item=>item.id===id);if(!option)throw new RangeError(`Unknown slurry focus: ${id}`);return option;}
function isConfirmedEdge(edge){const source=SOURCE_EDGES.get(key(edge));return !!source&&!source.uncertain&&!edge.uncertain&&source.kind===edge.kind;}
export function isSlurryEdge(edge){
  // Ore conveyors, filter cake and clarified water remain context, not animated slurry pipes.
  return isConfirmedEdge(edge)&&edge.kind!=='water'&&WET_SOURCE_TYPES.has(NODES.get(edge.from)?.type);
}
export function flowMediumForEdge(edge){
  if(!isConfirmedEdge(edge))return 'context';
  if(key(edge)===CAKE_ROUTE)return 'solid';
  if(edge.kind==='water')return 'water';
  return isSlurryEdge(edge)?'slurry':'context';
}
export function selectFlowEdges(edges,id='all'){
  optionFor(id);
  return edges.filter(edge=>{
    if(id==='dewatering')return isConfirmedEdge(edge)&&DEWATERING.has(key(edge));
    if(id==='water')return isConfirmedEdge(edge)&&edge.kind==='water';
    return isSlurryEdge(edge)&&(id==='all'||id==='grinding'&&GRINDING.has(key(edge))||id==='overflow'&&OVERFLOW.has(key(edge))||id==='concentrate'&&edge.kind==='concentrate'&&NODES.get(edge.from)?.type==='flotation');
  });
}
export function describeFlowFocus(edges,id='all'){
  const selected=selectFlowEdges(edges,id);
  return{...optionFor(id),unitLabel:'条路径',confirmedCount:selected.length,selectedCount:selected.length,slurryCount:selected.filter(isSlurryEdge).length,waterCount:selected.filter(edge=>flowMediumForEdge(edge)==='water').length,solidCount:selected.filter(edge=>flowMediumForEdge(edge)==='solid').length,visibleConfirmedCount:edges.filter(edge=>!edge.uncertain).length,visibleSlurryCount:selectFlowEdges(edges,'all').length,uncertainCount:edges.filter(edge=>edge.uncertain).length,visibleEdgeCount:edges.length,selectedEdgeKeys:selected.map(key),empty:selected.length===0};
}
export function slurryMotionSettings(length,extent=24,focused=false){
  const spacing=clamp(extent*.085,2.4,4.8);
  return{count:clamp(Math.ceil(Math.max(0,length)/spacing),2,14),spacing,speed:focused?1.65:1.35,pulseLength:clamp(spacing*.18,.34,.7),radius:focused?.085:.067};
}

// A bounded set of instance batches adds no draw call per pipe segment or moving slug.
// All animations are derived from the caller's time; paused calls reproduce the same pose.
export function createSlurryFlowLayer(){
  const group=new THREE.Group();group.name='矿浆流向';group.userData.labelObstacle=false;
  const capacity=PLANT_EDGES.length*16;
  const pipeGeometry=new THREE.CylinderGeometry(1,1,1,6,1,true);
  const pulseGeometry=new THREE.CylinderGeometry(1,1,1,6,1,false);
  const arrowGeometry=new THREE.ConeGeometry(1,1,5);
  const pipeMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.35,depthWrite:false});
  const pulseMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  const arrowMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,depthWrite:false});
  const pipes=new THREE.InstancedMesh(pipeGeometry,pipeMaterial,capacity),pulses=new THREE.InstancedMesh(pulseGeometry,pulseMaterial,capacity),arrows=new THREE.InstancedMesh(arrowGeometry,arrowMaterial,capacity);
  pipes.name='已确认矿浆细管';pulses.name='矿浆流动短节';arrows.name='矿浆方向箭头';
  for(const batch of[pipes,pulses,arrows]){batch.count=0;batch.frustumCulled=false;batch.raycast=()=>{};batch.userData.labelObstacle=false;group.add(batch);}
  pulses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),color=new THREE.Color(),white=new THREE.Color(0xe7f7ef),contextColor=new THREE.Color(0x20332d);
  let links=[],extent=24,focus='all',info=describeFlowFocus([]),moving=[],time=0,disposed=false;
  function place(batch,index,a,b,radius){
    if(index>=capacity)return index;
    direction.subVectors(b,a);const length=direction.length();if(length<1e-6)return index;
    dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));dummy.scale.set(radius,length,radius);dummy.updateMatrix();batch.setMatrixAt(index,dummy.matrix);return index+1;
  }
  function dirty(batch){batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
  function applyFocus(){
    const edges=links.map(item=>item.edge),selected=new Set(selectFlowEdges(edges,focus));info=describeFlowFocus(edges,focus);moving=[];
    let pi=0,ai=0;
    for(const item of links){
      const active=selected.has(item.edge),focused=active&&focus!=='all',uncertain=!!item.edge.uncertain;
      const medium=flowMediumForEdge(item.edge),baseColor=new THREE.Color(medium==='water'?WATER_FLOW_COLOR:item.color),length=item.curve.getLength();
      item.line.material.opacity=uncertain?(focus==='all'?.58:.34):active?(focused?.95:.83):(focus==='all'?.38:.12);
      item.line.material.color.copy(baseColor);item.line.userData.flowFocused=active;item.line.userData.flowMedium=medium;
      const arrowCount=clamp(Math.ceil(length/(focused?2.6:3.7)),2,14);
      for(let j=0;j<arrowCount&&ai<capacity;j++){
        const t=(j+.65)/(arrowCount+.3);dummy.position.copy(item.curve.getPoint(t));dummy.quaternion.setFromUnitVectors(up,item.curve.getTangent(t).normalize());
        dummy.scale.set(active?(focused?.15:.12):.075,active?(focused?.48:.4):.28,active?(focused?.15:.12):.075);dummy.updateMatrix();arrows.setMatrixAt(ai,dummy.matrix);
        color.copy(baseColor);if(active)color.lerp(white,.13);else color.lerp(contextColor,uncertain?.3:focus==='all'?.27:.72);arrows.setColorAt(ai++,color);
      }
      // A filter cake is a solid product. Its existing route gets clear static
      // arrows, never a liquid pipe or a moving liquid slug.
      if(!active||medium==='solid')continue;
      // Reuse the proven non-overlapping centerline; this shell is only 0.045–0.06 wide.
      const points=item.points||item.curve.getPoints(24),radius=focused?.06:.045;
      for(let j=1;j<points.length;j++){
        const old=pi;pi=place(pipes,pi,points[j-1],points[j],radius);if(pi>old)pipes.setColorAt(old,baseColor);
      }
      const settings=slurryMotionSettings(length,extent,focused);
      moving.push({item,length,settings,medium,color:baseColor.getHex(),phase:((PLANT_EDGES.findIndex(edge=>edge===item.edge)+1)*.173)%1});
    }
    pipes.count=pi;arrows.count=ai;dirty(pipes);dirty(arrows);
    const liquidKeys=moving.map(entry=>key(entry.item.edge));
    pipes.userData.edgeKeys=[...liquidKeys];pulses.userData.edgeKeys=[...liquidKeys];
    info={...info,movingSegmentCount:moving.reduce((sum,entry)=>sum+entry.settings.count,0),movingEdgeCount:moving.length,pipeSegmentCount:pi};
    group.userData={labelObstacle:false,focusId:focus,selectedEdgeKeys:[...info.selectedEdgeKeys]};
    update(time);return{...info,selectedEdgeKeys:[...info.selectedEdgeKeys]};
  }
  function setLinks(next,{viewExtent=24}={}){links=next;extent=viewExtent;focus='all';return applyFocus();}
  function setFocus(id){optionFor(id);focus=id;return applyFocus();}
  function update(nextTime){
    if(disposed)return;time=Number.isFinite(nextTime)?nextTime:time;let i=0;
    for(const entry of moving){
      const{item,length,settings,phase}=entry;if(length<.001)continue;
      for(let j=0;j<settings.count&&i<capacity;j++){
        const t=((time*settings.speed/length+phase+j/settings.count)%1+1)%1;
        const end=Math.min(1,t+settings.pulseLength/length),a=item.curve.getPoint(t),b=item.curve.getPoint(end),old=i;
        i=place(pulses,i,a,b,settings.radius);
        if(i>old){color.setHex(entry.color).lerp(white,entry.medium==='water'?.2:.35);pulses.setColorAt(old,color);}
      }
    }
    pulses.count=i;dirty(pulses);
  }
  function reset(){links=[];moving=[];focus='all';info=describeFlowFocus([]);pipes.count=pulses.count=arrows.count=0;pipes.userData.edgeKeys=[];pulses.userData.edgeKeys=[];group.userData={labelObstacle:false,focusId:'all',selectedEdgeKeys:[]};}
  function dispose(){if(disposed)return;reset();disposed=true;group.removeFromParent();for(const geometry of[pipeGeometry,pulseGeometry,arrowGeometry])geometry.dispose();for(const material of[pipeMaterial,pulseMaterial,arrowMaterial])material.dispose();}
  return{group,setLinks,setFocus,update,reset,dispose,get focusInfo(){return{...info,selectedEdgeKeys:[...info.selectedEdgeKeys]};}};
}
