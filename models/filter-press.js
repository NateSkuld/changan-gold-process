import * as THREE from 'three';

// Generic recessed-plate press. Counts, proportions and linkage geometry are
// educational; they do not identify the internals of the field-board model.
const UP = new THREE.Vector3(0, 1, 0);
const PLATE_COUNT = 8, FIRST_X = -2.45, CLOSED_PITCH = .24, OPEN_PITCH = .54;
const PLATE_Y = 2.42, DURATION = 25;
const PHASES = [
  {id:'clamping',label:'压紧密封',duration:3,description:'滤板沿横梁合拢，活动压紧板建立密封；此时不进浆。'},
  {id:'filtering',label:'进浆过滤',duration:8,description:'板组保持闭合。矿浆进入滤室，固体形成滤饼，滤液穿过滤布后汇集排出。'},
  {id:'depressurizing',label:'停泵卸压',duration:2.5,description:'停止给矿，示意内部压力解除；板组保持闭合。'},
  {id:'opening',label:'拉开滤板',duration:4.5,description:'确认停止进浆并卸压后，压紧板退回，拉板连接件将滤板分开。'},
  {id:'discharging',label:'滤饼下落',duration:4,description:'滤板保持打开，滤饼脱离滤布并下落至承饼托盘。'},
  {id:'resetting',label:'机构复位',duration:3,description:'拉板小车返回、托盘中的滤饼向出料端转移，准备下一次压紧。'},
];
const smooth = n => {const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const toVector = p => new THREE.Vector3(...p);

export function createFilter() {
  const group=new THREE.Group(),parts=[],cache=new Map();group.name='板式压滤机 · 间歇固液分离';
  const materials={
    teal:new THREE.MeshStandardMaterial({color:0x2a716a,metalness:.55,roughness:.4,side:THREE.DoubleSide}),
    edge:new THREE.MeshStandardMaterial({color:0x4b8b7d,metalness:.5,roughness:.38,side:THREE.DoubleSide}),
    dark:new THREE.MeshStandardMaterial({color:0x273c3d,metalness:.62,roughness:.43}),
    steel:new THREE.MeshStandardMaterial({color:0x8fa7a0,metalness:.8,roughness:.3,side:THREE.DoubleSide}),
    brass:new THREE.MeshStandardMaterial({color:0xbd9b60,metalness:.67,roughness:.35}),
    rubber:new THREE.MeshStandardMaterial({color:0x465750,metalness:.06,roughness:.87,side:THREE.DoubleSide}),
    cloth:new THREE.MeshStandardMaterial({color:0xd2d2b8,metalness:0,roughness:1,side:THREE.DoubleSide}),
    weave:new THREE.MeshStandardMaterial({color:0x969e87,metalness:0,roughness:1,side:THREE.DoubleSide}),
    cake:new THREE.MeshStandardMaterial({color:0x9c7849,metalness:.03,roughness:.96}),
    feed:new THREE.MeshBasicMaterial({color:0xdfad66,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}),
    water:new THREE.MeshBasicMaterial({color:0x69d6e2,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}),
  };
  const geometry=(key,build)=>{if(!cache.has(key))cache.set(key,build());return cache.get(key);};
  function mesh(parent,geo,material,pos=[0,0,0],rot=[0,0,0],cutaway=false){const o=new THREE.Mesh(geo,material);o.position.set(...pos);o.rotation.set(...rot);o.castShadow=o.receiveShadow=true;if(cutaway)o.userData.cutaway=true;parent.add(o);return o;}
  const box=(p,size,pos,mat=materials.teal,cut=false)=>mesh(p,geometry('box:'+size.join(','),()=>new THREE.BoxGeometry(...size)),mat,pos,undefined,cut);
  function cylinder(p,r,h,pos,mat=materials.steel,axis='y',segments=20){return mesh(p,geometry(`cyl:${r}:${h}:${segments}`,()=>new THREE.CylinderGeometry(r,r,h,segments)),mat,pos,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:undefined);}
  function ring(p,r,t,pos,mat=materials.brass,axis='y'){return mesh(p,geometry(`ring:${r}:${t}`,()=>new THREE.TorusGeometry(r,t,8,40)),mat,pos,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:undefined);}
  function beam(p,a,b,r=.04,mat=materials.steel){const start=toVector(a),end=toVector(b),v=end.clone().sub(start);const o=cylinder(p,r,v.length(),start.add(end).multiplyScalar(.5).toArray(),mat,'y',10);o.quaternion.setFromUnitVectors(UP,v.normalize());return o;}
  function part(id,name,description,anchor,explode){const root=new THREE.Group();root.name=name;root.userData.partId=id;group.add(root);parts.push({id,name,description,root,anchor:toVector(anchor),explode:toVector(explode)});return root;}
  function flange(parent,pos,r,axis='x'){
    const p=new THREE.Group();p.position.set(...pos);if(axis==='x')p.rotation.z=Math.PI/2;parent.add(p);
    const points=[[r*.57,-.055],[r,-.055],[r,.055],[r*.57,.055],[r*.57,-.055]].map(v=>new THREE.Vector2(...v));
    mesh(p,geometry(`flange:${r}`,()=>new THREE.LatheGeometry(points,28)),materials.steel);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(p,.032,.13,[Math.sin(a)*r*.8,0,Math.cos(a)*r*.8],materials.brass,'y',6);}
  }
  function pipe(parent,points,r=.1,material=materials.teal,section=false){
    const curve=new THREE.CatmullRomCurve3(points.map(toVector),false,'centripetal');
    const full=mesh(parent,new THREE.TubeGeometry(curve,Math.max(24,points.length*8),r,10,false),material,undefined,undefined,section);
    if(section){
      // Back half has thickness and stays visible after the front casing is removed.
      const count=40,radial=7,positions=[],indices=[],stride=(radial+1)*2;
      const pt=new THREE.Vector3(),tangent=new THREE.Vector3(),normal=new THREE.Vector3(),binormal=new THREE.Vector3(),v=new THREE.Vector3();
      for(let i=0;i<=count;i++){
        curve.getPointAt(i/count,pt);curve.getTangentAt(i/count,tangent);normal.set(0,0,1).addScaledVector(tangent,-tangent.z);
        if(normal.lengthSq()<.01)normal.set(0,1,0).addScaledVector(tangent,-tangent.y);normal.normalize();binormal.crossVectors(tangent,normal).normalize();
        for(const radius of [r,r*.72])for(let j=0;j<=radial;j++){const a=Math.PI/2+j/radial*Math.PI;v.copy(pt).addScaledVector(normal,Math.cos(a)*radius).addScaledVector(binormal,Math.sin(a)*radius);positions.push(v.x,v.y,v.z);}
      }
      const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
      for(let i=0;i<count;i++){for(let j=0;j<radial;j++){const k=i*stride+j,h=k+radial+1;quad(k,k+1,k+stride+1,k+stride);quad(h,h+stride,h+stride+1,h+1);}for(const j of [0,radial]){const k=i*stride+j;quad(k,k+radial+1,k+stride+radial+1,k+stride);}}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const back=mesh(parent,geo,material);back.userData.sectionOnly=true;
    }
    return {curve,full};
  }
  function visual(o){o.userData.labelObstacle=false;o.userData.operationVisual=true;o.raycast=()=>{};o.castShadow=o.receiveShadow=false;return o;}
  function fixedBounds(batch,min,max){batch.boundingBox=new THREE.Box3(toVector(min),toVector(max));batch.boundingSphere=batch.boundingBox.getBoundingSphere(new THREE.Sphere());}
  function batch(parent,geo,mat,count,name,decorative=false){const result=new THREE.InstancedMesh(geo,mat,count);result.name=name;result.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(decorative)visual(result);parent.add(result);return result;}
  function plateFace(width,height,depth,half=0){
    return geometry(`face:${width}:${height}:${depth}:${half}`,()=>{
      const s=new THREE.Shape(),r=.14;
      if(half===0){s.moveTo(-width/2,-height/2);s.lineTo(width/2,-height/2);s.lineTo(width/2,height/2);s.lineTo(-width/2,height/2);s.closePath();const hole=new THREE.Path();hole.absarc(0,0,r,0,Math.PI*2,true);s.holes.push(hole);}
      else {s.moveTo(0,-height/2);s.lineTo(width/2,-height/2);s.lineTo(width/2,height/2);s.lineTo(0,height/2);s.lineTo(0,r);for(let i=0;i<=20;i++){const a=Math.PI/2-i/20*Math.PI;s.lineTo(Math.cos(a)*r,Math.sin(a)*r);}s.lineTo(0,-height/2);s.closePath();}
      const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:12});g.translate(0,0,-depth/2);g.rotateY(Math.PI/2);if(half===-1)g.rotateY(Math.PI);return g;
    });
  }

  const frame=part('filter-frame','机架与横梁','横梁承载滤板组，止推板承受压紧力。机架把液压压紧、过滤和卸饼机构连为整体；长度、滤板数量与支承布置为教学比例。',[-2.9,2.1,1],[0,0,-2.8]);
  for(const x of [-3.02,2.1,4.65])for(const z of [-1.15,1.15]){
    box(frame,[.66,.12,.58],[x,.08,z],materials.dark);box(frame,[.23,2.36,.23],[x,1.28,z],materials.dark);
    for(const dx of [-.23,.23])cylinder(frame,.045,.1,[x+dx,.18,z],materials.steel,'y',6);
  }
  for(const z of [-1.15,1.15]){
    box(frame,[8,.20,.2],[.8,2.59,z],materials.dark);box(frame,[8,.035,.26],[.8,2.715,z],materials.steel);
    box(frame,[7.9,.17,.18],[.8,.58,z],materials.dark);
    for(const x of [-2.98,2.1])beam(frame,[x,.65,z],[x+.85,1.45,z],.045,materials.edge);
  }
  mesh(frame,plateFace(2.4,2.38,.3),materials.teal,[-2.78,PLATE_Y,0]);
  for(const y of [1.39,3.45])for(const z of [-.99,.99])cylinder(frame,.065,.16,[-2.97,y,z],materials.brass,'x',6);
  box(frame,[.28,1.5,2.25],[4.65,2.4,0],materials.teal);
  for(const z of [-.86,.86])beam(frame,[-2.8,3.65,z],[-2.8,3.85,z],.04,materials.steel);

  const plates=part('filter-plates','滤板组与滤室','滤板在压紧状态下密封形成滤室。过滤期间板组保持不动；完成停泵与卸压后才分板。模型以八块滤板表示重复结构，不是现场台数或板数。',[-1.5,3.1,.5],[0,.25,3.0]);
  const cloths=part('filter-cloth','滤布与滤液通道','滤布覆盖滤板排液面，截留固体。滤液穿过滤布，经板面沟槽和低位出口汇集；中心给矿孔与滤液通道分开。',[-1.1,2.4,.15],[0,2.8,0]);
  const plateGroups=[],clothGroups=[],portGroups=[];
  const dummy=new THREE.Object3D();
  for(let i=0;i<PLATE_COUNT;i++){
    const p=new THREE.Group(),c=new THREE.Group();p.name=`滤板 ${i+1}`;c.name=`滤布 ${i+1}`;p.userData.plateIndex=i;c.userData.plateIndex=i;plates.add(p);cloths.add(c);plateGroups.push(p);clothGroups.push(c);
    for(const y of [-.99,.99])box(p,[.24,.16,2.1],[0,PLATE_Y+y,0],materials.edge);
    for(const z of [-.97,.97])box(p,[.24,1.84,.16],[0,PLATE_Y,z],materials.teal,z>0);
    for(const half of [1,-1])mesh(p,plateFace(1.85,1.82,.08,half),materials.rubber,[0,PLATE_Y,0],undefined,half<0);
    for(const z of [-1.13,1.13]){
      box(p,[.23,.11,.36],[0,2.86,z],materials.steel);cylinder(p,.095,.10,[0,2.78,z],materials.dark,'z',14);
      box(p,[.12,.15,.13],[0,3.57,z*.85],materials.steel);
    }
    for(const face of [-1,1])for(const half of [1,-1])mesh(c,plateFace(1.77,1.74,.012,half),materials.cloth,[face*.052,PLATE_Y,0],undefined,half<0);
    const grooves=batch(p,geometry('groove',()=>new THREE.BoxGeometry(.013,1.47,.014)),materials.steel,24,`滤板 ${i+1} 排液沟槽`);
    for(let j=0;j<24;j++){const face=j<12?-1:1,k=j%12;dummy.position.set(face*.046,PLATE_Y,-.82+k*.069);dummy.scale.set(1,1,1);dummy.quaternion.identity();dummy.updateMatrix();grooves.setMatrixAt(j,dummy.matrix);}grooves.computeBoundingBox();grooves.computeBoundingSphere();
    const weave=batch(c,geometry('weave',()=>new THREE.BoxGeometry(.002,.008,.79)),materials.weave,24,`滤布 ${i+1} 纤维纹理`);
    for(let j=0;j<24;j++){const face=j<12?-1:1,k=j%12;dummy.position.set(face*.059,PLATE_Y-.74+k*.133,-.45);dummy.updateMatrix();weave.setMatrixAt(j,dummy.matrix);}weave.computeBoundingBox();weave.computeBoundingSphere();
  }

  const hydraulic=part('filter-hydraulic','液压缸与压紧板','液压缸使活动压紧板合拢并保持板组密封。给矿泵提供过滤压差，过滤期间不靠移动滤板挤水；停泵与卸压后液压机构才松开板组。',[2.85,2.6,0],[2.7,0,0]);
  const pressureHead=new THREE.Group();pressureHead.name='活动压紧板';hydraulic.add(pressureHead);
  box(pressureHead,[.3,2.29,2.3],[0,PLATE_Y,0],materials.teal);box(pressureHead,[.12,1.8,1.8],[.2,PLATE_Y,0],materials.dark);
  for(const z of [-1.1,1.1])box(pressureHead,[.48,.18,.22],[0,2.87,z],materials.steel);
  cylinder(hydraulic,.31,2.8,[3.5,PLATE_Y,0],materials.dark,'x');flange(hydraulic,[2.10,PLATE_Y,0],.42);
  for(const x of [2.17,4.82])ring(hydraulic,.32,.045,[x,PLATE_Y,0],materials.brass,'x');
  const piston=cylinder(hydraulic,.115,1,[0,PLATE_Y,0],materials.steel,'x');piston.name='液压活塞杆';
  for(const z of [-.6,.6])beam(hydraulic,[2.2,2.07,z],[4.8,2.07,z],.045,materials.steel);
  box(hydraulic,[1.1,.66,.8],[4.18,.86,-1.76],materials.teal);cylinder(hydraulic,.26,.58,[4.18,1.48,-1.76],materials.dark);
  for(let i=0;i<7;i++)cylinder(hydraulic,.28,.025,[4.18,1.24+i*.07,-1.76],materials.edge);
  pipe(hydraulic,[[4.25,1.2,-1.4],[4.4,1.8,-1],[4.65,2.58,-.26]],.035,materials.rubber);
  pipe(hydraulic,[[4.0,1.2,-1.4],[3.5,1.85,-.9],[2.3,2.58,-.26]],.035,materials.rubber);

  const piping=part('filter-piping','给矿总管与滤液收集','矿浆由止推端进入贯通的给矿孔，滤液从各板低位出口流入集液槽。青蓝色仅示意滤液去向；只有板组已闭合并保持压紧时，模型才显示进浆与过滤。',[-3.4,2.15,.2],[-1.2,0,1.3]);
  const feedPath=[[-4.25,.88,0],[-3.55,.88,0],[-3.4,1.55,0],[-3.4,PLATE_Y,0],[-2.78,PLATE_Y,0],[-.74,PLATE_Y,0]];
  pipe(piping,feedPath.slice(0,-1),.14,materials.teal,true);flange(piping,[-4.25,.88,0],.24);
  const valve=cylinder(piping,.21,.20,[-3.4,1.55,0],materials.dark);valve.name='给矿阀体';
  const valveHandle=box(piping,[.32,.045,.055],[-3.4,1.8,.15],materials.brass);valveHandle.name='给矿阀示意手柄';
  box(piping,[5.4,.07,.36],[-.22,1.06,1.25],materials.steel);
  for(const z of [1.05,1.45])box(piping,[5.4,.23,.045],[-.22,1.15,z],materials.edge);
  const filtratePath=[[-2.50,1.19,1.24],[-.9,1.18,1.24],[1.1,1.17,1.24],[2.48,1.16,1.24],[2.8,.86,1.24],[3.9,.86,1.24]];
  pipe(piping,filtratePath.slice(-3),.11,materials.edge,true);flange(piping,[3.9,.86,1.24],.18);
  for(let i=0;i<PLATE_COUNT;i++){
    const port=new THREE.Group();port.name=`滤板 ${i+1} 滤液出口`;piping.add(port);portGroups.push(port);
    pipe(port,[[0,1.61,.87],[0,1.44,1.03],[0,1.30,1.25]],.037,materials.brass);
  }

  const discharge=part('filter-discharge','拉板连接件与承饼托盘','拉板机构在停泵与卸压后分开滤板，滤饼靠重力脱离。连接杆和卸料托盘是通用结构示意；每轮结束把滤饼向出料端转移，不表示现场具体拉板机构或输送设备。',[.3,.7,.8],[0,-.05,4.7]);
  box(discharge,[5.8,.12,2.0],[-.1,.38,0],materials.dark);
  box(discharge,[5.65,.06,1.88],[-.1,.48,0],materials.steel);
  for(const z of [-1.02,1.02])box(discharge,[5.8,.22,.06],[-.1,.53,z],materials.edge);
  for(const x of [-2.75,2.58])box(discharge,[.08,.22,2.04],[x,.53,0],materials.edge);
  // A hinged chain of constant-length bars spreads the illustrative plate pack.
  const links=batch(discharge,geometry('link',()=>new THREE.CylinderGeometry(.024,.024,1,8)),materials.brass,(PLATE_COUNT-1)*4,'拉板铰接杆');
  fixedBounds(links,[-2.7,3.4,-1.03],[1.6,4.05,1.03]);
  const carriage=new THREE.Group();carriage.name='拉板小车';discharge.add(carriage);box(carriage,[.38,.29,.28],[0,2.99,1.31],materials.teal);
  for(const x of [-.12,.12])cylinder(carriage,.083,.11,[x,2.8,1.31],materials.dark,'z',14);
  const pullerGear=cylinder(carriage,.13,.08,[0,2.95,1.49],materials.brass,'z',12);pullerGear.name='拉板传动轮';
  for(const z of [-.96,.96])beam(discharge,[-2.45,3.57,z],[-2.45,3.7,z],.025,materials.steel);

  const operating=new THREE.Group();operating.name='压滤工作循环示意';operating.userData.operationLayer=true;group.add(operating);
  // Assign every illustrative object to a known part for bookkeeping, but do not raycast it.
  const slurryLayer=new THREE.Group(),filtrateLayer=new THREE.Group(),cakeLayer=new THREE.Group();operating.add(slurryLayer,filtrateLayer,cakeLayer);
  slurryLayer.userData.partId='filter-piping';filtrateLayer.userData.partId='filter-cloth';cakeLayer.userData.partId='filter-discharge';
  const flows=[];
  function flow(parent,name,points,material,count=14,size=.045){
    const curve=new THREE.CatmullRomCurve3(points.map(toVector),false,'centripetal');curve.arcLengthDivisions=200;curve.updateArcLengths();
    const traceMaterial=new THREE.MeshBasicMaterial({color:material.color,transparent:true,opacity:.22,depthWrite:false,toneMapped:false});
    visual(mesh(parent,new THREE.TubeGeometry(curve,64,.011,5,false),traceMaterial));
    const particles=batch(parent,geometry('particle:'+size,()=>new THREE.IcosahedronGeometry(size,0)),material,count,name,true);
    const arrows=batch(parent,geometry('arrow',()=>new THREE.ConeGeometry(.062,.20,6)),material,3,name+' 箭头',true);
    const bounds=new THREE.Box3().setFromPoints(curve.getPoints(200)).expandByScalar(.18);for(const b of [particles,arrows]){b.boundingBox=bounds.clone();b.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());}
    const d=new THREE.Object3D(),tangent=new THREE.Vector3();
    const update=time=>{for(let i=0;i<count;i++){curve.getPointAt((time*.12+i/count)%1,d.position);d.quaternion.identity();d.scale.setScalar(1);d.updateMatrix();particles.setMatrixAt(i,d.matrix);}for(let i=0;i<3;i++){const t=(time*.12+(i+.4)/3)%1;curve.getPointAt(t,d.position);curve.getTangentAt(t,tangent);d.quaternion.setFromUnitVectors(UP,tangent.normalize());d.updateMatrix();arrows.setMatrixAt(i,d.matrix);}particles.instanceMatrix.needsUpdate=arrows.instanceMatrix.needsUpdate=true;};
    flows.push({update,material,traceMaterial});update(0);return {particles,arrows};
  }
  flow(slurryLayer,'给矿粒子',feedPath,materials.feed,22,.043);
  flow(filtrateLayer,'滤液排出粒子',filtratePath,materials.water,22,.041);
  for(const i of [1,3,5]){
    const x=FIRST_X+i*CLOSED_PITCH+.12;
    flow(slurryLayer,`滤室 ${i} 进浆`,[[x,PLATE_Y,0],[x,2.82,.30],[x,3.08,.57]],materials.feed,6,.031);
    flow(filtrateLayer,`穿过滤布 ${i}`,[[x,2.87,.42],[x+.10,2.87,.42],[x+.12,2.4,.58],[x+.12,1.62,.87],[x+.12,1.3,1.25],[x+.12,1.18,1.25]],materials.water,10,.032);
  }
  const cakes=batch(cakeLayer,plateFace(1.61,1.51,1),materials.cake,PLATE_COUNT-1,'滤饼形成与下落',true);
  fixedBounds(cakes,[-2.8,.45,-.95],[3.2,3.3,.95]);
  const cakePositions=new Float64Array((PLATE_COUNT-1)*3),cakeDummy=new THREE.Object3D();
  let mode='solid',elapsed=0,selectedStep=-1;
  const phaseState={phaseId:'clamping',phaseProgress:0,progress:0,plateSpread:0,pressure:0,feedActive:false,filtrateActive:false,cakeDrop:0,clamped:false};
  const barDummy=new THREE.Object3D(),barStart=new THREE.Vector3(),barEnd=new THREE.Vector3(),barDirection=new THREE.Vector3();
  const stages=PHASES.map(({id,label})=>({id,label}));
  function phaseAt(time){let start=0;for(const phase of PHASES){if(time<start+phase.duration)return {phase,p:(time-start)/phase.duration};start+=phase.duration;}return {phase:PHASES[0],p:0};}
  function pose(spread,carriageX){
    const pitch=CLOSED_PITCH+(OPEN_PITCH-CLOSED_PITCH)*spread;
    for(let i=0;i<PLATE_COUNT;i++){const x=FIRST_X+i*pitch;plateGroups[i].position.x=clothGroups[i].position.x=portGroups[i].position.x=x;}
    const headX=FIRST_X+(PLATE_COUNT-1)*pitch+.27;pressureHead.position.x=headX;
    const rodStart=headX+.2,rodEnd=2.1;piston.position.x=(rodStart+rodEnd)/2;piston.scale.y=Math.max(.08,rodEnd-rodStart);
    carriage.position.x=carriageX;pullerGear.rotation.z=carriageX*3;
    let n=0;for(let i=0;i<PLATE_COUNT-1;i++)for(const z of [-.96,.96]){
      const x0=FIRST_X+i*pitch,x1=x0+pitch,mid=(x0+x1)/2,peak=3.7+Math.sqrt(Math.max(.001,.30*.30-(pitch*.5)**2));
      for(const[a,b]of [[[x0,3.7,z],[mid,peak,z]],[[mid,peak,z],[x1,3.7,z]]]){
        barStart.set(...a);barEnd.set(...b);barDirection.copy(barEnd).sub(barStart);barDummy.position.copy(barStart).add(barEnd).multiplyScalar(.5);barDummy.quaternion.setFromUnitVectors(UP,barDirection.normalize());barDummy.scale.set(1,.30,1);barDummy.updateMatrix();links.setMatrixAt(n++,barDummy.matrix);
      }
    }links.instanceMatrix.needsUpdate=true;
  }
  function setCake(index,x,y,z,thickness,tilt=0){cakeDummy.position.set(x,y,z);cakeDummy.rotation.set(0,0,tilt);cakeDummy.scale.set(thickness,1,1);cakeDummy.updateMatrix();cakes.setMatrixAt(index,cakeDummy.matrix);cakePositions.set([x,y,z],index*3);}
  function renderCycle(){
    const{phase,p}=phaseAt(elapsed);let spread=0,pressure=0,fill=0,drop=0,carriageX=-.45;
    if(phase.id==='clamping'){spread=1-smooth(p/.82);pressure=smooth((p-.82)/.18);carriageX=1.6-spread*.1;}
    else if(phase.id==='filtering'){pressure=1;fill=.04+.96*smooth(p);}
    else if(phase.id==='depressurizing'){pressure=1-smooth(p);fill=1;}
    else if(phase.id==='opening'){spread=smooth(p);fill=1;carriageX=-.45+2.05*spread;}
    else if(phase.id==='discharging'){spread=1;fill=1;drop=smooth(p/.7);carriageX=1.6;}
    else{spread=1;fill=1;drop=1;carriageX=1.6-2.05*smooth(p);}
    const feedActive=phase.id==='filtering';Object.assign(phaseState,{phaseId:phase.id,phaseProgress:p,progress:elapsed/DURATION,plateSpread:spread,pressure,feedActive,filtrateActive:feedActive,cakeDrop:drop,clamped:spread===0&&pressure===1});
    pose(spread,carriageX);slurryLayer.visible=filtrateLayer.visible=feedActive;cakeLayer.visible=fill>0;
    valveHandle.rotation.y=feedActive?0:Math.PI/2;
    const pitch=CLOSED_PITCH+(OPEN_PITCH-CLOSED_PITCH)*spread;
    for(let i=0;i<PLATE_COUNT-1;i++){
      let x=FIRST_X+(i+.5)*pitch,y=PLATE_Y,z=0,tilt=0;
      if(phase.id==='discharging'||phase.id==='resetting'){
        const local=phase.id==='resetting'?1:smooth(Math.max(0,Math.min(1,(p-i*.038)/.58)));
        y=PLATE_Y-local*1.15;tilt=(i%2?1:-1)*local*.055;
        if(phase.id==='resetting')x+=smooth(p)*.42;
      }
      const fade=phase.id==='resetting'?1-smooth((p-.5)*2):1;
      setCake(i,x,y,z,Math.max(.0001,.11*fill*fade),tilt);
    }cakes.instanceMatrix.needsUpdate=true;
    if(feedActive)for(const f of flows)f.update(elapsed);
    group.userData.filterCycle=phaseState;
  }
  function assembled(){pose(0,-.45);valveHandle.rotation.y=Math.PI/2;operating.visible=false;Object.assign(phaseState,{phaseId:'clamping',phaseProgress:0,progress:0,plateSpread:0,pressure:0,feedActive:false,filtrateActive:false,cakeDrop:0,clamped:false});group.userData.filterCycle=phaseState;}
  function setViewMode(view){mode=view==='cutaway'?'cutaway':view==='exploded'?'exploded':'solid';elapsed=0;group.traverse(o=>{if(o.userData.cutaway)o.visible=mode!=='cutaway';if(o.userData.sectionOnly)o.visible=mode==='cutaway';});if(mode==='cutaway'){operating.visible=true;renderCycle();}else assembled();}
  function restartOperation(){elapsed=0;if(mode==='cutaway')renderCycle();else assembled();}
  function seekOperationPhase(id){
    if(mode!=='cutaway')return false;
    let start=0;
    for(const phase of PHASES){if(phase.id===id){elapsed=start+phase.duration*.5;renderCycle();return true;}start+=phase.duration;}
    return false;
  }
  function setOperationStep(index=-1){selectedStep=Number.isInteger(index)&&index>=0&&index<4?index:-1;const focused=selectedStep<0||selectedStep===1;materials.feed.opacity=materials.water.opacity=focused?.95:.23;for(const f of flows)f.traceMaterial.opacity=focused?.22:.06;materials.cake.transparent=selectedStep>=0&&selectedStep!==1&&selectedStep!==3;materials.cake.opacity=materials.cake.transparent?.35:1;}
  function update(delta,time){if(mode!=='cutaway')return;if(Number.isFinite(delta)&&delta>0)elapsed=(elapsed+delta)%DURATION;renderCycle();}
  const operationGuide={
    title:'压紧、过滤、卸饼，再开始一轮',summary:'闭合滤室内进浆过滤，青蓝滤液穿过滤布排出；停止进浆并卸压后开板，棕金滤饼落入承饼托盘。',
    steps:[
      {label:'压紧密封',description:'活动压紧板合拢板组，滤室形成密封；尚未开始进浆。',partId:'filter-hydraulic',color:'#c6a66b'},
      {label:'进浆与固液分离',description:'板组保持不动。固体被滤布截留成饼，青蓝滤液经沟槽与集液槽排出。',partId:'filter-cloth',color:'#69d6e2'},
      {label:'停泵卸压，再拉板',description:'进浆停止，卸压阶段结束后才打开滤板；开板时不会同时显示有压进料。',partId:'filter-plates',color:'#76b6a7'},
      {label:'卸饼与复位',description:'板间滤饼下落至托盘，拉板小车返回，随后进入下一轮压紧。',partId:'filter-discharge',color:'#b18c59'},
    ],sources:[{title:'McLanahan · 板式压滤机工作循环',url:'https://www.mclanahan.com/products/filter-presses'},{title:'McLanahan · 滤板开启与重力卸饼',url:'https://www.mclanahan.com/products/overhead-beam-filter-presses'}],
  };
  const explosionSteps=[
    {title:'管路与卸料',description:'观察给矿、滤液收集与承饼机构的位置。',parts:['filter-piping','filter-discharge']},
    {title:'滤板与滤布',description:'分开滤板组和滤布，辨认密封边、中心给矿孔与排液面。',parts:['filter-plates','filter-cloth']},
    {title:'压紧与支承',description:'观察液压压紧机构与承载机架的配合。',parts:['filter-hydraulic','filter-frame']},
  ];
  // Initialize every dynamic batch, including batches hidden before the first cycle.
  for(let i=0;i<PLATE_COUNT-1;i++)setCake(i,FIRST_X+(i+.5)*CLOSED_PITCH,PLATE_Y,0,.0001);
  setViewMode('solid');
  return {group,parts,update,setViewMode,setOperationStep,restartOperation,seekOperationPhase,operationGuide,explosionSteps,get operationStatus(){const phase=PHASES.find(p=>p.id===phaseState.phaseId);return {...phaseState,label:phase.label,description:phase.description,stages,phaseProgress:phaseState.phaseProgress};}};
}
