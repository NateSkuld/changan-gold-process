import * as THREE from 'three';
import { createCrushingScene } from './crushing-scene.js';
import { createPlantSymbol } from './models/auxiliary.js';
import { PLANT_NODES } from './plant-flow.js';
import { resolveFlowView, routeFlowEdges } from './flow-views.js';
import { createSlurryFlowLayer } from './slurry-flow.js';
import { createTourHighlight } from './tour-highlight.js';

export const FLOW_COLORS={main:0xc9b27c,return:0x5cb8a2,concentrate:0xe4bb61,tailings:0x718a83,water:0x6baecc};
export function createPlantScene(){
  const group=new THREE.Group(),genericGroup=new THREE.Group(),nodeLayer=new THREE.Group(),linkLayer=new THREE.Group(),boundaryLayer=new THREE.Group();
  group.add(genericGroup);genericGroup.add(nodeLayer,linkLayer,boundaryLayer);
  const nodeObjects=new Map();
  const baseMaterial=new THREE.MeshStandardMaterial({color:0x17342f,roughness:.8}),ringMaterial=new THREE.LineBasicMaterial({color:0x4e7563,transparent:true,opacity:.5});
  const baseGeometry=new THREE.CylinderGeometry(1.78,1.86,.13,24),ringGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:49},(_,i)=>new THREE.Vector3(Math.cos(i/48*Math.PI*2)*1.8,.01,Math.sin(i/48*Math.PI*2)*1.8)));
  for(const node of PLANT_NODES){
    const holder=new THREE.Group();holder.position.set(...node.position);holder.userData.nodeId=node.id;
    const symbol=createPlantSymbol(node.type,node);symbol.scale.setScalar(.9);holder.add(symbol);
    const base=new THREE.Mesh(baseGeometry,baseMaterial);base.position.y=-.13;holder.add(base);holder.add(new THREE.Line(ringGeometry,ringMaterial));nodeLayer.add(holder);nodeObjects.set(node.id,holder);
  }
  const boundaryGeometry=new THREE.CylinderGeometry(.52,.52,.22,6),boundaryPostGeometry=new THREE.CylinderGeometry(.045,.045,.46,8);
  const boundaryMaterial=new THREE.MeshStandardMaterial({color:0x526f68,metalness:.3,roughness:.65}),uncertainBoundaryMaterial=new THREE.MeshStandardMaterial({color:0x81775b,metalness:.25,roughness:.7});
  const slurry=createSlurryFlowLayer();genericGroup.add(slurry.group);
  const tour=createTourHighlight();group.add(tour.group);
  let crushing=null,isCrushing=false,currentView=null,activeNodes=PLANT_NODES,visibleObjects=new Map(),hotspotPositions=new Map(),links=[],flowAnnotations=[],lastTime=0,viewBounds=new THREE.Box3();
  function clearLinks(){
    tour.clear();
    // Routes own transient GPU resources; symbols, markers and instance batches are reused.
    slurry.reset();
    linkLayer.traverse(object=>{if(object.isLine){object.geometry.dispose();object.material.dispose();}});
    linkLayer.clear();boundaryLayer.clear();links=[];flowAnnotations=[];
  }
  function buildView(view){
    clearLinks();currentView=view;activeNodes=view.activeNodes;visibleObjects=new Map();hotspotPositions=new Map();const ids=new Set(activeNodes.map(node=>node.id));
    for(const[id,holder]of nodeObjects){holder.visible=ids.has(id);if(holder.visible){holder.position.set(...view.positions.get(id));visibleObjects.set(id,holder);}}
    for(const boundary of view.boundaries){
      const holder=new THREE.Group();holder.position.set(...boundary.position);holder.userData={nodeId:boundary.id,boundary:true,direction:boundary.direction};
      const marker=new THREE.Group(),material=boundary.uncertain?uncertainBoundaryMaterial:boundaryMaterial,disc=new THREE.Mesh(boundaryGeometry,material),post=new THREE.Mesh(boundaryPostGeometry,material);
      disc.position.y=.65;post.position.y=.3;marker.add(disc,post);holder.add(marker);boundaryLayer.add(holder);visibleObjects.set(boundary.id,holder);
      flowAnnotations.push({label:boundary.label,detail:boundary.detail,direction:boundary.direction,position:new THREE.Vector3(boundary.position[0],1.1,boundary.position[2]),kind:'boundary',targetNodeId:boundary.id,uncertain:boundary.uncertain});
    }
    const routes=routeFlowEdges(view);
    for(const route of routes){
      const{edge}=route,points=route.points.map(point=>new THREE.Vector3(...point)),curve=new THREE.CurvePath();
      // Straight route corners retain obstacle clearance; splines can cut across nearby equipment.
      for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
      const hex=FLOW_COLORS[edge.kind]||FLOW_COLORS.main;
      const material=edge.uncertain?new THREE.LineDashedMaterial({color:hex,transparent:true,opacity:.6,dashSize:.24,gapSize:.22}):new THREE.LineBasicMaterial({color:hex,transparent:true,opacity:route.boundary?.62:.8});
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);line.computeLineDistances();line.userData={edge,labelObstacle:false};line.raycast=()=>{};linkLayer.add(line);
      links.push({edge,curve,line,points,color:hex});
      if(view.id!=='all'&&!route.boundary&&(edge.label||edge.uncertain)){
        const label=(edge.label||'回流 · 待核对')+(/目占|mm/.test(edge.label||'')?' · 展板':''),position=curve.getPoint(.53);position.y+=.25;
        flowAnnotations.push({label,position,kind:edge.uncertain?'uncertain':edge.kind,uncertain:!!edge.uncertain,from:edge.from,to:edge.to});
      }
    }
    genericGroup.updateWorldMatrix(true,true);viewBounds=new THREE.Box3();
    for(const[id,holder]of visibleObjects){
      const box=new THREE.Box3().setFromObject(holder);viewBounds.union(box);
      // These static symbols do not need their mesh trees measured every frame.
      hotspotPositions.set(id,new THREE.Vector3(holder.position.x,holder.userData.boundary?1.1:Math.max(2.5,box.max.y+.3),holder.position.z));
    }
    for(const route of routes)for(const point of route.points)viewBounds.expandByPoint(new THREE.Vector3(...point));viewBounds.expandByScalar(.65);viewBounds.max.y=Math.max(viewBounds.max.y,3.5);
    group.userData.visibleEdgeCount=routes.length;group.userData.boundaryCount=view.boundaries.length;group.userData.activeNodeCount=activeNodes.length;
    const size=viewBounds.getSize(new THREE.Vector3());slurry.setLinks(links,{viewExtent:Math.max(size.x,size.z)});
    update(0,lastTime);return activeNodes;
  }
  function update(dt,time){
    lastTime=time;tour.update(time);if(isCrushing){crushing?.update(dt,time);return;}slurry.update(time);
  }
  function setStage(stage){
    isCrushing=stage==='crushing';genericGroup.visible=!isCrushing;if(isCrushing&&!crushing){crushing=createCrushingScene();group.add(crushing.group);}if(crushing){crushing.group.visible=isCrushing;if(isCrushing)crushing.setFocus('all');}
    if(isCrushing){clearLinks();activeNodes=PLANT_NODES.filter(node=>node.stage==='crushing');group.userData.visibleEdgeCount=8;group.userData.boundaryCount=0;group.userData.activeNodeCount=7;return activeNodes;}
    return buildView(resolveFlowView({stage}));
  }
  function setCircuit(id){const view=resolveFlowView({circuit:id});isCrushing=false;genericGroup.visible=true;if(crushing)crushing.group.visible=false;return buildView(view);}
  function bounds(){return isCrushing?crushing.bounds():viewBounds.clone();}
  function positionFor(id){
    if(isCrushing)return crushing.positionFor(id);return hotspotPositions.get(id)?.clone()||null;
  }
  function setCrushingFocus(id){if(isCrushing)crushing.setFocus(id);}
  function setFlowFocus(id){tour.clear();return isCrushing?slurry.focusInfo:slurry.setFocus(id);}
  function setTourFocus(focus){return tour.setFocus(focus,{nodeObjects:isCrushing?crushing.nodeObjects:visibleObjects,links:isCrushing?crushing.links:links,motionLayers:[isCrushing?crushing.motionLayer:slurry.group]});}
  function annotations(){return isCrushing?(crushing.annotations||[]):flowAnnotations;}
  buildView(resolveFlowView());
  return{group,nodeObjects,get labelObjects(){return isCrushing?crushing.nodeObjects:visibleObjects;},get viewInfo(){return isCrushing?{id:'crushing',kind:'stage',activeNodes,boundaries:[]}:currentView;},get focusInfo(){return slurry.focusInfo;},setStage,setCircuit,setFlowFocus,bounds,update,positionFor,setCrushingFocus,annotations,setTourFocus,clearTourFocus:tour.clear,tourBounds:tour.bounds,tourPosition:tour.position,setTourProgress:tour.setProgress,get tourInfo(){return tour.info;}};
}
