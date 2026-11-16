import * as THREE from 'three';
import { layoutLabels, projectBoundsToScreen } from './label-layout.js';
import { EXPLOSION_COLORS, explosionPlan, applyExplosionPose, explosionEnvelope, createExplosionGuides } from './explosion.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createBallMill } from './models/ball-mill.js';
import { createCyclone, createFlotation, createThickener, createFilter } from './models/equipment.js';
import { EQUIPMENT as CORE_EQUIPMENT, PROCESS_NOTE, NODE_EQUIPMENT_OVERRIDES, SITE_EQUIPMENT } from './process-data.js';
import { createConeCrusher } from './models/cone-crusher.js';
import { createAuxiliary, AUXILIARY_EQUIPMENT } from './models/auxiliary.js';
import { createPlantScene } from './plant-scene.js';
import { PLANT_NODES, PLANT_EDGES, PLANT_STAGES, PLANT_METRICS, REFERENCE_NOTES } from './plant-flow.js';
import { createSiteJawCrusher, createSiteScreen, createSiteConveyor } from './models/crushing-site.js';
import { SITE_REFERENCES, BOARD_REFERENCES } from './reference-data.js';
import { PROCESS_CIRCUITS } from './flow-views.js';
import { FLOW_FOCUS_OPTIONS } from './slurry-flow.js';
import { PROCESS_TOUR_STEPS, PROCESS_TOUR_CHAPTERS, createProcessTour } from './process-tour.js';
import { RESEARCH_DATE, TECHNICAL_SOURCES, CIRCUIT_GUIDES, TECHNICAL_DIFFERENCES } from './technology-data.js';
const EQUIPMENT = [...CORE_EQUIPMENT, ...AUXILIARY_EQUIPMENT, ...SITE_EQUIPMENT];
const NODE_BY_ID = new Map(PLANT_NODES.map(node => [node.id, node]));
function equipmentRecord(id, nodeId) {
  const record = EQUIPMENT.find(item => item.id === id);
  return record ? {...record, ...NODE_EQUIPMENT_OVERRIDES[nodeId]} : null;
}

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { id:'cone', view:'solid', running:!reduceMotion, labels:true, overview:false, selected:null, time:0, plantStage:'all', plantCircuit:null, nodeId:null };
const makers = {...Object.fromEntries(AUXILIARY_EQUIPMENT.map(d=>[d.id,()=>createAuxiliary(d.id)])),cone:createConeCrusher,mill:createBallMill,crusher:createSiteJawCrusher,screen:createSiteScreen,prescreen:()=>createAuxiliary('screen'),conveyor:createSiteConveyor,cyclone:createCyclone,flotation:createFlotation,thickener:createThickener,filter:createFilter};
const stageEn = {conveyor:'CONVEYING',screen:'SCREENING',spiral:'CLASSIFICATION',stirred:'REGRINDING',hopper:'STORAGE',conditioning:'CONDITIONING',lamella:'THICKENING',water:'WATER RECOVERY',storage:'PRODUCT',cone:'FINE CRUSHING',crusher:'CRUSHING',mill:'MILLING',cyclone:'CLASSIFICATION',flotation:'FLOTATION',thickener:'THICKENING',filter:'DEWATERING'};
const summaries = {cone:'偏心驱动动锥旋摆，在连续变化的破碎腔中完成细碎。',crusher:'让大块原矿，在一次次挤压中变得细小。',mill:'钢球与矿石在旋转中相遇，让有用矿物逐步解离。',cyclone:'在旋转的矿浆中，找到细与粗的分界。',flotation:'让气泡携起有用矿物，在泡沫中完成富集。',thickener:'让固体缓缓沉降，让水重新回到循环。',filter:'滤去水分，让金精矿以滤饼的形态启程。'};
const icons = {
cone:'M13 4h24v9l-4 6v21H17V19l-4-6Z M14 13h22 M18 35l7-20 7 20 M8 40h34 M15 23H8v8h7 M17 36h16',
crusher:'M8 9h30v5H8Z M11 14l5 25h14l5-25 M16 18l6 19 7-19 M6 40h36 M12 40v-5 M35 40v-5 M37 21a7 7 0 1 1 0 14',
mill:'M10 13h27v22H10Z M10 15H5v18h5 M37 15h5v18h-5 M14 13v22 M33 13v22 M17 35v5 M31 35v5 M12 40h24 M20 13v22 M28 13v22',
cyclone:'M17 10h16v13L27 38h-4l-6-15Z M14 11H7v6h10 M21 10V4h9v6 M23 38v6 M17 20h16',
flotation:'M9 18h32v21H9Z M7 14h36v4H7Z M23 6h7v8 M26 14v18 M18 31h16 M18 28l16 6 M12 39v4 M37 39v4 M12 23h26 M10 8h9v6',
thickener:'M5 23c0-8 40-8 40 0v11c0 9-40 9-40 0Z M5 23c0 8 40 8 40 0 M25 10v23 M17 10h16 M7 19h36 M14 35l11-3 11 3 M13 39v5 M37 39v5',
filter:'M4 16h39v20H4Z M11 16v20 M16 16v20 M21 16v20 M26 16v20 M31 16v20 M36 16v20 M43 23h5v6h-5 M8 36v7 M37 36v7 M4 13h35 M7 10v3'
};
const rail = $('equipment-rail');
CORE_EQUIPMENT.forEach(d=>{const b=document.createElement('button');b.className='equipment-card'+(d.id===state.id?' active':'');b.dataset.equipment=d.id;b.setAttribute('aria-label',`查看${d.name}三维原理图`);b.setAttribute('aria-pressed',String(d.id===state.id));b.innerHTML=`<span>${d.number}</span><svg viewBox="0 0 50 48" aria-hidden="true"><path d="${icons[d.id]}"/></svg><div><strong>${d.name.replace('机械搅拌','').replace('精矿','')}</strong><small>${stageEn[d.id]}</small></div>`;b.onclick=()=>selectEquipment(d.id);rail.append(b);});

let renderer,scene,camera,controls,current,stage,processGroup,grid,shadow,baseRing,shadowKey;
const models=new Map();
const explosion={steps:[],progress:0,target:0,playing:false,guides:null,active:-1,percent:-1};
let plantModel=null,operationStep=-1,cyclePhase='',cyclePercent=-1;
const processTour=createProcessTour();
let tourApplying=false,tourPreviousRunning=false,tourIndex=-1,tourPercent=-1,tourPauseReason='',tourCameraBounds=null;
const viewport=$('viewport'), hotspotLayer=$('hotspots');
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const cameraGoal=new THREE.Vector3(), targetGoal=new THREE.Vector3();
let cameraTween=false, last=performance.now(), lastPointer={x:0,y:0}, hoverMesh=null;
let hotspotItems=[], outline=null, toastTimer=null;
let labelSizeDirty=true,labelLeaders=null;
const labelResizeObserver=new ResizeObserver(()=>{labelSizeDirty=true;});
const labelNS='http://www.w3.org/2000/svg';
const labelBoundsCache=new WeakMap();


function init(){
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(error){$('loading').hidden=true;const warning=document.createElement('div');warning.className='webgl-error';warning.textContent='当前浏览器无法启动 WebGL。请启用硬件加速后重新打开。你仍可通过下方设备导航和「原理手册」阅读设备原理。';viewport.append(warning);document.querySelectorAll('#control-dock button,.viewer-tools button').forEach(b=>b.disabled=true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x0a1214,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');viewport.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b1717,.014);
  camera=new THREE.PerspectiveCamera(35,1,.1,350);camera.position.set(9.2,6.6,12.5);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.target.set(0,1.5,0);controls.minDistance=6;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.485;controls.enablePan=true;controls.panSpeed=.5;
  controls.addEventListener('start',()=>{cameraTween=false;if(processTour.snapshot.active)pauseProcessTour('已暂停 · 自由观察');});
  const env=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(env,.04).texture;scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdce5e3,0x303224,1.5));
  const key=shadowKey=new THREE.DirectionalLight(0xe4e8d5,4.5);key.position.set(2,11,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.normalBias=.04;key.shadow.bias=-.0002;key.shadow.radius=3;scene.add(key);
  const rim=new THREE.DirectionalLight(0x9bbfc4,2.2);rim.position.set(-6,5,-7);scene.add(rim);
  const warm=new THREE.DirectionalLight(0xe5c8a0,1.5);warm.position.set(8,4,-2);scene.add(warm);
  stage=new THREE.Group();scene.add(stage);processGroup=new THREE.Group();processGroup.visible=false;scene.add(processGroup);
  shadow=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.ShadowMaterial({opacity:.24}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.01;shadow.receiveShadow=true;scene.add(shadow);
  grid=new THREE.GridHelper(40,40,0x4d675b,0x29463e);grid.material.transparent=true;grid.material.opacity=.13;grid.position.y=-.015;scene.add(grid);
  baseRing=new THREE.Group();scene.add(baseRing);
  [5.5,5.6,6.8].forEach((r,i)=>{const points=Array.from({length:181},(_,n)=>new THREE.Vector3(Math.cos(n/180*Math.PI*2)*r,0,Math.sin(n/180*Math.PI*2)*r));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:i===1?0x547063:0x8c875b,transparent:true,opacity:i===1?.14:.24}));baseRing.add(line);});
  const tickPts=[];for(let i=0;i<96;i++){const a=i/96*Math.PI*2,r=6.8;tickPts.push(new THREE.Vector3(Math.cos(a)*r,.01,Math.sin(a)*r),new THREE.Vector3(Math.cos(a)*(r+(i%8===0?.19:.08)),.01,Math.sin(a)*(r+(i%8===0?.19:.08))));}baseRing.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts),new THREE.LineBasicMaterial({color:0xb9a679,transparent:true,opacity:.25})));
  outline=new THREE.Box3Helper(new THREE.Box3(),0xd1b37c);outline.material.transparent=true;outline.material.opacity=.25;outline.visible=false;scene.add(outline);
  new ResizeObserver(resize).observe(viewport);resize();selectEquipment('cone',true);
  renderer.domElement.addEventListener('pointerdown',e=>lastPointer={x:e.clientX,y:e.clientY});
  renderer.domElement.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>5)return;const hit=pick(e);if(!hit)return;if(state.overview){const id=ancestorValue(hit.object,'nodeId');if(id)selectPlantNode(id);}else{const id=ancestorValue(hit.object,'partId');if(id)selectPart(id);}});
  renderer.domElement.addEventListener('pointermove',e=>{const hit=pick(e);renderer.domElement.style.cursor=hit?'pointer':'grab';
    if(state.overview){const node=NODE_BY_ID.get(hit?ancestorValue(hit.object,'nodeId'):null);$('plant-hover').hidden=!node;if(node)$('plant-hover').textContent=`${node.label} · ${node.model} ↗`;}
  });
  renderer.domElement.addEventListener('pointerleave',()=>$('plant-hover').hidden=true);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseProcessTour('图形中断 · 请刷新');state.running=false;toast('三维图形上下文已中断，请刷新页面恢复。');});
  updatePlay();requestAnimationFrame(animate);
  requestAnimationFrame(()=>{$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,550);});
}
function resize(){labelSizeDirty=true;if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(current||state.overview&&plantModel)resetCamera();}
function ancestorValue(object,key){while(object){if(object.userData[key])return object.userData[key];object=object.parent;}return null;}
function pick(event){if(!renderer)return null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(state.overview?processGroup.children:stage.children,true).find(h=>h.object.isMesh && h.object.visible && visibleAncestors(h.object));}
function visibleAncestors(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
function fitShadowCamera(light,holders=[],extraBounds=null){
  if(!light)return;
  const shadowCamera=light.shadow.camera;
  light.position.set(2,11,8);light.updateMatrixWorld(true);light.target.updateMatrixWorld(true);
  Object.assign(shadowCamera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:500});
  light.shadow.updateMatrices(light);
  const lightBounds=new THREE.Box3();
  for(const holder of holders){
    if(!visibleAncestors(holder))continue;
    holder.updateWorldMatrix(true,true);
    // Include each complete visible holder: the equipment and its steel platform.
    lightBounds.union(new THREE.Box3().setFromObject(holder).applyMatrix4(shadowCamera.matrixWorldInverse));
  }
  if(extraBounds&&!extraBounds.isEmpty())lightBounds.union(extraBounds.clone().applyMatrix4(shadowCamera.matrixWorldInverse));
  if(!lightBounds.isEmpty()){
    const size=lightBounds.getSize(new THREE.Vector3()),padding=Math.max(1.2,Math.max(size.x,size.y)*.035);
    Object.assign(shadowCamera,{left:lightBounds.min.x-padding,right:lightBounds.max.x+padding,
      bottom:lightBounds.min.y-padding,top:lightBounds.max.y+padding});
    // Keep distant stages ahead of the near plane without changing light direction.
    const retreat=Math.max(0,lightBounds.max.z+shadowCamera.near+padding);
    if(retreat)light.position.addScaledVector(light.position.clone().sub(light.target.position).normalize(),retreat);
    shadowCamera.far=Math.max(500,-lightBounds.min.z+retreat+padding);
    light.updateMatrixWorld(true);
  }
  shadowCamera.updateProjectionMatrix();light.shadow.updateMatrices(light);light.shadow.needsUpdate=true;
}
function updateShadowCoverage(){fitShadowCamera(shadowKey,state.overview?plantModel?.labelObjects?.values():[]);}
function getModel(id){if(id==='screen'&&state.nodeId==='prescreen')id='prescreen';const map=models;if(!map.has(id)){const model=makers[id]();model.parts.forEach(p=>{p.base=p.root.position.clone();p.root.userData.partId=p.id;});model.group.userData.equipmentId=id;map.set(id,model);}return map.get(id);}
function clearHotspots(){
  labelResizeObserver.disconnect();hotspotLayer.replaceChildren();hotspotItems=[];labelSizeDirty=true;
  labelLeaders=document.createElementNS(labelNS,'svg');labelLeaders.classList.add('label-leaders');labelLeaders.setAttribute('aria-hidden','true');hotspotLayer.append(labelLeaders);
}
function trackHotspot(button,position,type){
  const line=document.createElementNS(labelNS,'line');line.style.display='none';if(type==='flow')line.classList.add('flow-leader');labelLeaders.append(line);
  button.dataset.layoutHidden='';button.setAttribute('aria-hidden','true');labelResizeObserver.observe(button);
  hotspotItems.push({button,position,type,line,width:0,height:0});labelSizeDirty=true;
}
function makeHotspot(label,num,callback,position,type='part'){
  const button=document.createElement('button');button.className='hotspot'+(type==='process'?' process-label':'');
  const number=document.createElement('span'),text=document.createElement('span');number.textContent=num;text.className='hotspot-text';text.textContent=label;button.append(number,text);
  button.onclick=callback;button.title=label;button.setAttribute('aria-label',type==='part'?`查看${label}`:`探索${label}`);
  hotspotLayer.append(button);trackHotspot(button,position,type);return button;
}
function partHotspots(){
  clearHotspots();if(!current)return;
  const favored={mill:['shell','charge','gear']};
  let parts=current.parts.filter(p=>favored[state.id]?.includes(p.id));
  if(state.view==='cutaway'&&current.operationGuide){
    const steps=current.operationGuide.steps;
    const ids=operationStep<0?steps.map(step=>step.partId):[steps[operationStep]?.partId];
    parts=current.parts.filter(p=>ids.includes(p.id));
  }
  if(state.view==='exploded'){
    const ids=explosion.steps[activeExplosionStep()]?.parts||[];
    parts=explosion.progress===1?current.parts:current.parts.filter(p=>ids.includes(p.id));
  }
  if(!parts.length)parts=current.parts.filter((p,i)=>i===0||i===2||i===current.parts.length-1);
  for(const p of parts){
    const i=current.parts.indexOf(p);
    const button=makeHotspot(p.name,String(i+1).padStart(2,'0'),()=>selectPart(p.id),()=>{const pos=p.anchor.clone();pos.add(p.root.position.clone().sub(p.base));return current.group.localToWorld(pos);});
    if(state.view==='exploded'){
      const step=Math.max(0,explosion.steps.findIndex(s=>s.parts.includes(p.id)));
      button.firstChild.style.borderColor=button.firstChild.style.color='#'+EXPLOSION_COLORS[step%EXPLOSION_COLORS.length].toString(16);
    }
  }
}
function selectEquipment(id,initial=false,nodeId=null){leaveTourForNavigation();if(!initial)revealWorkspace();state.overview=false;state.id=id;state.nodeId=nodeId;state.selected=null;$('process-controls').hidden=true;$('stage-selector').hidden=true;$('crushing-tools').hidden=true;document.body.classList.remove('crushing-mode');$('plant-legend').hidden=true;$('node-directory').hidden=true;$('plant-hover').hidden=true;$('back-to-process').hidden=!nodeId&&id!=='conveyor';$('crushing-entry').hidden=false;document.body.classList.remove('process-mode');$('equipment-nav').classList.add('active');$('equipment-nav').setAttribute('aria-current','page');$('process-nav').classList.remove('active');$('process-nav').removeAttribute('aria-current');$('part-drawer').hidden=true;
  renderEquipmentConnections();
  const d=equipmentRecord(id,nodeId),node=NODE_BY_ID.get(nodeId);$('hero-title').innerHTML='让原理，<br>清晰可见<span>。</span>';$('hero-description').innerHTML='穿过钢铁的表面，走进黄金的旅程。<br>以三维视角，重新认识每一台设备。';$('equipment-number').textContent=d.number;$('equipment-stage').textContent=`${d.stage} / ${stageEn[id]}`;$('equipment-name').textContent=node?.label||d.name.replace('机械搅拌','');$('equipment-model').textContent=node?.model||d.model||'';$('evidence-badge').textContent=d.badge||(id==='screen'?'蓝色外罩参考实拍 · 型号对应待核对':node?'展板节点 · 通用结构示意':id==='mill'?'依据实拍模型重建 · 尺寸示意':'展板工艺 · 通用结构示意');$('equipment-english').textContent=d.enName;$('equipment-summary').textContent=node?.note||summaries[id]||d.description;$('drawing-number').textContent=`FIG. ${d.number} / ${stageEn[id]}`;$('render-state').textContent='实时三维 · 原理示意';$('learn-button').innerHTML='理解它如何工作 <span>↗</span>';$('interaction-hint').innerHTML='<span>↔</span> 拖动旋转 <i></i> 滚轮缩放 <i></i> 点击零件探索';$('flow-toggle').innerHTML='查看工艺全景 <span>↗</span>';viewport.setAttribute('aria-label',`可旋转的${d.name}三维模型。可使用下方按钮切换视图，使用零件目录查看内部结构。`);
  $('back-to-process').textContent=state.plantCircuit?'← 返回所选回路':'← 返回所选工段';
  document.querySelectorAll('.equipment-card').forEach(b=>{const active=b.dataset.equipment===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  if(!renderer)return;stage.clear();current=getModel(id);stage.add(current.group);stage.visible=true;processGroup.visible=false;baseRing.visible=true;grid.scale.setScalar(1);scene.fog.density=.014;outline.visible=false;controls.minDistance=6;controls.maxDistance=30;updateShadowCoverage();applyView(state.view,initial);partHotspots();resetCamera(initial);resize();
}
function applyView(view,immediate=false){
  state.view=view;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
  if(!current||state.overview)return;
  explosion.guides?.dispose();explosion.guides=null;explosion.playing=false;
  current.setViewMode?.(view);
  current.group.traverse(o=>{if(o.userData.cutaway)o.visible=view!=='cutaway';});
  $('explosion-panel').hidden=view!=='exploded';document.body.classList.toggle('exploded-mode',view==='exploded');
  if(view==='exploded'){
    explosion.steps=explosionPlan(current);explosion.progress=reduceMotion?1:0;explosion.target=explosion.progress;
    explosion.playing=!reduceMotion;explosion.active=-1;explosion.percent=-1;
    applyExplosionPose(current,explosion.steps,explosion.progress);
    explosion.guides=createExplosionGuides(current,explosion.steps);
    buildExplosionControls();updateExplosionControls();
    fitShadowCamera(shadowKey,[],explosionEnvelope(current));
  }else{
    if(immediate)current.parts.forEach(p=>p.root.position.copy(p.base));
    updateShadowCoverage();
  }
  state.selected=null;outline.visible=false;$('part-drawer').hidden=true;
  renderOperationGuide();updatePlay();partHotspots();resetCamera();
}
function renderOperationGuide(){
  operationStep=-1;current?.setOperationStep?.(-1);cyclePhase='';cyclePercent=-1;
  const guide=current?.operationGuide,panel=$('operation-panel');
  panel.hidden=state.overview||state.view!=='cutaway'||!guide;
  $('operation-cycle').hidden=panel.hidden||!current?.operationStatus;
  if(panel.hidden)return;
  renderCycleStages();updateOperationCycle();
  $('operation-title').textContent=guide.title;
  $('operation-summary').textContent=guide.summary;
  $('operation-sources').hidden=!guide.sources?.length;$('operation-sources').open=false;
  $('operation-source-links').replaceChildren();
  for(const source of guide.sources||[]){const link=document.createElement('a');link.textContent=source.title+' ↗';link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';$('operation-source-links').append(link);}
  $('operation-steps').replaceChildren();
  $('operation-steps').style.setProperty('--operation-columns',Math.min(guide.steps.length,4));
  guide.steps.forEach((step,index)=>{
    const button=document.createElement('button');button.type='button';button.dataset.operationStep=index;
    const color=typeof step.color==='number'?'#'+step.color.toString(16).padStart(6,'0'):step.color||['#d1b37c','#80c7cc','#a6c591'][index%3];
    button.style.setProperty('--operation-color',color);
    const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
    button.append(number,document.createTextNode(step.label));button.onclick=()=>setOperationStep(index);
    $('operation-steps').append(button);
  });
  updateOperationControls();
}
function renderCycleStages(){
  $('cycle-stages').replaceChildren();
  if(!current?.seekOperationPhase)return;
  for(const item of current.operationStatus?.stages||[]){
    const button=document.createElement('button');button.type='button';button.dataset.cyclePhase=item.id;button.textContent=item.label;
    button.onclick=()=>{current.seekOperationPhase(item.id);state.running=false;updatePlay();cyclePhase='';cyclePercent=-1;updateOperationCycle();};
    $('cycle-stages').append(button);
  }
}
function updateOperationCycle(){
  if($('operation-cycle').hidden)return;
  const status=current?.operationStatus;if(!status)return;
  const percent=Math.round(Math.max(0,Math.min(1,status.progress||0))*100);
  if(cyclePhase!==status.phaseId){
    cyclePhase=status.phaseId;$('cycle-phase').textContent=status.label;
    $('cycle-description').textContent=status.description||'';
    [...$('cycle-stages').children].forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cyclePhase===status.phaseId)));
  }
  if(cyclePercent!==percent){
    cyclePercent=percent;$('cycle-fill').style.width=percent+'%';
    $('cycle-meter').setAttribute('aria-valuenow',percent);
  }
  $('cycle-meter').setAttribute('aria-valuetext',`${status.label}，示意周期 ${percent}%`);
}
function renderEquipmentConnections(){
  const panel=$('equipment-connections');
  panel.hidden=state.overview||!['flotation','thickener','filter'].includes(state.id);
  if(panel.hidden)return;
  const nodeId=state.nodeId||({thickener:'concentrate-thickener',filter:'filter-press'})[state.id];
  $('equipment-connection-links').replaceChildren();
  const append=(label,id,kind='main')=>{
    const button=document.createElement('button');button.type='button';button.dataset.connectionNode=id;button.dataset.stream=kind;
    button.textContent=label+' ↗';button.onclick=()=>selectPlantNode(id);$('equipment-connection-links').append(button);
  };
  if(nodeId){
    const node=NODE_BY_ID.get(nodeId);
    $('equipment-connection-description').textContent=node.note;
    for(const edge of PLANT_EDGES.filter(edge=>edge.from===nodeId||edge.to===nodeId)){
      const outgoing=edge.from===nodeId,id=outgoing?edge.to:edge.from;
      append(`${outgoing?'去往':'来自'} · ${NODE_BY_ID.get(id).label}${edge.label&&!NODE_BY_ID.get(id).label.includes(edge.label)?' / '+edge.label:''}${edge.uncertain&&!edge.label?.includes('待核对')?' · 待核对':''}`,id,edge.kind);
    }
  }else{
    $('equipment-connection-description').textContent='精选Ⅲ和精选Ⅴ分别产出两路精矿，汇入精矿浓密池，再进入压滤脱水。可从实际作业节点继续查看。';
    for(const id of ['cleaner-3','cleaner-5','concentrate-thickener'])append(NODE_BY_ID.get(id).label,id,'concentrate');
  }
}
function setOperationStep(index){
  if(!current?.operationGuide||state.overview||state.view!=='cutaway')return;
  operationStep=index;current.setOperationStep?.(index);closeParts();updateOperationControls();partHotspots();
}
function updateOperationControls(){
  const guide=current.operationGuide,step=guide.steps[operationStep];
  $('operation-all').setAttribute('aria-pressed',String(operationStep<0));
  [...$('operation-steps').children].forEach((button,index)=>button.setAttribute('aria-pressed',String(index===operationStep)));
  $('operation-description').textContent=step?step.description:'点击观察要点查看对应结构；可暂停动画、旋转模型，从不同角度观察矿浆与零件的关系。';
  $('operation-part').hidden=!step?.partId;
}
function renderFlowFocusControls(){
  $('slurry-controls').hidden=state.plantStage==='crushing';
  if(!$('slurry-controls').hidden)updateFlowFocusControls(plantModel.focusInfo);
}
function updateFlowFocusControls(info){
  if(!info)return;
  document.querySelectorAll('[data-flow-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.flowFocus===info.id)));
  const count=info.confirmedCount;
  $('slurry-description').textContent=count?`${info.description} 当前视图突出 ${count} ${info.unitLabel||'条矿流'}。`:'当前视图没有这类已确认路径，可切换工艺回路继续查看。';
}
function buildExplosionControls(){
  $('explosion-steps').replaceChildren();
  explosion.steps.forEach((step,index)=>{
    const button=document.createElement('button');button.type='button';
    button.style.setProperty('--step-color','#'+EXPLOSION_COLORS[index%EXPLOSION_COLORS.length].toString(16));
    const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
    button.append(number,document.createTextNode(step.title));
    button.onclick=()=>seekExplosion((index+1)/explosion.steps.length);
    button.setAttribute('aria-label',`展开至第${index+1}层：${step.title}`);
    $('explosion-steps').append(button);
  });
}
function activeExplosionStep(){return Math.min(explosion.steps.length-1,Math.max(0,Math.ceil(explosion.progress*explosion.steps.length-1e-6)-1));}
function updateExplosionControls(){
  const percent=Math.floor(explosion.progress*100),index=activeExplosionStep(),step=explosion.steps[index];
  if(explosion.percent!==percent||explosion.active!==index){
    explosion.percent=percent;$('explosion-range').value=String(percent);$('explosion-value').value=`${percent}%`;
    $('explosion-range').setAttribute('aria-valuetext',`${percent}%，${step?.title||'完整装配'}`);
    $('explosion-title').textContent=percent===0?'从完整装配开始':percent===100?'全部展开 · 对照装配位置':`${String(index+1).padStart(2,'0')} / ${String(explosion.steps.length).padStart(2,'0')} · ${step?.title||'逐层展开'}`;
  }
  const finished=explosion.progress===1;
  if(explosion.active===index&&explosion.finished===finished)return;
  explosion.active=index;explosion.finished=finished;
  [...$('explosion-steps').children].forEach((button,n)=>{button.classList.toggle('active',n===index);button.classList.toggle('complete',n<index);button.setAttribute('aria-pressed',String(n===index));});
  $('explosion-description').textContent=step?.description||'拖动进度，观察各零件的装配关系。';
  $('explosion-parts').replaceChildren();
  for(const id of step?.parts||[]){const part=current.parts.find(p=>p.id===id);if(!part)continue;
    const button=document.createElement('button');button.type='button';button.textContent=`${String(current.parts.indexOf(part)+1).padStart(2,'0')} ${part.name} ↗`;button.onclick=()=>selectPart(id);$('explosion-parts').append(button);
  }
  if(state.view==='exploded')partHotspots();
}
function seekExplosion(progress,immediate=false){
  if(!current||state.overview||state.view!=='exploded')return;
  explosion.playing=false;explosion.target=Math.max(0,Math.min(1,progress));
  if(immediate||reduceMotion){explosion.progress=explosion.target;applyExplosionPose(current,explosion.steps,explosion.progress);updateExplosionControls();}
  updatePlay();
}

function fitEquipmentCamera(model,view,camera,eye,target){
  const initialDistance=eye.distanceTo(target);
  if(!model||!Number.isFinite(camera.aspect)||camera.aspect<=0)return initialDistance;
  model.group.updateWorldMatrix(true,true);
  const bounds=view==='exploded'?explosionEnvelope(model):new THREE.Box3(),partBounds=new THREE.Box3();
  // Measure the requested final pose without moving parts during their transition.
  for(const part of model.parts){
    partBounds.setFromObject(part.root);
    const destination=(part.base||part.root.position).clone();
    if(view==='exploded')destination.add(part.explode);
    const origin=part.root.position.clone();
    if(part.root.parent){destination.applyMatrix4(part.root.parent.matrixWorld);origin.applyMatrix4(part.root.parent.matrixWorld);}
    bounds.union(partBounds.translate(destination.sub(origin)));
  }
  if(bounds.isEmpty())return initialDistance;
  const direction=eye.clone().sub(target).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()/2)),tanH=tanV*camera.aspect;
  let fit=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(target);
    fit=Math.max(fit,offset.dot(direction)+Math.max(Math.abs(offset.dot(right))/tanH,Math.abs(offset.dot(up))/tanV));
  }
  const distance=Math.max(initialDistance,fit*1.08);
  eye.copy(target).addScaledVector(direction,distance);
  return distance;
}
function resetCamera(immediate=false){
  if(!camera)return;
  if(processTour.snapshot.active&&tourCameraBounds){frameProcessTour(immediate);return;}
  const mobile=matchMedia('(max-width:760px)').matches;
  if(state.overview&&plantModel){
    const bounds=plantModel.bounds(),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    targetGoal.copy(center);targetGoal.y=state.plantStage==='crushing'?center.y*.65:.5;
    // Fit the complete selected diagram into the visible view; positions are schematic.
    const availableAspect=mobile?Math.min(viewport.clientWidth,window.innerWidth*.9)/viewport.clientHeight:camera.aspect;
    const span=Math.max(size.x/(availableAspect*.92),size.z*1.5,12);
    const distance=span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.12;
    cameraGoal.copy(targetGoal).add(new THREE.Vector3(.1,.82,.65).normalize().multiplyScalar(distance));
    if(state.plantStage==='crushing'){
      targetGoal.copy(center);
      const direction=new THREE.Vector3(.18,.68,1).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
      const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*availableAspect;
      let fit=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const offset=new THREE.Vector3(x,y,z).sub(targetGoal);
        fit=Math.max(fit,offset.dot(direction)+Math.max(Math.abs(offset.dot(right))/tanH,Math.abs(offset.dot(up))/tanV));
      }
      cameraGoal.copy(targetGoal).addScaledVector(direction,fit*1.08);
    }
  }else{
    const tall=['cyclone','cone'].includes(state.id),exploded=state.view==='exploded';
    const distance=(mobile?1.2:1)*(exploded?1.24:1);
    cameraGoal.set(tall?8.5:7,tall?7.8:5.8,tall?15:12.7).multiplyScalar(distance);
    targetGoal.set(0,exploded?(tall?3:2.1):(tall?2.65:1.45),0);
    if(state.id==='cone'){cameraGoal.set(10.2,8.6,17.5).multiplyScalar(distance);targetGoal.set(.5,exploded?3.8:3.3,0);}
    if(state.id==='crusher'){cameraGoal.set(8.5,7,14).multiplyScalar(distance);targetGoal.set(.4,2.3,0);}
    if(state.id==='screen'){cameraGoal.set(8.5,7.5,14.5).multiplyScalar(distance);targetGoal.set(0,2.5,0);}
    if(state.id==='conveyor'){cameraGoal.set(7.5,5.8,12.7).multiplyScalar(distance);targetGoal.set(0,1.4,0);}
    if(exploded){const envelope=explosionEnvelope(current);if(!envelope.isEmpty()){targetGoal.copy(envelope.getCenter(new THREE.Vector3()));cameraGoal.copy(targetGoal).add(new THREE.Vector3(...(current.explosionCamera||[.52,.27,.85])).normalize().multiplyScalar(12));}}
    controls.maxDistance=Math.max(30,fitEquipmentCamera(current,state.view,camera,cameraGoal,targetGoal)*1.1);
  }
  cameraTween=true;
  if(immediate||reduceMotion){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraTween=false;controls.update();}
}
function selectPart(id){if(state.view==='exploded'&&!state.overview){explosion.playing=false;explosion.target=explosion.progress;updatePlay();}const restoreFocus=$('part-list').contains(document.activeElement);if(!current||state.overview)return;const p=current.parts.find(x=>x.id===id);if(!p)return;state.selected=id;const i=current.parts.indexOf(p);$('part-title').textContent=p.name;$('part-counter').textContent=`${String(i+1).padStart(2,'0')} / ${String(current.parts.length).padStart(2,'0')}`;$('part-description').textContent=equipmentRecord(state.id,state.nodeId).partDescriptions?.[id]||p.description;$('part-list').replaceChildren();current.parts.forEach((part,n)=>{const b=document.createElement('button');b.className=part.id===id?'selected':'';b.innerHTML=`<span class="part-name">${part.name}</span><span>${String(n+1).padStart(2,'0')} ↗</span>`;b.onclick=()=>selectPart(part.id);$('part-list').append(b);});$('part-drawer').hidden=false;$('part-drawer').querySelector('.part-content').scrollTop=0;$('part-drawer').scrollIntoView({block:'nearest',behavior:reduceMotion?'instant':'smooth'});if(restoreFocus)$('part-list').querySelector('.selected')?.focus({preventScroll:true});for(const h of hotspotItems)h.button.classList.toggle('selected',h.button.textContent.includes(p.name));outline.box.setFromObject(p.root);outline.visible=true;}
function closeParts(){const restoreFocus=$('part-drawer').contains(document.activeElement);$('part-drawer').hidden=true;if(restoreFocus)$('parts-button').focus({preventScroll:true});state.selected=null;if(outline)outline.visible=false;for(const h of hotspotItems)h.button.classList.remove('selected');}
function selectPlantNode(id){
  const node=NODE_BY_ID.get(id);if(!node)return;
  if($('info-dialog').open)$('info-dialog').close();
  selectEquipment(node.equipmentId||node.type,false,id);
}
function revealWorkspace(){const behavior=reduceMotion?'instant':'smooth';if(matchMedia('(max-width:900px)').matches)document.querySelector('.viewer-panel').scrollIntoView({block:'start',behavior});else window.scrollTo({top:0,behavior});}
function enterProcess(){
  leaveTourForNavigation();revealWorkspace();
  if(!renderer){showManual('process');return;}
  closeParts();state.overview=true;$('operation-panel').hidden=true;$('equipment-connections').hidden=true;explosion.playing=false;if(explosion.guides)explosion.guides.group.visible=false;$('explosion-panel').hidden=true;document.body.classList.remove('exploded-mode');updatePlay();document.body.classList.add('process-mode');
  $('equipment-nav').classList.remove('active');$('equipment-nav').removeAttribute('aria-current');
  $('process-nav').classList.add('active');$('process-nav').setAttribute('aria-current','page');
  $('hero-title').innerHTML='循着矿流，<br>看见全程<span>。</span>';
  $('hero-description').innerHTML='三段一闭路破碎 · 阶段磨矿与选别<br>四粗两扫五精 · 中矿再磨再选';
  $('equipment-number').textContent=String(PLANT_NODES.length);
  $('equipment-stage').textContent='设备与作业节点 / PLANT';
  $('equipment-english').textContent='YOUR PLANT. REVEALED.';
  $('equipment-model').textContent='依据现场展板 · 按工段探索';
  $('evidence-badge').textContent='空间布置为示意 · 虚线连接待核对';
  $('learn-button').innerHTML='阅读完整工艺说明 <span>↗</span>';
  $('drawing-number').textContent='FLOW. 04 / STAGED CIRCUITS';
  $('render-state').textContent=`${PLANT_NODES.length} 个节点 · ${PLANT_STAGES.length} 个工段`;
  $('interaction-hint').innerHTML='<span>↔</span> 拖动旋转 <i></i> 选择工段放大 <i></i> 点击设备探索';
  $('flow-toggle').innerHTML='返回设备探索 <span>↗</span>';
  $('process-controls').hidden=false;$('back-to-process').hidden=true;$('crushing-entry').hidden=true;$('stage-selector').hidden=false;$('plant-legend').hidden=false;$('node-directory').hidden=false;
  viewport.setAttribute('aria-label','依据现场展板构建的选矿工艺三维图，36个设备与作业节点，支持分工段探索。');
  document.querySelectorAll('.equipment-card').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  stage.visible=false;baseRing.visible=false;processGroup.visible=true;grid.scale.setScalar(1.65);scene.fog.density=.003;
  if(!plantModel){plantModel=createPlantScene();processGroup.add(plantModel.group);}
  controls.minDistance=10;controls.maxDistance=180;resize();if(state.plantCircuit)setPlantCircuit(state.plantCircuit);else setPlantStage(state.plantStage);
}
function setPlantStage(id){
  leaveTourForNavigation();
  state.plantCircuit=null;state.plantStage=id;
  document.body.classList.toggle('crushing-mode',id==='crushing');$('crushing-tools').hidden=id!=='crushing';$('crushing-caption').textContent='±40 mm 预筛分流 · ±10 mm 细碎闭路';document.querySelectorAll('[data-crushing-focus]').forEach(b=>{b.classList.toggle('active',b.dataset.crushingFocus==='all');b.setAttribute('aria-pressed',String(b.dataset.crushingFocus==='all'));});
  const active=plantModel.setStage(id),info=PLANT_STAGES.find(s=>s.id===id);
  renderPlantView(active,id,info);
}
function setPlantCircuit(id){
  leaveTourForNavigation();
  const circuit=PROCESS_CIRCUITS.find(item=>item.id===id);if(!circuit)return;
  state.plantCircuit=id;state.plantStage='all';document.body.classList.remove('crushing-mode');$('crushing-tools').hidden=true;
  const active=plantModel.setCircuit(id);
  renderPlantView(active,null,{name:circuit.title,summary:circuit.description},circuit);
}
function renderPlantView(active,id,info,circuit=null){
  updateShadowCoverage();
  $('equipment-name').textContent=info?info.name:'选厂工艺全景';$('plant-legend').querySelector('.return').textContent=id==='crushing'?'细碎返筛':'返砂 / 中矿';
  const boundaryCount=plantModel.viewInfo?.boundaries.length||0;
  $('equipment-number').textContent=String(active.length).padStart(2,'0');$('render-state').textContent=id==='crushing'?'7 个工艺节点 · 8 条段内连接':`${active.length} 个节点 · ${boundaryCount?`${boundaryCount} 个跨段接口`:'工艺示意'}`;$('evidence-badge').textContent=id==='crushing'?'外观参考实拍 · 工艺连接据展板 · 布置示意':'结构与线路标高为示意 · 虚线连接待核对';
  $('equipment-model').textContent=circuit?'现场展板 × 公开技术资料':'依据现场展板 · 按工段探索';
  $('equipment-summary').textContent=info?`${info.summary.replace(/。$/,'')}${id==='crushing'?'。':'。边界接口保留上下游关系，点击可查看对应设备。'}`:'选择上方回路，连贯阅读磨矿与浮选；或按工段定位设备。36 个节点覆盖破碎、磨浮、再磨和精尾矿脱水。';
  document.querySelectorAll('[data-stage]').forEach(b=>{b.classList.toggle('active',b.dataset.stage===id);b.setAttribute('aria-pressed',String(b.dataset.stage===id));});
  document.querySelectorAll('[data-circuit]').forEach(b=>{const selected=b.dataset.circuit===circuit?.id;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  renderCircuitGuide(circuit);renderFlowFocusControls();
  clearHotspots();
  for(const node of active){
    const number=String(PLANT_NODES.indexOf(node)+1).padStart(2,'0');
    const button=makeHotspot(node.label,number,()=>selectPlantNode(node.id),()=>plantModel.positionFor(node.id),'process');
    button.dataset.nodeId=node.id;button.classList.toggle('compact-node',id==='all');button.title=`${node.label} · ${node.model}`;
  }
  for(const item of plantModel.annotations().filter(item=>item.kind!=='note'&&!['原矿','粗碎产品','中碎产品'].includes(item.label))){
    const tag=document.createElement(item.targetNodeId?'button':'span');tag.className='flow-label '+(item.kind||'')+(item.targetNodeId&&item.uncertain?' uncertain':'');tag.textContent=item.label;
    tag.dataset.nodeId=item.targetNodeId||'';tag.dataset.edgeFrom=item.from||'';tag.dataset.edgeTo=item.to||'';
    if(item.targetNodeId){tag.type='button';tag.onclick=()=>selectPlantNode(item.targetNodeId);tag.title=`${item.detail||item.label} · 点击查看设备`;tag.setAttribute('aria-label',`查看接口：${item.label}`);}
    hotspotLayer.append(tag);trackHotspot(tag,()=>item.position.clone(),item.targetNodeId?'boundary':'flow');
  }
  resetCamera();
}
function renderCircuitGuide(circuit){
  const panel=$('circuit-guide'),guide=CIRCUIT_GUIDES[circuit?.id];panel.hidden=!guide;if(!guide)return;
  panel.innerHTML=`<div class="circuit-guide-heading"><div><span>${guide.kicker}</span><h3>${guide.headline}</h3></div><div class="circuit-chips">${guide.chips.map(chip=>`<span>${chip}</span>`).join('')}</div></div><p>${guide.explanation}</p><div class="circuit-landmarks"><span>观察节点</span>${guide.nodes.map(id=>`<button data-open-node="${id}">${NODE_BY_ID.get(id).label} ↗</button>`).join('')}</div><small>${guide.note}</small>`;
}
// Tour state stays separate from device motion; exiting restores the previous playback choice.
function leaveTourForNavigation(){if(processTour.snapshot.active&&!tourApplying)endProcessTour(false);}
function startProcessTour(){
  if(!renderer){showManual('process');return;}
  if(!processTour.snapshot.active)tourPreviousRunning=state.running;
  tourApplying=true;
  try{if(!state.overview)enterProcess();}finally{tourApplying=false;}
  processTour.start();tourIndex=-1;tourPercent=-1;tourPauseReason='';state.running=true;
  document.body.classList.add('tour-mode');$('tour-launch').hidden=true;$('tour-statusbar').hidden=false;$('tour-panel').hidden=false;
  $('hero-title').innerHTML='跟随矿流，<br>走过全程<span>。</span>';
  $('hero-description').innerHTML='从原矿破碎到精矿脱水<br>沿主线与支路，逐段观察物料去向';
  $('interaction-hint').innerHTML='<span>↔</span> 拖动即暂停 <i></i> 继续演示恢复跟随 <i></i> 点击设备查看内部';
  applyProcessTourStep();renderProcessTourControls();updatePlay();$('tour-play').focus({preventScroll:true});revealWorkspace();
}
function endProcessTour(refresh=true){
  if(!processTour.snapshot.active)return;
  processTour.stop();tourIndex=-1;tourCameraBounds=null;tourPauseReason='';cameraTween=false;
  plantModel?.clearTourFocus();state.running=tourPreviousRunning;
  document.body.classList.remove('tour-mode');$('tour-launch').hidden=false;$('tour-statusbar').hidden=true;$('tour-panel').hidden=true;
  for(const item of hotspotItems){item.tourRelevant=false;item.button.classList.remove('selected','tour-related');}
  updatePlay();
  if(state.overview){
    $('hero-title').innerHTML='循着矿流，<br>看见全程<span>。</span>';$('hero-description').innerHTML='三段一闭路破碎 · 阶段磨矿与选别<br>四粗两扫五精 · 中矿再磨再选';
    $('equipment-stage').textContent='设备与作业节点 / PLANT';$('equipment-english').textContent='YOUR PLANT. REVEALED.';$('drawing-number').textContent='FLOW. 04 / STAGED CIRCUITS';
    viewport.setAttribute('aria-label','依据现场展板构建的选矿工艺三维图，36个设备与作业节点，支持分工段探索。');
    $('interaction-hint').innerHTML='<span>↔</span> 拖动旋转 <i></i> 选择工段放大 <i></i> 点击设备探索';
    if(refresh){if(state.plantCircuit)setPlantCircuit(state.plantCircuit);else setPlantStage(state.plantStage);}
  }
}
function pauseProcessTour(reason='已暂停'){
  if(!processTour.snapshot.active||processTour.snapshot.completed)return;
  processTour.pause();state.running=false;cameraTween=false;tourPauseReason=reason;renderProcessTourControls();updatePlay();
}
function toggleProcessTour(){
  if(processTour.snapshot.completed){startProcessTour();return;}
  if(processTour.snapshot.playing){pauseProcessTour();return;}
  processTour.resume();tourPauseReason='';state.running=true;frameProcessTour();renderProcessTourControls();updatePlay();
}
function jumpProcessTour(index){
  if(!processTour.snapshot.active)return;
  processTour.pause();processTour.seek(index);state.running=false;tourPauseReason='已暂停 · 已定位环节';
  applyProcessTourStep(true);renderProcessTourControls();updatePlay();
}
function applyProcessTourStep(force=false){
  const {index,step}=processTour.snapshot;if(!step||(!force&&tourIndex===index))return;
  tourIndex=index;tourCameraBounds=null;tourApplying=true;
  try{
    if(step.view.stage&&(state.plantStage!==step.view.stage||state.plantCircuit))setPlantStage(step.view.stage);
    else if(step.view.circuit&&state.plantCircuit!==step.view.circuit)setPlantCircuit(step.view.circuit);
  }finally{tourApplying=false;}
  plantModel.setFlowFocus(step.flowFocus);plantModel.setTourFocus(step);plantModel.setTourProgress(0);
  tourCameraBounds=plantModel.tourBounds();
  const ids=new Set(step.nodeIds),edgeKeys=new Set(step.edges.map(edge=>edge.from+'>'+edge.to));
  for(const item of hotspotItems){
    const {nodeId,edgeFrom,edgeTo}=item.button.dataset;
    item.tourRelevant=ids.has(nodeId)||edgeKeys.has(edgeFrom+'>'+edgeTo);
    item.button.classList.toggle('selected',nodeId===step.primaryNodeId);
    item.button.classList.toggle('tour-related',ids.has(nodeId));
    item.button.classList.remove('compact-node');
  }
  labelSizeDirty=true;
  const chapter=PROCESS_TOUR_CHAPTERS.find(item=>item.id===step.chapterId),node=NODE_BY_ID.get(step.primaryNodeId);
  $('equipment-number').textContent=String(index+1).padStart(2,'0');$('equipment-stage').textContent=chapter.label+' / GUIDED TOUR';
  $('equipment-name').textContent=node.label;$('equipment-model').textContent=node.model;$('equipment-summary').textContent=step.description;
  $('equipment-english').textContent='FOLLOW THE MATERIAL';$('drawing-number').textContent='JOURNEY / '+chapter.label;
  $('render-state').textContent='当前设备高亮 · 沿箭头观察流向';
  $('tour-title').textContent=step.title;$('tour-current-title').textContent=step.title;
  $('tour-description').textContent=step.description;$('tour-transition').textContent=step.transitionNote||'';$('tour-transition').hidden=!step.transitionNote;
  $('tour-step-select').value=String(index);
  if($('tour-devices').contains(document.activeElement))$('tour-play').focus({preventScroll:true});
  $('tour-devices').replaceChildren();
  for(const id of step.nodeIds){
    const button=document.createElement('button');button.type='button';button.dataset.tourNode=id;
    button.classList.toggle('current',id===step.primaryNodeId);button.textContent=(id===step.primaryNodeId?'当前 · ':'')+NODE_BY_ID.get(id).label+' ↗';
    button.title='结束演示，查看设备内部';button.onclick=()=>selectPlantNode(id);$('tour-devices').append(button);
  }
  for(const button of $('tour-chapters').children){
    const current=button.dataset.chapter===step.chapterId;
    if(current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    const last=PROCESS_TOUR_STEPS.findLastIndex(item=>item.chapterId===button.dataset.chapter);
    button.classList.toggle('complete',last<index);
  }
  viewport.setAttribute('aria-label',`${step.title}。当前设备：${node.label}。${step.description}拖动模型会暂停演示。`);
  frameProcessTour();
}
function frameProcessTour(immediate=false){
  if(!tourCameraBounds||tourCameraBounds.isEmpty())return;
  const center=tourCameraBounds.getCenter(new THREE.Vector3()),progress=processTour.snapshot.stepProgress;
  const materialPosition=reduceMotion?null:plantModel.tourPosition(progress);
  // Small tracking motion retains the complete local route and space for labels.
  targetGoal.copy(center);if(materialPosition){materialPosition.y=center.y;targetGoal.lerp(materialPosition,.12);}
  const direction=new THREE.Vector3(.22,.85,1).normalize(),right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()/2)),tanH=tanV*camera.aspect;
  let distance=10;
  for(const x of [tourCameraBounds.min.x,tourCameraBounds.max.x])for(const y of [tourCameraBounds.min.y,tourCameraBounds.max.y])for(const z of [tourCameraBounds.min.z,tourCameraBounds.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(targetGoal);
    distance=Math.max(distance,offset.dot(direction)+Math.max(Math.abs(offset.dot(right))/(tanH*.74),Math.abs(offset.dot(up))/(tanV*.8)));
  }
  controls.maxDistance=Math.max(180,distance*1.2);cameraGoal.copy(targetGoal).addScaledVector(direction,distance);cameraTween=true;
  if(immediate||reduceMotion){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraTween=false;controls.update();}
}
function renderProcessTourControls(){
  const snapshot=processTour.snapshot;if(!snapshot.active)return;
  const {playing,completed,index,progress}=snapshot,percent=Math.round(progress*100);
  $('tour-state').textContent=completed?'全流程演示完成':playing?'正在跟随矿流':tourPauseReason||'已暂停';
  $('tour-position').textContent=`${String(index+1).padStart(2,'0')} / ${PROCESS_TOUR_STEPS.length} · ${percent}%`;
  $('tour-play').textContent=completed?'再看一次':playing?'暂停演示':'继续演示';$('tour-play').setAttribute('aria-pressed',String(playing));
  $('tour-prev').disabled=index===0;$('tour-next').disabled=completed;
  if(percent!==tourPercent){tourPercent=percent;$('tour-fill').style.width=percent+'%';$('tour-meter').setAttribute('aria-valuenow',percent);}
  $('tour-meter').setAttribute('aria-valuetext',`${snapshot.step.title}，全程 ${percent}%${completed?'，已完成':''}`);
}
function updateProcessTour(dt){
  if(!processTour.snapshot.active)return;
  const wasPlaying=processTour.snapshot.playing;processTour.tick(dt);
  const snapshot=processTour.snapshot;
  if(snapshot.index!==tourIndex)applyProcessTourStep();
  plantModel?.setTourProgress(snapshot.stepProgress);
  if(snapshot.playing&&!reduceMotion)frameProcessTour();
  if(wasPlaying&&snapshot.completed){state.running=false;cameraTween=false;renderProcessTourControls();updatePlay();}
  else if(Math.round(snapshot.progress*100)!==tourPercent)renderProcessTourControls();
}
function collectLabelBounds(root,cache){
  const bounds=new THREE.Box3(),meshBounds=new THREE.Box3();
  for(let parent=root;parent;parent=parent.parent)if(!parent.visible)return bounds;
  root.traverseVisible(object=>{
    if(!object.isMesh||object.userData.labelObstacle===false)return;
    const material=object.material;
    if(Array.isArray(material)?material.every(m=>!m.visible):material&&!material.visible)return;
    let entry=cache.get(object);
    if(object.isInstancedMesh){
      if(!entry||entry.version!==object.instanceMatrix.version||entry.count!==object.count){
        object.computeBoundingBox();entry={box:object.boundingBox.clone(),version:object.instanceMatrix.version,count:object.count};cache.set(object,entry);
      }
    }else{
      if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
      entry={box:object.geometry.boundingBox};
    }
    if(entry.box&&!entry.box.isEmpty())bounds.union(meshBounds.copy(entry.box).applyMatrix4(object.matrixWorld));
  });
  return bounds;
}
function modelLabelObstacles(width,height){
  const roots=state.overview
    ? [...(plantModel?.labelObjects?.values()||[])].filter(visibleAncestors).map(holder=>holder.children[0]).filter(Boolean)
    : current?.parts.map(part=>part.root)||[];
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const rectangles=[];
  for(const root of roots){
    const bounds=collectLabelBounds(root,labelBoundsCache);
    const rect=projectBoundsToScreen(bounds,projection.elements,width,height);
    if(rect)rectangles.push(rect);
  }
  if(!state.overview&&rectangles.length){
    // Keep single-equipment names outside its complete visible silhouette,
    // including gaps between exploded parts. Scene floor/decorations are absent.
    return [{left:Math.min(...rectangles.map(r=>r.left)),top:Math.min(...rectangles.map(r=>r.top)),
      right:Math.max(...rectangles.map(r=>r.right)),bottom:Math.max(...rectangles.map(r=>r.bottom))}];
  }
  return rectangles;
}
function updateHotspots(){
  if(!hotspotItems.length)return;
  camera.updateMatrixWorld();
  const w=viewport.clientWidth,h=viewport.clientHeight,rect=viewport.getBoundingClientRect();
  if(labelSizeDirty){
    for(const item of hotspotItems){item.width=item.button.offsetWidth;item.height=item.button.offsetHeight;}
    labelSizeDirty=false;
  }
  const obstacles=state.labels?modelLabelObstacles(w,h):[];
  for(const element of document.querySelectorAll('.view-compass,#plant-hover')){
    if(element.hidden||!element.getClientRects().length)continue;
    const box=element.getBoundingClientRect();
    obstacles.push({left:box.left-rect.left,top:box.top-rect.top,right:box.right-rect.left,bottom:box.bottom-rect.top});
  }
  const candidates=[],anchors=new Map();
  hotspotItems.forEach((item,id)=>{
    if(processTour.snapshot.active&&!item.tourRelevant)return;
    const anchorPosition=item.position();if(!anchorPosition)return;
    const vector=anchorPosition.project(camera),x=(vector.x*.5+.5)*w,y=(-vector.y*.5+.5)*h;
    if(!state.labels||!Number.isFinite(x+y)||vector.z>1||vector.z< -1||x<0||x>w||y<0||y>h)return;
    anchors.set(id,{x,y});
    candidates.push({id,x,y,width:item.width,height:item.height,compact:item.button.classList.contains('compact-node'),priority:item.button.classList.contains('selected')?200:item.type==='part'?100:item.type==='process'?80:item.type==='boundary'?60:30});
  });
  const placed=new Map(layoutLabels(candidates,{left:8,top:8,right:w-8,bottom:h-8},obstacles).map(item=>[item.id,item]));
  hotspotItems.forEach((item,id)=>{
    const result=placed.get(id),shown=!!result&&!result.hidden,anchor=anchors.get(id);
    item.button.toggleAttribute('data-layout-hidden',!shown);item.button.setAttribute('aria-hidden',String(!shown));
    if(item.button.tagName==='BUTTON')item.button.tabIndex=shown?0:-1;
    item.line.style.display='none';
    if(!shown)return;
    item.button.style.left=`${result.x}px`;item.button.style.top=`${result.y}px`;
    if(Math.hypot(result.x-anchor.x,result.y-anchor.y)>10){
      const dx=anchor.x-result.x,dy=anchor.y-result.y;
      const factor=Math.min((item.width/2)/Math.max(Math.abs(dx),.001),(item.height/2)/Math.max(Math.abs(dy),.001),1);
      item.line.setAttribute('x1',anchor.x);item.line.setAttribute('y1',anchor.y);
      item.line.setAttribute('x2',result.x+dx*factor);item.line.setAttribute('y2',result.y+dy*factor);item.line.style.display='';
    }
  });
}
function animate(now){requestAnimationFrame(animate);if(document.hidden){last=now;return;}const dt=Math.min((now-last)/1000,.05);last=now;updateProcessTour(dt);if(state.running)state.time+=dt;
  if(cameraTween){camera.position.lerp(cameraGoal,1-Math.exp(-dt*4));controls.target.lerp(targetGoal,1-Math.exp(-dt*4));if(camera.position.distanceTo(cameraGoal)<.015)cameraTween=false;}
  if(current&&!state.overview){
    if(state.view==='exploded'){
      if(explosion.playing){explosion.progress=Math.min(1,explosion.progress+dt/(Math.max(1,explosion.steps.length)*1.65));explosion.target=explosion.progress;if(explosion.progress===1){explosion.playing=false;updatePlay();}}
      else{const difference=explosion.target-explosion.progress;if(Math.abs(difference)<.001){if(explosion.progress!==explosion.target){explosion.progress=explosion.target;updatePlay();}}else explosion.progress+=difference*(reduceMotion?1:1-Math.exp(-dt*7));}
      applyExplosionPose(current,explosion.steps,explosion.progress);updateExplosionControls();explosion.guides?.update(activeExplosionStep(),state.labels);
    }else{
      for(const p of current.parts)p.root.position.lerp(p.base,reduceMotion?1:1-Math.exp(-dt*5));
      if(state.running)current.update?.(dt,state.time);
      if(state.view==='cutaway')updateOperationCycle();
    }
    if(state.selected){const p=current.parts.find(x=>x.id===state.selected);outline.box.setFromObject(p.root);}
  }
  if(state.overview&&state.running)plantModel?.update(dt,state.time);
  controls.update();scene.updateMatrixWorld();updateHotspots();renderer.render(scene,camera);
}
function explosionMoving(){return explosion.playing||Math.abs(explosion.target-explosion.progress)>=.001;}
function updatePlay(){const b=$('play-button'),exploded=state.view==='exploded'&&!state.overview,playing=exploded?explosionMoving():state.running;
  const label=processTour.snapshot.active?(processTour.snapshot.completed?'重新全流程演示':playing?'暂停全流程演示':'继续全流程演示'):exploded?(playing?'暂停拆解演示':'播放拆解演示'):(playing?'暂停演示动画':'播放演示动画');
  b.setAttribute('aria-pressed',String(playing));b.setAttribute('aria-label',label);b.title=label;
  $('cycle-play').textContent=state.running?'暂停周期':'继续周期';$('cycle-play').setAttribute('aria-pressed',String(state.running));
  $('explosion-play').textContent=explosionMoving()?'暂停演示':'播放演示';$('explosion-play').setAttribute('aria-pressed',String(explosionMoving()));
  b.innerHTML=playing?'<svg viewBox="0 0 20 20"><path d="M7 4v12 M13 4v12"/></svg>':'<svg viewBox="0 0 20 20"><path d="m6 3 10 7-10 7Z"/></svg>';
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function sourceLinks(sources){return `<div class="source-links">${sources.map(s=>`<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title} ↗</a>`).join('')}</div>`;}
function nodeLinks(node){
  const rows=PLANT_EDGES.filter(e=>e.from===node.id||e.to===node.id).map(e=>{
    const outbound=e.from===node.id,other=NODE_BY_ID.get(outbound?e.to:e.from);
    return `<button class="connection-row" data-open-node="${other.id}"><span>${outbound?'去向 →':'来自 ←'} ${other.label}</span><small>${e.label||({main:'物料',return:'回流',concentrate:'精矿',water:'水路',tailings:'尾矿'}[e.kind])}${e.uncertain?' · 暂定':''}</small></button>`;
  });
  return `<h3>在生产流程中的位置</h3><div class="connections">${rows.join('')}</div>`;
}
function showManual(which=state.overview?'process':state.id){
  if(processTour.snapshot.active)pauseProcessTour('已暂停 · 阅读资料');
  const container=$('dialog-content'),dialog=$('info-dialog');dialog.classList.toggle('wide-dialog',['references','directory','technology'].includes(which));
  if(which==='technology'){
    container.innerHTML=`<div class="en">TECHNICAL NOTES / ${RESEARCH_DATE}</div><h2>读懂长安的阶段磨浮。</h2><p>公开工程案例与政府公示报告印证了阶段磨浮、中矿再磨的总体路线。设备型号、台数组别及逐条连接继续依据你们提供的现场展板。</p><div class="technology-principle"><span>为什么分段、分流处理？</span><p>让已具备回收条件的矿物先进入选别，再对需要进一步解离的物料磨矿。中矿另行再磨，兼顾解离需求与过磨、泥化风险。“分速”指矿物浮选速度的差异；动画速度不表示实际流速。</p><a href="https://patents.google.com/patent/CN102284369B/zh" target="_blank" rel="noopener noreferrer">通用原理：原始专利说明书 ↗</a></div><div class="technology-circuits">${PROCESS_CIRCUITS.map((c,i)=>`<button data-open-circuit="${c.id}"><span>0${i+1}</span><strong>${c.title}</strong><small>进入三维回路 ↗</small></button>`).join('')}</div><h3>公开资料与适用范围</h3><div class="technical-sources">${TECHNICAL_SOURCES.map(s=>`<article><div class="source-meta">${s.publisher} · 发布 ${s.date}</div><h4><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title} ↗</a></h4><span class="source-period">${s.period}</span><p>${s.finding}</p><small>${s.limit}</small></article>`).join('')}</div><h3>保留的版本差异</h3><dl class="technical-differences">${TECHNICAL_DIFFERENCES.map(([label,note])=>`<div><dt>${label}</dt><dd>${note}</dd></div>`).join('')}</dl><p class="caption-note">资料检索截至 ${RESEARCH_DATE}。摘要保存在本地，查看外部原文需要联网。三维模型为原理示意，展板指标不是实时数据。</p>`;
  }else if(which==='references'){
    const gallery=items=>`<div class="reference-gallery">${items.map(item=>`<a href="${item.url}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${item.url}" alt="${item.title}"><span>${item.title} ↗</span><small>${item.note}</small></a>`).join('')}</div>`;
    container.innerHTML=`<div class="en">FIELD REFERENCES / LOCAL ARCHIVE</div><h2>让每一处还原，有据可查。</h2><p>八张资料保存在本地。工艺连接按原流程图；设备外观按实拍更新，未拍到的内部和未确认的设备对应保留说明。</p><h3>2026.10.21 / 破碎工段实拍</h3>${gallery(SITE_REFERENCES)}<h3>2026.10.12 / 工艺展板与教学模型</h3>${gallery(BOARD_REFERENCES)}<h3>核对记录</h3><ul class="reference-notes">${REFERENCE_NOTES.map(n=>`<li>${n}</li>`).join('')}</ul>`;
  }else if(which==='directory'){
    container.innerHTML=`<div class="en">PLANT INDEX / ${PLANT_NODES.length} NODES</div><h2>设备与作业目录</h2><p>点击节点进入三维内部。重复作业使用同类原理模型，具体台数与结构未从照片推定。</p>${PLANT_STAGES.map(s=>`<h3>${s.name}</h3><div class="node-index">${PLANT_NODES.filter(n=>n.stage===s.id).map(n=>`<button data-open-node="${n.id}"><strong>${n.label}</strong><span>${n.model}</span><i>↗</i></button>`).join('')}</div>`).join('')}`;
  }else if(which==='about'){
    container.innerHTML=`<div class="en">长安金矿 / FIELD EDITION 004</div><h2>让现场资料，<br>变成可以探索的世界。</h2><p>本版已接入八张现场资料，按新实拍更新 CC300、颚破、筛箱和胶带机，并加入破碎工段专属场景。展开 ${PLANT_NODES.length} 个流程节点，可以逐段查看内部结构。</p><p class="about-note">工艺节点和型号来自展板；CC300 铭牌已由实拍确认。颚破、筛分外罩与胶带机按现场外观表达，具体节点对应仍待核对；内部结构采用教学模型和通用原理。空间布置与尺寸仍为示意，尚未取得制造图或现场测绘数据。</p><div class="roadmap"><div><span>01 / REFERENCES</span><h3>有据可查</h3><p>八张参考照片本地保存<br>型号差异与暂定回流单独标注</p></div><div><span>02 / EXPLORE</span><h3>逐段理解</h3><p>六个工段 · 可交互的内部结构<br>36 个设备与作业节点</p></div><div><span>03 / NEXT</span><h3>按现场校准</h3><p>结合总装图和实测尺寸<br>补齐特定型号内部结构</p></div></div>`;
  }else if(which==='process'){
    container.innerHTML=`<div class="en">STAGED GRINDING & FLOTATION</div><h2>从一条线，到完整回路。</h2><p>${PROCESS_NOTE}</p><div class="plant-metrics">${PLANT_METRICS.map(m=>`<div><span>${m.label}</span><strong>${m.value}</strong><small>${m.source}</small></div>`).join('')}</div><ol>${PLANT_STAGES.map(s=>`<li><strong>${s.name}</strong><br>${s.summary}</li>`).join('')}</ol><h3>如何读取三维流程</h3><p>米金色表示物料主线，金色表示精矿，青绿表示返砂或中矿回流，灰绿表示尾矿，蓝色表示回水。虚线表示照片中交叉密集、仍待核对的暂定连接。</p><h3>需要核对的连接</h3><ul class="reference-notes">${PLANT_EDGES.filter(e=>e.uncertain).map(e=>`<li>${NODE_BY_ID.get(e.from).label} → ${NODE_BY_ID.get(e.to).label}：${e.label}</li>`).join('')}</ul><p class="about-note">36 个节点包括单台设备和作业机组；三台斜板浓密机合成一个机组节点。布局用于读懂工艺，不代表厂房坐标。</p>${sourceLinks([{title:'查看原始流程图',url:'./references/reference-01.jpg'},{title:'查看原始工艺简介',url:'./references/reference-02.jpg'}])}`;
  }else{
    const d=equipmentRecord(which,state.nodeId),node=NODE_BY_ID.get(state.nodeId);if(!d)return;
    container.innerHTML=`<div class="en">${d.number} / ${d.enName}</div><h2>${node?.label||d.name}</h2><div class="model-pill">${node?.model||d.model||'原理示意'}</div>${node?`<p class="about-note">${node.note}</p>`:''}<p>${d.description}</p><h3>工作原理</h3><p>${d.principle}</p><div class="flow-io"><div><span>INPUT / 给料</span><strong>${d.input}</strong></div><div><span>OUTPUT / 产物</span><strong>${d.output}</strong></div></div>${node?nodeLinks(node):''}<h3>三个观察时刻</h3><ol>${d.steps.map(s=>`<li>${s}</li>`).join('')}</ol><h3>观察重点</h3><p>${d.focus.join('　 / 　')}</p><p class="about-note">${d.evidence||'设备结构与运动为原理示意，尺寸未按制造图校准。'}</p><h3>资料依据</h3>${sourceLinks(d.sources)}<p class="caption-note">展板指标不是实时数据。图中钢球、矿粒与气泡的运动用于教学，不代表精确动力学。</p>`;
  }
  if(['process','references'].includes(which))container.insertAdjacentHTML('afterbegin','<button class="technical-inline-link" data-open-technology>新增：公开技术资料与版本核对 ↗</button>');
  if(!dialog.open)dialog.showModal();container.scrollTop=0;
}

$('tour-start').onclick=startProcessTour;$('tour-replay').onclick=startProcessTour;$('tour-play').onclick=toggleProcessTour;
$('tour-exit').onclick=()=>{endProcessTour();$('tour-start').focus({preventScroll:true});};
$('tour-prev').onclick=()=>jumpProcessTour(processTour.snapshot.index-1);
$('tour-next').onclick=()=>{if(processTour.snapshot.index<PROCESS_TOUR_STEPS.length-1)jumpProcessTour(processTour.snapshot.index+1);else{processTour.next();state.running=false;cameraTween=false;plantModel?.setTourProgress(1);renderProcessTourControls();updatePlay();}};
$('tour-step-select').onchange=event=>jumpProcessTour(Number(event.target.value));
for(const [index,chapter]of PROCESS_TOUR_CHAPTERS.entries()){
  const button=document.createElement('button');button.type='button';button.dataset.chapter=chapter.id;
  const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');button.append(number,document.createTextNode(chapter.label));
  button.onclick=()=>jumpProcessTour(PROCESS_TOUR_STEPS.findIndex(step=>step.chapterId===chapter.id));$('tour-chapters').append(button);
}
for(const [index,step]of PROCESS_TOUR_STEPS.entries()){
  const option=document.createElement('option');option.value=String(index);option.textContent=String(index+1).padStart(2,'0')+' / '+step.title;$('tour-step-select').append(option);
}

// Every visible control has a corresponding stateful operation.
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>applyView(b.dataset.view));
$('play-button').onclick=()=>{
  if(processTour.snapshot.active){toggleProcessTour();return;}
  if(state.view==='exploded'&&!state.overview){if(explosionMoving()){explosion.playing=false;explosion.target=explosion.progress;}else{if(explosion.progress>=.999)explosion.progress=0;explosion.target=explosion.progress;explosion.playing=true;}}
  else state.running=!state.running;updatePlay();
};
$('cycle-play').onclick=()=>$('play-button').click();
$('cycle-restart').onclick=()=>{current?.restartOperation?.();state.running=true;updatePlay();cyclePhase='';cyclePercent=-1;updateOperationCycle();};
$('recovery-circuit-button').onclick=()=>{state.plantCircuit='recovery';enterProcess();};
$('operation-all').onclick=()=>setOperationStep(-1);
$('operation-part').onclick=()=>{const step=current?.operationGuide?.steps[operationStep];if(step?.partId)selectPart(step.partId);};
for(const option of FLOW_FOCUS_OPTIONS){
  const button=document.createElement('button');button.type='button';button.dataset.flowFocus=option.id;button.textContent=option.label;
  button.setAttribute('aria-pressed',String(option.id==='all'));
  button.onclick=()=>{if(plantModel&&state.overview)updateFlowFocusControls(plantModel.setFlowFocus(option.id));};
  $('slurry-selector').append(button);
}
$('explosion-play').onclick=()=>$('play-button').click();
$('explosion-range').addEventListener('input',event=>seekExplosion(Number(event.target.value)/100,true));
$('explosion-expand').onclick=()=>seekExplosion(1);
$('explosion-collapse').onclick=()=>seekExplosion(0);
$('explosion-replay').onclick=()=>{if(state.overview||state.view!=='exploded')return;seekExplosion(0,true);explosion.playing=true;updatePlay();};
$('reset-button').onclick=()=>{resetCamera();toast('已重置观察视角');};
$('labels-button').onclick=()=>{state.labels=!state.labels;$('labels-button').setAttribute('aria-pressed',String(state.labels));$('labels-button').querySelector('.toggle').classList.toggle('active',state.labels);};
$('parts-button').onclick=()=>{if(!current)return;if(!$('part-drawer').hidden){closeParts();return;}selectPart(current.parts[0].id);};
$('close-parts').onclick=closeParts;
$('equipment-nav').onclick=()=>selectEquipment(state.id,false,state.nodeId);
$('process-nav').onclick=enterProcess;
$('crushing-entry').onclick=()=>{state.plantCircuit=null;state.plantStage='crushing';enterProcess();};
$('site-conveyor').onclick=()=>selectEquipment('conveyor');
document.querySelectorAll('[data-crushing-focus]').forEach(b=>b.onclick=()=>{plantModel.setCrushingFocus(b.dataset.crushingFocus);$('crushing-caption').textContent=({all:'±40 mm 预筛分流 · ±10 mm 细碎闭路',coarse:'原矿 → 粗碎 → 预筛；筛上进入中碎',screening:'筛上 +40 mm → 中碎；筛下 −40 mm 旁路',closed:'筛上 +10 mm → CC300 → 返筛；筛下 −10 mm → 矿仓'})[b.dataset.crushingFocus];document.querySelectorAll('[data-crushing-focus]').forEach(item=>{item.classList.toggle('active',item===b);item.setAttribute('aria-pressed',String(item===b));});resetCamera();});
$('flow-toggle').onclick=()=>state.overview?selectEquipment(state.id,false,state.nodeId):enterProcess();
$('reference-nav').onclick=()=>showManual('references');$('reference-button').onclick=()=>showManual('references');$('node-directory').onclick=()=>showManual('directory');$('back-to-process').onclick=enterProcess;
$('dialog-content').addEventListener('click',event=>{
  const button=event.target.closest('[data-open-node]');if(button)selectPlantNode(button.dataset.openNode);
  const circuit=event.target.closest('[data-open-circuit]');if(circuit){$('info-dialog').close();state.plantCircuit=circuit.dataset.openCircuit;enterProcess();}
  if(event.target.closest('[data-open-technology]'))showManual('technology');
});
$('technology-button').onclick=()=>showManual('technology');
$('circuit-guide').addEventListener('click',event=>{const button=event.target.closest('[data-open-node]');if(button)selectPlantNode(button.dataset.openNode);});
for(const [i,circuit]of PROCESS_CIRCUITS.entries()){const b=document.createElement('button');b.dataset.circuit=circuit.id;b.innerHTML=`<span>0${i+1}</span>${circuit.title}`;b.setAttribute('aria-pressed','false');b.onclick=()=>setPlantCircuit(circuit.id);$('circuit-selector').append(b);}
const stageNames={crushing:'破碎筛分',grinding:'磨矿分级',flotation:'阶段浮选',regrinding:'中矿再磨',dewatering:'精矿脱水',water:'尾矿回水'};
for(const s of [{id:'all',name:'全部工段'},...PLANT_STAGES]){const b=document.createElement('button');b.dataset.stage=s.id;b.textContent=stageNames[s.id]||s.name;b.onclick=()=>setPlantStage(s.id);$('stage-selector').append(b);}
$('principle-nav').onclick=()=>showManual();$('learn-button').onclick=()=>showManual();$('about-button').onclick=()=>showManual('about');$('close-dialog').onclick=()=>$('info-dialog').close();
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const rect=$('info-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('info-dialog').close();}});
$('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.workspace').requestFullscreen)await document.querySelector('.workspace').requestFullscreen();else toast('当前浏览器不支持全屏模式');}catch{toast('当前浏览器未允许全屏，请使用浏览器全屏功能。');}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeParts();if(processTour.snapshot.active)pauseProcessTour('已暂停');}});
window.addEventListener('error',event=>{if(!$('loading').hidden){$('loading').innerHTML='<span>模型加载遇到问题</span><small>请刷新页面重试，或通过原理手册查看设备说明。</small>';}});
init();
