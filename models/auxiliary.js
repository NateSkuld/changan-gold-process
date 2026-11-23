import * as THREE from 'three';

// Schematic supporting equipment. These shapes explain functions; they are not surveyed CAD.
const DEFINITIONS = {
  screen: ['振动筛','VIBRATING SCREEN','筛分','筛面按粒度把矿石分成筛上物与筛下物。','筛箱在激振作用下运动，使物料沿筛面前行；小于筛孔的颗粒透筛，粗粒继续向排料端移动。',['筛箱与支架','筛网与筛面','激振与支承']],
  spiral: ['双螺旋分级机','SPIRAL CLASSIFIER','分级','细粒随溢流排出，沉降粗粒由螺旋送回磨机。','矿浆在槽体中沉降分级，螺旋缓慢转动，把较粗沉砂沿倾斜槽体推送至返砂端。',['槽体与支承','双螺旋与主轴','电机与溢流口']],
  stirred: ['立式搅拌磨','STIRRED MILL','再磨','对中矿继续磨细，再进入后续选别。','传动机构带动搅拌轴，使磨内介质与矿粒相互作用。当前几何是立式搅拌磨的通用结构示意。',['磨筒与机架','搅拌轴与研磨区','顶部传动与接口']],
  hopper: ['原矿仓','ORE BIN','储矿','暂存物料，为下游设备提供给料缓冲。','物料从上部进入仓体，经下部料斗进入给料环节。仓体形状与给料器布置需按现场资料校准。',['仓体与支柱','内部料斗','下部出料口']],
  conditioning: ['搅拌桶','CONDITIONING TANK','调浆','在浮选前进行矿浆混合与调浆。','电机驱动搅拌轴和叶轮，使矿浆在桶内混合。工艺位置来自流程图，叶轮形状为原理示意。',['桶体与底座','搅拌轴与叶轮','桥架与传动']],
  lamella: ['斜板浓密机组','LAMELLA SETTLER','浓缩','通过斜板沉降分离精矿中的一部分水。','矿浆进入沉降区，颗粒在斜板间沉降并汇集至下部；溢流沿上部集水区排出。本节点代表三台串联设备。',['槽体与支架','倾斜沉降板','底流与溢流通道']],
  water: ['高位水池','RETURN WATER RESERVOIR','回水','收集回流水，供生产系统再利用。','回水节点用于展示水路连接。当前水池为示意容器，形状与容量没有从展板推定。',['池体与基础','蓄水区','进出水接口']],
  storage: ['产物储存','MATERIAL STORAGE','储存','表示物料离开选矿主线后的去向。','该节点表达精矿库或尾矿库的终点关系，当前通用容器仅为流程符号，不代表库区真实工程结构。',['示意边界','产物区','出入通道']],
};
export const AUXILIARY_EQUIPMENT = Object.entries(DEFINITIONS).map(([id,d])=>({
  id,number:'·',name:d[0],enName:d[1],stage:d[2],description:d[3],principle:d[4],
  input:'以所选流程节点的上游连接为准',output:'以所选流程节点的下游连接为准',focus:d[5],steps:['查看上游给料','观察内部结构','沿下游连接继续探索'],
  model:'展板节点 · 通用结构示意',evidence:'仅有流程位置与设备类别依据；当前结构未按现场总装图校准。',
  sources:[{title:'用户提供 · 选矿工艺流程图',url:'./references/reference-01.jpg'},{title:'用户提供 · 选厂工艺流程简介',url:'./references/reference-02.jpg'}]
}));

export function createAuxiliary(type){
  const d=DEFINITIONS[type];if(!d)throw new Error(`Unsupported schematic equipment ${type}`);
  const group=new THREE.Group(),parts=[];
  const materials={teal:new THREE.MeshStandardMaterial({color:0x2b6e66,metalness:.6,roughness:.35}),steel:new THREE.MeshStandardMaterial({color:0x9aa6a1,metalness:.7,roughness:.35}),gold:new THREE.MeshStandardMaterial({color:0xb29b63,metalness:.75,roughness:.35}),dark:new THREE.MeshStandardMaterial({color:0x233b3b,metalness:.5,roughness:.5}),water:new THREE.MeshStandardMaterial({color:0x397b75,transparent:true,opacity:.3,roughness:.3,side:THREE.DoubleSide}),ore:new THREE.MeshStandardMaterial({color:0x857b5d,roughness:.9})};
  const vec=a=>new THREE.Vector3(...a);
  const part=(id,name,text,anchor,explode)=>{const root=new THREE.Group();root.userData.partId=id;group.add(root);parts.push({id,name,description:text,root,anchor:vec(anchor),explode:vec(explode)});return root;};
  const body=part('body',d[5][0],`${d[3]} 外形是教学示意，未采用实测尺寸。`,[0,2.6,-.4],[0,.4,-1.7]);
  const inner=part('inside',d[5][1],d[4],[0,1.8,.4],[0,.8,.5]);
  const drive=part('service',d[5][2],'与物料流向或传动功能对应；型号和连接关系见本节点工艺说明。',[2,2,0],[1.8,1.2,0]);
  const mesh=(root,geometry,mat,x=0,y=0,z=0,cut=false)=>{const m=new THREE.Mesh(geometry,materials[mat]);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;if(cut)m.userData.cutaway=true;root.add(m);return m;};
  const box=(r,w,h,depth,mat,x,y,z,cut=false)=>mesh(r,new THREE.BoxGeometry(w,h,depth),mat,x,y,z,cut);
  const cyl=(r,rt,rb,h,mat,x,y,z,cut=false,open=false)=>mesh(r,new THREE.CylinderGeometry(rt,rb,h,32,1,open),mat,x,y,z,cut);
  const tube=(r,rad,len,mat,x,y,z,axis='y')=>{const c=cyl(r,rad,rad,len,mat,x,y,z);if(axis==='x')c.rotation.z=Math.PI/2;if(axis==='z')c.rotation.x=Math.PI/2;return c;};
  const feet=(r,x=1.8,z=1.1,height=1.1)=>{for(const a of[-1,1])for(const b of[-1,1]){box(r,.2,height,.2,'dark',x*a,.05+height/2,z*b);box(r,.55,.15,.5,'steel',x*a,.1,z*b);}};
  let rotor=null,rotor2=null,surface=null;
  if(type==='screen'){
    feet(body);const frame=new THREE.Group();body.add(frame);frame.position.y=1.1;frame.rotation.z=.09;
    box(frame,4.7,.18,2.5,'dark',0,0,0);box(frame,4.7,.7,.13,'teal',0,.3,-1.25);box(frame,4.7,.7,.13,'teal',0,.3,1.25,true);
    for(let i=0;i<15;i++)box(inner,.05,.09,2.3,'steel',-2.1+i*.3,1.35+i*.025,0);
    for(let i=0;i<9;i++)box(inner,4.6,.035,.03,'gold',0,1.55,-1.1+i*.275);
    for(const x of[-1.8,1.8])for(const z of[-1.4,1.4]){tube(drive,.14,.4,'gold',x,.9,z);}
    rotor=tube(drive,.4,.8,'teal',0,1.65,1.7,'z');tube(drive,.13,.9,'steel',0,1.65,1.7,'z');
  }else if(type==='spiral'){
    // Working diameter and length follow the 2FG-2000 card. The illustrated 16°
    // lies inside its 14–18.5° range; pitch and support details are schematic.
    const scale=.0006,inclineAngle=THREE.MathUtils.degToRad(16),axisY=1.88;
    const flightR=2000*scale/2,flightLen=8200*scale,troughLen=5.64,troughWidth=2.544;
    const inclinedPart=(owner)=>{const g=new THREE.Group();g.position.y=axisY;g.rotation.z=inclineAngle;owner.add(g);return g;};
    const trough=inclinedPart(body),driveFrame=inclinedPart(drive);
    box(trough,troughLen,.14,troughWidth,'teal',0,-.70,0);
    for(const side of [-1,1]){
      const z=side*troughWidth/2,front=side>0;
      box(trough,troughLen,1.29,.09,'teal',0,-.015,z,front);
      box(trough,troughLen,.065,.14,'dark',0,.64,z,front);
      for(let rib=0;rib<6;rib++)box(trough,.055,1.24,.05,'teal',(rib-2.5)*1.03,-.02,z+side*.06,front);
    }
    box(trough,.10,1.1,troughWidth,'teal',-troughLen/2,-.1,0);
    for(const x of [-2.15,1.9])for(const z of [-1,1]){
      const h=axisY+x*Math.tan(inclineAngle)-.77/Math.cos(inclineAngle);
      box(body,.16,h,.16,'dark',x,h/2,z);box(body,.43,.10,.38,'steel',x,.05,z);
    }
    const flightGeometry=hand=>{
      const vs=[],ix=[],segments=224,turns=6;
      for(let i=0;i<=segments;i++){
        const t=i/segments,a=t*turns*Math.PI*2*hand,x=(t-.5)*flightLen;
        for(const [offset,r] of [[-.026,.115],[-.026,flightR],[.026,flightR],[.026,.115]]){
          vs.push(x+offset,Math.sin(a)*r,Math.cos(a)*r);
        }
        if(!i)continue;
        for(let j=0;j<4;j++){
          const p=(i-1)*4+j,q=(i-1)*4+(j+1)%4;
          if(hand>0)ix.push(p,q,p+4,q,q+4,p+4);else ix.push(p,p+4,q,q,p+4,q+4);
        }
      }
      const end=segments*4;
      if(hand>0)ix.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3);
      else ix.push(0,1,2,0,2,3,end,end+2,end+1,end,end+3,end+2);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();return g;
    };
    const rotorSet=[];
    const screwFrame=inclinedPart(inner);
    for(const hand of[1,-1]){
      const z=-hand*.625,rotating=new THREE.Group();rotating.position.z=z;screwFrame.add(rotating);
      rotating.name=hand>0?'左侧螺旋':'右侧螺旋';
      tube(rotating,.12,5.55,'steel',0,0,0,'x');mesh(rotating,flightGeometry(hand),'steel');
      rotorSet.push(rotating);
      box(driveFrame,.42,.46,.5,'dark',2.83,0,z);
      tube(driveFrame,.23,.59,'teal',3.29,0,z,'x');
      for(let i=0;i<4;i++)tube(driveFrame,.245,.033,'dark',3.12+i*.09,0,z,'x');
      box(driveFrame,1.03,.12,.58,'dark',3.09,-.29,z);
    }
    [rotor,rotor2]=rotorSet;
    surface=box(inner,3.26,.025,2.42,'water',-.84,1.45,0);
    parts[0].description='长槽倾斜布置。设备卡标注槽体倾角为 14°～18.5°，模型取 16° 示意；低端收集溢流，高端排出返砂。';
    parts[1].description='两根螺旋的直径为 2000 mm、长度为 8200 mm，卡示转速为 5.6 r/min。两侧叶片旋向相反，推动沉砂向同一高端移动。叶片螺距为示意。';
    parts[2].anchor.set(3.02,2.7,.6);
  }else if(type==='hopper'){
    feet(body,1.65,1.65,2.4);
    // An open four-sided rim accepts feed; long legs meet the upper bin walls.
    for(const z of[-1.8,1.8])box(body,3.8,.2,.2,'teal',0,3.25,z);
    for(const x of[-1.8,1.8])box(body,.2,.2,3.6,'teal',x,3.25,0);
    for(const z of[-1.8,1.8])box(body,3.8,1.4,.12,'teal',0,2.6,z,z>0);
    for(const x of[-1.8,1.8])box(body,.12,1.4,3.6,'teal',x,2.6,0);
    const funnel=cyl(inner,2.5,.55,1.65,'steel',0,1.7,0,false,true);funnel.geometry.dispose();funnel.geometry=new THREE.CylinderGeometry(2.5,.55,1.65,4,1,true);funnel.rotation.y=Math.PI/4;
    box(drive,1,.65,1,'dark',0,.55,0);box(drive,1.8,.15,1.4,'gold',0,.28,0);
  }else if(type==='lamella'){
    feet(body);box(body,4.5,.2,2.6,'teal',0,.9,0);box(body,4.5,2.1,.15,'teal',0,1.95,-1.3);box(body,4.5,2.1,.15,'teal',0,1.95,1.3,true);box(body,.15,2.1,2.6,'teal',-2.25,1.95,0);
    for(let i=0;i<10;i++){const p=box(inner,.05,2,2.25,'steel',-1.7+i*.37,1.95,0);p.rotation.z=-.43;}
    for(const x of[-1,1])cyl(drive,.7,.16,.75,'gold',x,.65,0);box(drive,4.4,.16,.35,'steel',0,3.1,-1.2);tube(drive,.16,1,'teal',2.45,2.9,0,'x');
  }else if(type==='storage'){
    box(body,5,.16,4,'dark',0,.1,0);for(const z of[-2,2])box(body,5,1.7,.14,'teal',0,1,z,z>0);box(body,.15,1.7,4,'teal',-2.5,1,0);
    for(const x of[-1.5,0,1.5])cyl(inner,.05,.95,1.3,'ore',x,.8,0);
    box(drive,1.2,.15,2.4,'steel',2.75,.2,0);box(drive,.14,1.8,1.2,'gold',2.5,1,1.4);
  }else{
    const r=type==='water'?2.3:1.65;feet(body,r*.78,r*.78);cyl(body,r,r,.18,'teal',0,.7,0);
    const back=mesh(body,new THREE.CylinderGeometry(r,r,2.35,48,1,true,Math.PI/2,Math.PI),'teal',0,1.95,0);back.material=materials.teal.clone();back.material.side=THREE.DoubleSide;
    const front=mesh(body,new THREE.CylinderGeometry(r,r,2.35,48,1,true,-Math.PI/2,Math.PI),'teal',0,1.95,0,true);front.material=back.material;
    for(const y of[.85,3.13]){const ring=mesh(body,new THREE.TorusGeometry(r,.075,6,48),'gold',0,y,0);ring.rotation.x=Math.PI/2;}
    if(type==='water'){surface=cyl(inner,r*.96,r*.96,.07,'water',0,2.3,0);tube(drive,.17,1.5,'steel',2.2,2.6,.6,'x');tube(drive,.17,1.5,'teal',-2.2,1.2,0,'x');}
    else{
      rotor=new THREE.Group();inner.add(rotor);rotor.position.y=.8;tube(rotor,.1,2.9,'steel',0,1.3,0);
      for(const y of(type==='stirred'?[.5,1.1,1.7]:[.6]))for(let j=0;j<4;j++){const blade=box(rotor,1.45,.14,.3,'gold',0,y,0);blade.rotation.y=j*Math.PI/2;}
      if(type==='stirred'){const balls=new THREE.InstancedMesh(new THREE.SphereGeometry(.12,8,6),materials.steel,65);const matrix=new THREE.Matrix4();for(let i=0;i<65;i++){const a=i*2.4,rad=.2+((i*7)%11)/11;matrix.makeTranslation(Math.cos(a)*rad,.95+(i%4)*.2,Math.sin(a)*rad);balls.setMatrixAt(i,matrix);}inner.add(balls);}
      box(drive,3.65,.2,.6,'steel',0,3.3,0);tube(drive,.45,.7,'teal',0,3.8,0);tube(drive,.2,1.2,'teal',-1.9,2.8,-.4,'x');
    }
  }
  return{group,parts,update(delta,time){if(rotor){if(type==='spiral'){const angle=time*(5.6/60)*Math.PI*2;rotor.rotation.x=angle;rotor2.rotation.x=-angle;}else if(type==='screen')rotor.rotation.y=time*2;else rotor.rotation.y=time*.6;}}};
}

// Shared resources keep repeated process symbols cheap. Symbols describe an
// operation and its visible function, never surveyed dimensions or live state.
let plantSymbolResources;
export function createPlantSymbol(type, node = null){
  if(!plantSymbolResources){
    const material=(color,metalness,roughness,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
    plantSymbolResources={
      geometries:new Map(),
      mat:{
        teal:material(0x367b70,.55,.45), dark:material(0x234039,.2,.65),
        steel:material(0xa1b3a1,.7,.4), gold:material(0xb5a16a,.65,.4),
        slurry:material(0x506e61,.08,.87), foam:material(0xc7c5a1,.05,.82),
        water:material(0x5cabbc,.12,.35), sediment:material(0x8f7954,.15,.85), media:material(0x8c9b93,.75,.38), standby:material(0x67796f,.3,.7),
        shell:material(0x367b70,.55,.45,{side:THREE.DoubleSide}),
        millWhite:material(0xe3e1d7,.17,.58), millYellow:material(0xe4ad26,.22,.51),
        millRed:material(0xa53634,.25,.50), millGrey:material(0x737b7b,.32,.53),
        millIron:material(0x383b39,.49,.49),
      },
    };
  }
  const {mat,geometries}=plantSymbolResources;
  const g=new THREE.Group();g.name=`${type} · 流程作业示意`;
  g.userData.schematic=true;g.userData.notSurveyed=true;
  const cached=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
  const add=(geo,m,x=0,y=0,z=0,parent=g)=>{const o=new THREE.Mesh(geo,mat[m]);o.position.set(x,y,z);parent.add(o);return o;};
  const box=(w,h,d,m,x,y,z,parent=g)=>add(cached(`box:${w}:${h}:${d}`,()=>new THREE.BoxGeometry(w,h,d)),m,x,y,z,parent);
  const cyl=(r,r2,h,m,x,y,z,parent=g)=>add(cached(`cyl:${r}:${r2}:${h}`,()=>new THREE.CylinderGeometry(r,r2,h,20,1)),m,x,y,z,parent);
  const ring=(r,m,x,y,z,axis='y',parent=g)=>{const o=add(cached(`ring:${r}`,()=>new THREE.TorusGeometry(r,.05,4,24)),m,x,y,z,parent);if(axis==='y')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.y=Math.PI/2;return o;};
  const pipe=(r,length,m,x,y,z,axis='y',parent=g)=>{const o=cyl(r,r,length,m,x,y,z,parent);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;};
  const name=(o,value)=>{o.name=value;return o;};
  const particles=(count,r,material,position,owner=g)=>{
    const geometry=cached(`particle:${r}`,()=>new THREE.SphereGeometry(r,7,5));
    const mesh=new THREE.InstancedMesh(geometry,mat[material],count),matrix=new THREE.Matrix4();
    for(let i=0;i<count;i++){const p=position(i);matrix.compose(new THREE.Vector3(...p.slice(0,3)),new THREE.Quaternion(),new THREE.Vector3(...(p.slice(3).length===3?p.slice(3):[1,1,1])));mesh.setMatrixAt(i,matrix);}
    mesh.computeBoundingBox();mesh.computeBoundingSphere();owner.add(mesh);return mesh;
  };
  const millHalf = type === 'mill' ? 1.07 * (node?.id === 'mill-polishing' ? 4000 / 3600 : 1) : 0;
  box(millHalf ? 2*(millHalf+.35) : 2.7,.16,2,'dark',0,.08,0);
  if(type==='mill'){
    // Use just the silhouettes that read at plant scale. The longer 2# drum
    // has the same diameter as its neighbours; end supports stay unscaled.
    const half=millHalf, y=1.15, gearX=-half+.06;
    name(pipe(.75,2*half,'millWhite',0,y,0,'x'),'白漆筒体');
    for(const s of [-1,1]){
      const x=s*(half+.20);
      pipe(.23,.40,'millWhite',s*(half+.08),y,0,'x');
      box(.22,.90,.52,'millGrey',x,.61,0);
      name(pipe(.325,.23,'millWhite',x,y,0,'x'),'主轴承座');
    }
    pipe(.83,.15,'millIron',gearX,y,0,'x');
    name(pipe(.745,.10,'millRed',gearX-.08,y,0,'x'),'红漆齿圈连接环');
    // One continuous arch with a flat rim at either side of the gear.
    const arch=cached('mill-upper-guard',()=>new THREE.LatheGeometry(
      [[.853,-.14],[.923,-.14],[.923,.14],[.853,.14],[.853,-.14]].map(([r,x])=>new THREE.Vector2(r,x)),24,0,Math.PI));
    name(add(arch,'millYellow',gearX,y,0),'黄色齿轮护罩').rotation.z=Math.PI/2;
    for(const z of [-.886,.886])box(.28,.69,.08,'millYellow',gearX,y-.344,z);
    const shaftY=.61, shaftZ=.80;
    pipe(.072,1.02,'millIron',gearX+.03,shaftY,shaftZ,'x');
    for(const dx of [-.24,.24])name(box(.15,.40,.29,'millIron',gearX+dx,.46,shaftZ),'小齿轮轴承座');
    name(pipe(.124,.16,'millRed',gearX+.44,shaftY,shaftZ,'x'),'红漆联轴器');
    name(pipe(.215,.45,'millGrey',gearX+.72,shaftY,shaftZ,'x'),'传动电机');
  }else if(type==='crusher'){
    box(1.8,1.9,1.5,'teal',0,1.1,0);const jaw=box(.9,.25,1.6,'dark',0,2.1,0);jaw.rotation.z=.2;
    for(const x of[-1.1,1.1]){const w=cyl(.65,.65,.18,'gold',x,1.2,0);w.rotation.z=Math.PI/2;}
  }else if(type==='cone'){
    cyl(.95,.85,1.35,'teal',0,.95,0);cyl(1.1,.8,.6,'steel',0,1.95,0);cyl(.04,.62,1.15,'gold',0,1.5,0);ring(.95,'gold',0,1.5,0);box(.7,.4,.5,'dark',1.1,.45,0);
  }else if(type==='flotation'){
    // One open rectangular cell stands for the entire flotation operation;
    // the supplied board does not assign a machine count to each operation.
    g.userData.representsOperation=true;g.userData.machineCount=null;
    for(const x of[-.92,.92])for(const z of[-.55,.55])box(.12,.36,.12,'steel',x,.32,z);
    box(2.4,.12,1.45,'teal',0,.51,0);
    for(const z of[-.72,.72])box(2.4,.8,.1,'teal',0,.96,z);
    for(const x of[-1.15,1.15])box(.1,.8,1.35,'teal',x,.96,0);
    name(box(2.17,.055,1.25,'slurry',0,1.29,0),'矿浆液面');
    name(box(2.15,.055,1.23,'foam',0,1.35,0),'矿化泡沫层');
    name(particles(30,.063,'foam',i=>[-.91+(i%6)*.36,1.39+((i*7)%3)*.012,-.48+Math.floor(i/6)*.235,1,.62,1]),'泡沫颗粒示意');
    // The front launder is distinct from the low pulp outlet at the end wall.
    name(box(2.5,.09,.33,'gold',0,1.21,.96),'精矿溜槽底板');
    box(2.5,.23,.055,'steel',0,1.3,1.12);
    for(const x of[-1.25,1.25])box(.055,.23,.33,'steel',x,1.3,.96);
    name(pipe(.085,.32,'gold',1.4,1.2,.96,'x'),'泡沫精矿出口');
    name(pipe(.13,.35,'steel',-1.36,.69,-.24,'x'),'独立矿浆出口');
    pipe(.11,.31,'steel',1.35,1.05,-.29,'x');
    box(2.52,.12,.24,'steel',0,1.7,0);
    pipe(.052,.64,'gold',0,1.48,0);
    box(.36,.25,.34,'dark',0,1.89,0);cyl(.2,.2,.34,'teal',0,2.13,0);
    g.userData.ports={feed:[1.5,1.05,-.29],concentrate:[1.56,1.2,.96],pulp:[-1.535,.69,-.24]};
  }else if(type==='stirred'){
    // A cut-open high chamber explains stirring and the media zone. It does
    // not reproduce JM1500 manufacturing geometry or an actual open casing.
    for(const x of[-.63,.63])for(const z of[-.52,.52])box(.12,.47,.12,'steel',x,.37,z);
    cyl(.79,.79,.16,'teal',0,.56,0);
    const start=Math.PI/3,length=Math.PI*4/3;
    const wall=cached('stirred-open-wall',()=>new THREE.CylinderGeometry(.72,.72,2.03,28,1,true,start,length));
    name(add(wall,'shell',0,1.67,0),'磨筒原理剖面');
    for(const a of[start,start+length]){const edge=box(.065,2.03,.065,'steel',Math.sin(a)*.72,1.67,Math.cos(a)*.72);edge.rotation.y=a;}
    for(const y of[.68,2.67])ring(.72,'gold',0,y,0);
    name(pipe(.065,2.4,'steel',0,1.68,0),'中心搅拌轴');
    for(const y of[.85,1.3,1.75,2.2])for(const a of[0,Math.PI/2]){const blade=box(1.08,.065,.14,'gold',0,y,0);blade.rotation.y=a+(y>.9?.35:0);}
    name(particles(54,.064,'media',i=>{const a=i*2.399963,rad=.2+((i*13)%17)/17*.37;return[Math.cos(a)*rad,.77+Math.floor(i/18)*.17,Math.sin(a)*rad];}),'研磨介质区示意');
    box(1.65,.12,.34,'steel',0,2.78,0);box(.43,.25,.4,'dark',0,2.97,0);cyl(.24,.24,.34,'teal',0,3.265,0);
    pipe(.11,.48,'steel',-.86,2.24,0,'x');pipe(.1,.48,'gold',.86,.81,0,'x');
    g.userData.internalEvidence='通用搅拌与介质区示意';
  }else if(type==='spiral'){
    // Both flights are solid helical ribbons, not a stack of disconnected rings.
    const inclined=new THREE.Group();inclined.position.y=1;inclined.rotation.z=.16;g.add(inclined);
    for(const x of[-1.05,1.05])for(const z of[-.68,.68])box(.11,x<0?.42:.75,.11,'steel',x,x<0?.37:.535,z);
    box(2.7,.12,1.66,'teal',0,-.37,0,inclined);
    for(const z of[-.83,.83])box(2.7,.57,.08,'teal',0,-.075,z,inclined);
    box(.08,.55,1.6,'teal',-1.35,-.07,0,inclined);
    const flight=cached('classifier-helical-flight',()=>{
      const positions=[],indices=[],steps=120,turns=6;
      for(let i=0;i<=steps;i++){
        const t=i/steps,a=t*Math.PI*2*turns,x=(t-.5)*2.38;
        for(const [r,dx]of[[.075,-.018],[.285,-.018],[.285,.018],[.075,.018]])positions.push(x+dx,Math.sin(a)*r,Math.cos(a)*r);
      }
      for(let i=0;i<steps;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+(j+1)%4,d=(i+1)*4+j;indices.push(a,b,d,b,c,d);}
      indices.push(0,2,1,0,3,2);const end=steps*4;indices.push(end,end+1,end+2,end,end+2,end+3);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    });
    for(const z of[-.4,.4]){
      name(pipe(.074,2.58,'steel',0,.015,z,'x',inclined),'螺旋主轴');
      name(add(flight,'gold',0,.015,z,inclined),'连续螺旋叶片');
      box(.28,.14,.35,'steel',1.27,.1,z,inclined);pipe(.14,.34,'teal',1.37,.3,z,'x',inclined);
    }
    name(box(.26,.065,1.25,'steel',-1.42,-.1,0,inclined),'低端细粒溢流口');
    name(box(.28,.065,1.25,'gold',1.42,-.27,0,inclined),'高端返砂口');
    box(1.03,.035,1.45,'slurry',-.65,-.19,0,inclined);
    g.userData.ports={overflow:[-1.5,.67,0],return:[1.5,.98,0]};
  }else if(type==='cyclone'){
    const known=node?.id==='cyclone-regrind'?{total:6,duty:1,standby:5}:
      ['cyclone-primary','cyclone-secondary'].includes(node?.id)?{total:8,duty:4,standby:4}:null;
    const match=String(node?.model||'').match(/(\d+)\s*台\s*\/\s*(\d+)\s*用\s*(\d+)\s*备/);
    const parsed=match?{total:Number(match[1]),duty:Number(match[2]),standby:Number(match[3])}:null;
    const config=known||(parsed&&parsed.total>=1&&parsed.total<=8&&parsed.duty>=1&&parsed.duty+parsed.standby===parsed.total?parsed:null);
    if(!config){
      cyl(.55,.08,1.5,'teal',0,1.2,0);cyl(.55,.55,.7,'teal',0,2.2,0);cyl(.12,.12,.5,'steel',0,2.8,0);pipe(.15,.75,'gold',.55,2.4,0,'x');
      for(const x of[-.85,.85])box(.1,2.1,.1,'steel',x,1.1,.4);
    }else{
      g.userData.cycloneConfiguration={...config,source:'现场展板配置',liveStatus:false};
      g.userData.configurationNote='色差仅区分配置工作位与备用位，不表示实时开停。';g.userData.units=[];
      const columns=Math.ceil(config.total/2),pitch=columns===4?.61:.81;
      for(let i=0;i<config.total;i++){
        const x=((i%columns)-(columns-1)/2)*pitch,z=i<columns?.53:-.53;
        const role=i<config.duty?'duty':'standby',color=role==='duty'?'teal':'standby';
        g.userData.units.push({index:i+1,role,position:[x,0,z]});
        name(cyl(.22,.055,.92,color,x,1.36,z),'旋流器锥段');
        name(cyl(.22,.22,.43,color,x,2.035,z),'旋流器筒段');
        pipe(.053,.2,'gold',x,.8,z);
        pipe(.053,.38,'steel',x,2.45,z);
        pipe(.053,.53,'steel',x,2.64,z/2,'z');
        // Tangential offset inlet branches from the common lower feed header.
        pipe(.068,.53,color,x+.14,2.13,z/2,'z');
      }
      for(const x of[-1.21,1.21])for(const z of[-.72,.72])box(.09,1.45,.09,'steel',x,.895,z);
      name(pipe(.105,2.65,'gold',0,2.13,0,'x'),'共同给料管');
      name(pipe(.075,2.65,'steel',0,2.64,0,'x'),'溢流汇集管');
      box(2.6,.1,1.57,'dark',0,.58,0);
      for(const z of[-.8,.8])box(2.6,.16,.06,'teal',0,.69,z);
      pipe(.11,.28,'gold',1.37,.56,0,'x');
    }
  }else if(type==='thickener'){
    // A sectioned operation symbol makes the high overflow and low solids outlet distinct.
    for(const x of[-.8,.8])for(const z of[-.7,.7])box(.09,.52,.09,'steel',x,.36,z);
    const half=Math.PI/2,span=Math.PI;
    name(add(cached('thickener-symbol-cone',()=>new THREE.CylinderGeometry(1.28,.24,.5,28,1,true,half,span)),'shell',0,.7,0),'锥底剖面');
    name(add(cached('thickener-symbol-wall',()=>new THREE.CylinderGeometry(1.28,1.28,.62,28,1,true,half,span)),'shell',0,1.25,0),'池体剖面');
    ring(1.29,'gold',0,1.56,0);ring(1.36,'water',0,1.51,0);
    const bed=cyl(1.17,.2,.4,'sediment',0,.72,0);bed.name='沉降浓缩区';
    pipe(.045,1.23,'steel',0,1.18,0);
    for(const a of[0,Math.PI/2]){
      const arm=box(2.26,.045,.075,'gold',0,.91,0);arm.rotation.y=a;
      for(const sign of[-1,1])for(let i=1;i<=4;i++){
        const r=i*.24,x=Math.cos(a)*r*sign,z=-Math.sin(a)*r*sign;
        const tooth=box(.08,.12,.22,'steel',x,.84,z);tooth.rotation.y=a+.35;
      }
    }
    name(add(cached('feedwell-symbol',()=>new THREE.CylinderGeometry(.36,.36,.41,20,1,true)),'shell',0,1.54,0),'中心给矿井');
    pipe(.085,1.18,'gold',-.92,1.63,0,'x');
    box(2.75,.1,.22,'steel',0,1.85,0);box(.32,.19,.33,'dark',0,2,0);cyl(.19,.19,.3,'teal',0,2.2,0);
    name(pipe(.095,1.37,'gold',.6,.4,0,'x'),'底流排矿');
    name(pipe(.07,.42,'water',1.42,1.49,0,'x'),'上部溢流');
    g.userData.ports={feed:[-1.51,1.63,0],underflow:[1.28,.4,0],overflow:[1.63,1.49,0]};
  }else if(type==='filter'){
    for(const x of[-1.16,1.2])for(const z of[-.55,.55])box(.13,.7,.13,'steel',x,.52,z);
    for(const z of[-.63,.63])box(2.8,.13,.11,'steel',0,1.02,z);
    box(.16,1.45,1.44,'teal',-1.28,1.34,0);box(.16,1.35,1.4,'teal',.64,1.33,0);
    for(let i=0;i<9;i++){
      const x=-1.08+i*.18;
      name(box(.08,1.23,1.24,'steel',x,1.33,0),'滤板与滤布');
      box(.11,.1,1.37,'teal',x,1.98,0);
      box(.12,.12,.16,'gold',x,1.47,.73);
    }
    pipe(.19,.59,'dark',1.12,1.34,0,'x');pipe(.075,.38,'steel',.82,1.34,0,'x');
    box(.16,1.15,1.38,'teal',1.45,1.24,0);
    name(box(2.45,.07,1.48,'dark',-.1,.3,0),'承饼托盘');
    for(let i=0;i<4;i++)name(box(.28,.065,.8,'sediment',-.87+i*.43,.38+i%2*.045,0),'精矿滤饼');
    name(pipe(.065,2.65,'water',0,.57,.73,'x'),'滤液汇集');pipe(.08,.37,'gold',-1.49,1.34,0,'x');
    g.userData.ports={feed:[-1.67,1.34,0],filtrate:[1.33,.57,.73],cake:[.3,.4,0]};
  }else if(type==='lamella'){
    // Three visible bays stand for the three series units identified on the board.
    for(let unit=0;unit<3;unit++){
      const x=(unit-1)*.88;box(.76,.68,1.55,'teal',x,.73,0);
      for(let i=0;i<5;i++){const plate=box(.68,.055,1.12,'steel',x,1.05+i*.075,-.38+i*.19);plate.rotation.x=-.48;}
      pipe(.07,.48,'gold',x,.31,.35,'z');
    }
    name(pipe(.065,2.75,'water',0,1.42,-.69,'x'),'逐级澄清溢流');
    name(pipe(.07,2.75,'gold',0,.29,.65,'x'),'三台底流汇集');
  }else if(type==='water'){
    cyl(1.3,1.3,.86,'teal',0,.65,0);ring(1.31,'steel',0,1.1,0);
    name(cyl(1.23,1.23,.035,'water',0,1.11,0),'回水汇集液面');
    pipe(.07,.58,'water',-1.23,1.35,0,'x');pipe(.07,.28,'water',-1.47,1.2,0);
    for(const x of[-.14,.14])pipe(.025,1.2,'steel',x,.62,1.35);
    for(let i=0;i<5;i++)pipe(.023,.32,'steel',0,.2+i*.22,1.35,'x');
  }else if(type==='screen'){
    box(2.7,.7,1.7,'teal',0,.8,0);
    for(let i=0;i<7;i++)box(.06,.2,1.65,'steel',-1.15+i*2.3/6,1.2,0);
  }else if(type==='hopper'){
    const bin=add(cached('square-hopper',()=>new THREE.CylinderGeometry(1.25,.45,1.4,4)),'teal',0,1.6,0);bin.rotation.y=Math.PI/4;
    for(const x of[-.8,.8])box(.12,1.5,.12,'steel',x,.85,.6);
  }else if(type==='storage'){
    box(2.5,.3,1.8,'teal',0,.3,0);
    if(node?.id==='concentrate-storage')for(let i=0;i<12;i++)name(box(.57,.1,.67,'sediment',((i%3)-1)*.7,.52+Math.floor(i/6)*.13,(Math.floor(i/3)%2-.5)*.78),'含金精矿滤饼');
    else for(const x of[-.75,0,.75])cyl(.04,.6,.85,'gold',x,.75,0);
  }else{
    const wide=type==='thickener'||type==='water';cyl(wide?1.3:.9,wide?1.3:.9,wide?.8:1.6,'teal',0,wide?.6:1,0);
    ring(wide?1.3:.9,'gold',0,wide?1.05:1.85,0);cyl(wide?1.2:.8,wide?1.2:.8,.04,'dark',0,wide?1.07:1.86,0);
    if(type!=='water'){box(2.4,.13,.35,'steel',0,wide?1.23:2.1,0);cyl(.3,.3,.4,'teal',0,wide?1.5:2.4,0);}
  }
  // Combine repeated static elements only within the same transform parent.
  // Keep operation-level node ownership on the scene holder for ray selection.
  const instanceRepeated=root=>{
    const batches=new Map();
    for(const child of[...root.children]){
      if(child.isGroup)instanceRepeated(child);
      if(!child.isMesh||child.isInstancedMesh)continue;
      const key=`${child.geometry.uuid}:${child.material.uuid}`;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(child);
    }
    for(const meshes of batches.values())if(meshes.length>1){
      const first=meshes[0],batch=new THREE.InstancedMesh(first.geometry,first.material,meshes.length);batch.name=first.name||'重复示意构件';
      meshes.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);root.remove(mesh);});
      batch.computeBoundingBox();batch.computeBoundingSphere();root.add(batch);
    }
  };
  instanceRepeated(g);return g;
}
