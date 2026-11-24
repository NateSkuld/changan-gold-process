import * as THREE from 'three';
import { buildCadThickenerCivil, buildCadDrive } from './thickener-cad.js';

// Each vessel has its own working scale (camera fits the tank, not the site).
export function createThickener({diameter = 12} = {}) {
  const group = new THREE.Group(), parts = [];
  const civil = Number(diameter) === 38, RADIUS = 3.16, s = RADIUS / (civil ? 19 : 6);
  const el = elevation => (6.25 + elevation) * s;
  const court = [[1.5825,-4.231],[2.275,-3.031],[11.325,-.942],[19,0]];
  const FLOOR_BASE = civil ? el(-4.231) : .852, FLOOR_SLOPE = civil ? null : .385, SURFACE = civil ? el(1.60) : 3.115;
  const floorAt = r => {
    if(!civil)return FLOOR_BASE + FLOOR_SLOPE*r;
    const x=r/s;
    for(let i=1;i<court.length;i++)if(x<=court[i][0]){
      const [a,h]=court[i-1],[b,j]=court[i];return el(h+(j-h)*Math.max(0,(x-a)/(b-a)));
    }
    return el(0);
  };
  group.name = civil ? 'GZN-38 · 尾矿浓密池' : 'Φ12 m · 精矿浓密池';
  group.userData.diameterM = civil ? 38 : 12;
  group.userData.unitsPerMetre = s;
  group.userData.floorStationsM = civil ? court : null;
  const RAKE_SPEED = .065;
  const up = new THREE.Vector3(0, 1, 0), dummy = new THREE.Object3D();
  const V = a => new THREE.Vector3(...a);
  const M = {
    teal: new THREE.MeshStandardMaterial({ color: 0x286e68, metalness: .64, roughness: .36, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ color: 0x4b8a80, metalness: .57, roughness: .38, side: THREE.DoubleSide }),
    lining: new THREE.MeshStandardMaterial({ color: 0xb2b4a6, metalness: .14, roughness: .74, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x28373a, metalness: .68, roughness: .42 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9fa9a4, metalness: .84, roughness: .3, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: 0xbba16d, metalness: .74, roughness: .38 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9d9d91, roughness: .92, metalness: .01, side: THREE.DoubleSide }),
    solids: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }),
  };
  const cache = new Map();
  function geometry(key, create) { if (!cache.has(key)) cache.set(key, create()); return cache.get(key); }
  function part(id, name, description, anchor, explode) {
    const root = new THREE.Group(); root.name = name; root.userData.partId = id; group.add(root);
    parts.push({ id, name, description, root, anchor: V(anchor), explode: V(explode) }); return root;
  }
  function mesh(parent, geo, mat, pos = [0, 0, 0], cut = false) {
    const object = new THREE.Mesh(geo, mat); object.position.set(...pos); object.castShadow = true; object.receiveShadow = true;
    if (cut) object.userData.cutaway = true; parent.add(object); return object;
  }
  function box(parent, size, pos, material = M.teal, cut = false) {
    return mesh(parent, geometry(`box:${size}`, () => new THREE.BoxGeometry(...size)), material, pos, cut);
  }
  function cyl(parent, radius, height, pos, material = M.steel, radial = 32, cut = false) {
    return mesh(parent, geometry(`cyl:${radius}:${height}:${radial}`, () => new THREE.CylinderGeometry(radius, radius, height, radial)), material, pos, cut);
  }
  function beam(parent, a, b, radius = .04, material = M.steel, cut = false) {
    const start = V(a), end = V(b), dir = end.clone().sub(start);
    const object = cyl(parent, radius, dir.length(), start.add(end).multiplyScalar(.5).toArray(), material, 10, cut);
    object.quaternion.setFromUnitVectors(up, dir.normalize()); return object;
  }
  function ring(parent, radius, tube, pos, material = M.brass, cut = false) {
    const geo = geometry(`ring:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 8, 96));
    const object = mesh(parent, geo, material, pos, cut); object.rotation.x = Math.PI / 2; return object;
  }
  function halfProfile(parent, profile, material, name) {
    for (const [start, cut] of [[Math.PI / 2, false], [-Math.PI / 2, true]]) {
      const wall = mesh(parent, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 48, start, Math.PI), material, undefined, cut);
      wall.name = `${name}:${cut ? 'front' : 'back'}`;
      // Close the two section edges so the wall reads as a solid vessel.
      if (profile.length > 3) for (const angle of [start, start + Math.PI]) {
        const shape = new THREE.Shape(profile.map(p => new THREE.Vector2(...p)));
        const cap = new THREE.ShapeGeometry(shape);
        const positions = cap.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const r = positions.getX(i), y = positions.getY(i);
          positions.setXYZ(i, Math.sin(angle) * r, y, Math.cos(angle) * r);
        }
        cap.computeVertexNormals(); mesh(parent, cap, material, undefined, cut);
      }
    }
  }
  function flange(parent, p, radius, axis = 'y') {
    const holder = new THREE.Group(); holder.position.set(...p); parent.add(holder);
    if (axis === 'x') holder.rotation.z = -Math.PI / 2;
    const bore = radius * .62, h=radius*.13;
    mesh(holder, new THREE.LatheGeometry([[bore,-h],[radius,-h],[radius,h],[bore,h],[bore,-h]].map(p => new THREE.Vector2(...p)), 32), M.steel);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cyl(holder, radius*.085, h*2.7, [Math.sin(a) * radius * .82, 0, Math.cos(a) * radius * .82], M.brass, 6); }
  }
  function pipe(parent, points, radius, material = M.teal, thickness = radius * .16) {
    const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
    const shell=new THREE.Group(); shell.userData.pipeWall={radius,thickness};shell.name='pipe-shell';parent.add(shell);
    const p = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3();
    const segments = 64, sides = 10, stride = (sides + 1) * 2;
    for (const [start, cut] of [[Math.PI / 2, false], [-Math.PI / 2, true]]) {
      const positions = [], indices = [];
      for (let i = 0; i <= segments; i++) {
        curve.getPointAt(i / segments, p); curve.getTangentAt(i / segments, tangent);
        n.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
        if (n.lengthSq() < .01) n.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
        n.normalize(); b.crossVectors(tangent, n).normalize();
        for (const r of [radius, radius - thickness]) for (let j = 0; j <= sides; j++) {
          const angle = start + Math.PI * j / sides, c = Math.cos(angle) * r, s = Math.sin(angle) * r;
          positions.push(p.x + n.x * c + b.x * s, p.y + n.y * c + b.y * s, p.z + n.z * c + b.z * s);
        }
      }
      const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < sides; j++) {
          const k = i * stride + j, h = k + sides + 1;
          quad(k, k + 1, k + stride + 1, k + stride); quad(h, h + stride, h + stride + 1, h + 1);
        }
        for (const j of [0, sides]) { const k = i * stride + j; quad(k, k + sides + 1, k + stride + sides + 1, k + stride); }
      }
      for (const i of [0, segments]) for (let j = 0; j < sides; j++) {
        const k = i * stride + j; quad(k, k + 1, k + sides + 2, k + sides + 1);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
      mesh(shell, geo, material, undefined, cut);
    }
    return curve;
  }
  const layers = [];
  function overlay(parent, name, step) {
    const layer = new THREE.Group(); layer.name = name; layer.userData.operationLayer = true; layer.userData.labelObstacle = false;
    layer.userData.operationStep = step; parent.add(layer); layers.push(layer); return layer;
  }
  const noRaycast = () => {};
  function visual(object) {
    object.userData.labelObstacle = false; object.userData.operationVisual = true; object.raycast = noRaycast;
    object.castShadow = false; object.receiveShadow = false; return object;
  }
  function fixedBounds(batch, points, padding) {
    batch.boundingBox = new THREE.Box3().setFromPoints(points).expandByScalar(padding);
    batch.boundingSphere = batch.boundingBox.getBoundingSphere(new THREE.Sphere());
  }
  const flows = [];
  function stream(parent, curve, name, color, step, count = 24, speed = .08, size = .04, arrowCount = 3) {
    const layer = overlay(parent, name, step);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, toneMapped: false });
    const tracers = visual(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(size, 0), material, count));
    tracers.name = `${name}:particles`; tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); layer.add(tracers);
    const arrows = visual(new THREE.InstancedMesh(new THREE.ConeGeometry(size * 1.25, size * 3.5, 8), material, arrowCount));
    arrows.name = `${name}:arrows`; arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); layer.add(arrows);
    const sampled = curve.getPoints(160); fixedBounds(tracers, sampled, size * 1.6); fixedBounds(arrows, sampled, size * 3);
    const tangent = new THREE.Vector3();
    function update(t) {
      for (let i = 0; i < count; i++) {
        curve.getPointAt((t * speed + i / count) % 1, dummy.position); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); tracers.setMatrixAt(i, dummy.matrix);
      }
      for (let i = 0; i < arrowCount; i++) {
        const phase = (t * speed + (i + .35) / arrowCount) % 1;
        curve.getPointAt(phase, dummy.position); curve.getTangentAt(phase, tangent); dummy.quaternion.setFromUnitVectors(up, tangent.normalize()); dummy.scale.setScalar(1); dummy.updateMatrix(); arrows.setMatrixAt(i, dummy.matrix);
      }
      tracers.instanceMatrix.needsUpdate = true; arrows.instanceMatrix.needsUpdate = true;
    }
    update(0); flows.push(update); return layer;
  }

  const tools={civil,s,el,M,halfProfile,box,cyl,mesh,beam,ring,floorAt};
  const tank = part('thickener-tank', civil?'钢筋混凝土池体与环形集泥区':'钢壳精矿浓密池', civil?'YS0160411-4 剖面：半径 19 m，池顶标高 +1.900 m。沉降固体沿折坡汇入中心柱周围的环形集泥区；前半池与下部围护在剖视中移除。':'机械图题栏注明 Φ12 米高效浓缩机（钢壳）。图纸重点为传动与走台；池深、锥底坡度及支腿布置保留原理示意。', [2.4, civil?el(.6):2.25, 1.5], [2.25, 0, 0]);
  if(civil) buildCadThickenerCivil(tank,tools); else {
  halfProfile(tank, [[.44, .91], [3.27, 2.02], [3.27, 3.06], [3.16, 3.06], [3.16, 2.06], [.39, 1], [.44, .91]], M.teal, 'thickener-tank-wall');
  halfProfile(tank, [[.4, 1.006], [3.153, 2.065], [3.153, 3.045]], M.lining, 'thickener-lining');
  ring(tank, 3.275, .03, [0, 3.06, 0], M.brass);
  ring(tank, 3.275, .045, [0, 2.035, 0], M.dark);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.sin(a) * 3.29, z = Math.cos(a) * 3.29;
    const rib = box(tank, [.065, .96, .08], [x, 2.55, z], M.edge, z > .01); rib.rotation.y = a;
    for (const y of [2.14, 2.95]) {
      const bolt = cyl(tank, .028, .045, [Math.sin(a) * 3.345, y, Math.cos(a) * 3.345], M.brass, 6, z > .01);
      bolt.quaternion.setFromUnitVectors(up, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6, x = Math.cos(a) * 2.67, z = Math.sin(a) * 2.67;
    box(tank, [.64, .12, .64], [x, .08, z], M.dark);
    box(tank, [.2, 1.68, .2], [x, .96, z], M.dark);
    box(tank, [.48, .1, .45], [x, 1.79, z], M.edge);
    for (const dx of [-.22, .22]) for (const dz of [-.22, .22]) cyl(tank, .035, .06, [x + dx, .17, z + dz], M.steel, 6);
    beam(tank, [x, .48, z], [x * .75, 1.54, z * .75], .035, M.steel);
  }

  }

  const feedR=civil?2.15*s:.87,feedTop=civil?el(1.92):3.25,feedBottom=civil?el(-.75):2.39;
  const feed = part('thickener-feedwell', '给矿管与中心给矿井', civil?'管路图 01：扫选尾矿箱送至 GZN-38 给矿口，钢管外径 273 mm、壁厚 10 mm。显示池侧至中心的一段，给矿井断面为示意。':'给矿井消减入料动能，将矿浆分配至精矿沉降区；给矿井尺寸为原理示意。', [0,feedTop,0], [0,.65,-1.4]);
  halfProfile(feed,[[feedR,feedBottom],[feedR,feedTop],[feedR*.95,feedTop],[feedR*.95,feedBottom],[feedR,feedBottom]],M.teal,'thickener-feedwell-wall');
  ring(feed,feedR,.024,[0,feedTop,0],M.edge);
  const feedPoints = civil ? [[3.85,el(5.77),.12],[2.95,el(5.53),.12],[.55,el(4.82),.12],[.26,el(4.6),.12],[.24,el(1.0),.12]] : [[-4.35,3.43,-.63],[-3.3,3.43,-.63],[-1.4,3.43,-.63],[-.42,3.38,-.57],[-.25,2.96,-.32]];
  const feedCurve=pipe(feed,feedPoints,civil?.273*s/2:.16,M.teal,civil?.010*s:.035);
  if(!civil)flange(feed,[-3.8,3.43,-.63],.25,'x');
  stream(feed,feedCurve,'thickener-feed-flow',0xe2b568,0,28,.095,civil?.014:.041,3);

  const rakePart = part('thickener-rake', civil?'耙架与中心回转套':'耙架、刮泥板与中心轴',civil?'中心柱固定，耙架绕柱转动；刮泥板沿折坡将尾矿送向环形集泥区。刮板数量、转速与颗粒运动均为演示。':'中央传动带动耙架低速回转，刮泥板将沉降精矿送向中心底流口。耙臂布置与转速为示意。', [1.4,floorAt(1.4)+.2,0], [0,.3,1.7]);
  const rake=new THREE.Group();rake.name='thickener-rake-rotor';rakePart.add(rake);
  const hubR=civil?1.24*s:.24,hubY=civil?el(-2.55):1.23,hubTop=civil?el(2.2):3.625;
  if(civil){
    // The concrete pier remains stationary inside the open rotating sleeve.
    const inner=.94*s;
    mesh(rake,new THREE.LatheGeometry([[inner,hubY],[hubR,hubY],[hubR,hubTop],[inner,hubTop],[inner,hubY]].map(p=>new THREE.Vector2(...p)),60),M.steel);
  }else{
    cyl(rake,.095,hubTop-1.075,[0,(hubTop+1.075)/2,0],M.steel);
    cyl(rake,.24,.45,[0,hubY,0],M.brass);
  }
  const arms=civil?[3.06,1.28]:[2.94,2.94,2.94,2.94];
  for(let n=0;n<arms.length;n++){
    const arm=new THREE.Group();arm.rotation.y=n*2*Math.PI/arms.length;rake.add(arm);
    const end=arms[n],start=civil?.28:.17,h=civil?.105:.24,half=civil?.072:.12;
    const y=x=>floorAt(x)+h;
    const breaks=civil?[start,...[2.275*s,11.325*s].filter(r=>r>start&&r<end),end]:[start,end];
    for(const zz of [-half,half])for(let k=1;k<breaks.length;k++){
      const a=breaks[k-1],b=breaks[k];beam(arm,[a,y(a),zz],[b,y(b),zz],civil?.018:.03,M.edge);
    }
    const segs=civil?Math.ceil(end/.30):6;
    for(let j=0;j<segs;j++){
      const a=start+(end-start)*j/segs,b=start+(end-start)*(j+1)/segs;
      beam(arm,[a,y(a),-half],[b,y(b),half],civil?.012:.018,M.steel);
      beam(arm,[a,y(a),half],[b,y(b),-half],civil?.012:.018,M.steel);
      const blade=box(arm,[civil?.065:.12,civil?.056:.14,civil?.23:.46],[b,floorAt(b)+(civil?.041:.095),0],M.teal);blade.rotation.y=.4;
    }
    beam(arm,[start,hubY+(civil?.17:.5),0],[end,y(end),0],civil?.014:.027,M.steel);
  }
  const drive=part('thickener-drive',civil?'径向工作桥与中心支承':'花纹钢走台、蜗轮传动与过载指示器',civil?'GZN-38 管路图平面与剖面显示工作桥从中心通向池边；传动头与耙架细部为示意。':'走台按 GXF12-05-1 图两块 785×13590×4 mm 花纹钢板及附板建模。传动部件图标注蜗杆、蜗轮毂、联轴器与电动机；过载指示器按 306-1-3P 的指针和弧形刻度示意。', [civil?1.8:0,civil?el(3.5):3.88,0], [0,1,0]);
  buildCadDrive(drive,tools);

  const outlets=part('thickener-outlets','底流管与外围溢流槽',civil?'GZN-38 管路图：02 底流经 Φ219×10 mm 钢管至尾矿泵；03 溢流经 Φ219×8 mm 钢管至尾矿浓密机回水池。此处仅绘池口附近，不展示厂区全长。':'金色示踪为浓缩精矿底流，青蓝示踪为澄清液越过溢流堰后汇入水槽；池外接口按工艺图关联。', [3,civil?el(1.3):2.9,0],[0,0,-1.7]);
  const troughIn=civil?18.60*s:3.26,troughOut=civil?19*s:3.50,troughTop=civil?el(1.60):3.16,troughBottom=civil?el(1.10):2.89;
  const wall=civil?.012:.052;
  halfProfile(outlets,[[troughIn,troughTop],[troughIn+wall,troughTop],[troughIn+wall,troughBottom+wall],[troughOut-wall,troughBottom+wall],[troughOut-wall,troughTop],[troughOut,troughTop],[troughOut,troughBottom],[troughIn,troughBottom],[troughIn,troughTop]],M.edge,'thickener-overflow-launder');
  const waterPts=civil?[[18.86*s,el(1.20),0],[19.45*s,el(1.10),0],[3.39,el(.9),0],[3.70,el(.30),0]]:[[3.39,2.99,-.15],[3.75,2.91,-.15],[4.17,2.55,-.15]];
  const bottomPts=civil?[[-1.37*s,el(-4.23),0],[-1.82*s,el(-4.76),0],[-2.4*s,el(-4.88),0],[-3.17,el(-5.88),0],[-3.82,el(-6.05),0]]:[[0,1.01,0],[0,.55,0],[.42,.34,0],[2.55,.34,0],[3.78,.34,0]];
  const waterCurve=pipe(outlets,waterPts,civil?.219*s/2:.13,M.edge,civil?.008*s:.023);
  const bottomCurve=pipe(outlets,bottomPts,civil?.219*s/2:.21,M.teal,civil?.010*s:.036);
  flange(outlets,bottomPts.at(-1),civil?.029:.31,'x');
  stream(outlets,bottomCurve,'thickener-underflow',0xe3af5b,2,28,.085,civil?.013:.046,3);
  stream(outlets,waterCurve,'thickener-clearwater-return',0x71cbd7,3,16,.13,civil?.012:.030,2);

  const densityLayer=overlay(tank,'thickener-density-layers',1);
  function tint(color,opacity){return new THREE.MeshStandardMaterial({color,transparent:true,opacity,depthWrite:false,metalness:.03,roughness:.65,side:THREE.DoubleSide});}
  const bottomEdge=civil?19*s*.975:3.06;
  const samples=civil?[1.58*s,2.275*s,11.325*s,bottomEdge]:[.38,bottomEdge];
  const near=civil?.012:.065,far=civil?.057:.24;
  const mudProfile=[...samples.map(r=>[r,floorAt(r)+near]),...samples.slice().reverse().map(r=>[r,floorAt(r)+far]),[samples[0],floorAt(samples[0])+near]];
  const mud=visual(mesh(densityLayer,new THREE.LatheGeometry(mudProfile.map(p=>new THREE.Vector2(...p)),80),tint(0x8c754f,.24)));
  mud.name='thickener-dense-bed';
  const clearR=civil?troughIn-.012:3.08;
  const zone=(r,y,h,color,name)=>{const a=civil?1.24*s:0.001;visual(mesh(densityLayer,new THREE.LatheGeometry([[a,y],[r,y],[r,y+h],[a,y+h],[a,y]].map(p=>new THREE.Vector2(...p)),64),tint(color,.075))).name=name;};
  zone(clearR,civil?el(.35):2.28,civil?.055:.28,0x8fa69a,'thickener-transition-layer');
  zone(clearR,civil?el(.85):2.665,civil?.070:.43,0x8ac4cc,'thickener-clear-layer');
  const topSurface=visual(mesh(densityLayer,new THREE.RingGeometry(feedR,clearR,96),tint(0x91d4d8,.12),[0,SURFACE,0]));topSurface.rotation.x=-Math.PI/2;

  const solidsLayer = overlay(tank, 'thickener-settling-and-raking', 1);
  const solidCount = 168;
  const solids = visual(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.solids, solidCount));
  solids.name = 'thickener-solids'; solids.instanceMatrix.setUsage(THREE.DynamicDrawUsage); solidsLayer.add(solids);
  fixedBounds(solids, [new THREE.Vector3(-3.05, civil?el(-4.25):.86, -3.05), new THREE.Vector3(3.05, SURFACE, 3.05)], .06);
  const phases = new Float32Array(solidCount);
  solids.userData.motion = { kind: 'settle-then-rake-inward', phases, radius: RADIUS, surface:SURFACE, floorBase:FLOOR_BASE, floorSlope:FLOOR_SLOPE, floorAt, minimumY:civil?el(-4.24):.89 };
  let seed = 72529;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const grainData = Array.from({ length: solidCount }, (_, i) => ({ phase: i / solidCount, period: 23 + random() * 9,
    angle: random() * Math.PI * 2, radius: 1.28 + random() * 1.54, size: (civil?.46:1)*(.025 + random() * .017) }));
  const goldColor = new THREE.Color(0xb77b2c), subduedColor = new THREE.Color(0xaeb1a2);
  let selectedStep = -1;
  function updateSolids(time) {
    for (let i = 0; i < solidCount; i++) {
      const grain = grainData[i], p = (grain.phase + time / grain.period) % 1;
      phases[i] = p;
      let radius, y, angle = grain.angle;
      const rStart=civil?1.35*s:.24, rExit=civil?2.35*s:.66, rSump=civil?1.5825*s:.37;
      const yStart=civil?el(1.01):2.94, yExit=civil?el(.58):2.35, offset=civil?.052:.18;
      if(p<.16){
        const f=p/.16;radius=rStart+(rExit-rStart)*f;y=yStart+(yExit-yStart)*f;angle+=.22*f;
      }else if(p<.52){
        const f=(p-.16)/.36;radius=rExit+(grain.radius-rExit)*f;y=yExit+(floorAt(grain.radius)+offset-yExit)*f;angle+=.22;
      }else if(p<.94){
        const f=(p-.52)/.42;radius=grain.radius+(rSump-grain.radius)*f;y=floorAt(radius)+offset;angle+=.22+(p-.52)*grain.period*RAKE_SPEED;
      }else{
        const f=(p-.94)/.06;radius=rSump+((civil?1.37*s:0)-rSump)*f;y=(floorAt(rSump)+offset)*(1-f)+(civil?el(-4.04):.94)*f;
        angle+=.22+.42*grain.period*RAKE_SPEED;
      }
      const fade = Math.min(1, p / .025, (1 - p) / .025);
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.rotation.set(grain.angle, time * .2, grain.angle * .5); dummy.scale.setScalar(grain.size * Math.max(.04, fade));
      dummy.updateMatrix(); solids.setMatrixAt(i, dummy.matrix);
      const highlighted = selectedStep < 0 || selectedStep === 1 && p < .52 || selectedStep === 2 && p >= .52;
      solids.setColorAt(i, highlighted ? goldColor : subduedColor);
    }
    solids.instanceMatrix.needsUpdate = true;
    solids.instanceColor.needsUpdate = true;
  }
  // Separate water paths rise outward to the peripheral weir. There is no
  // assumption that solids and water share the same recirculating motion.
  for (const a of [-.48, .57, 1.55, 2.75]) {
    const band=(troughIn+troughOut)/2;
    const waterPath=civil?[[.48,el(.02)],[1.00,el(.51)],[2.56,el(1.1)],[troughIn,SURFACE+.004],[band,SURFACE+.002],[band,troughBottom+.036]]:[[1.05,2.4],[1.75,2.66],[2.56,2.9],[3.16,SURFACE],[3.33,SURFACE],[3.39,3.015]];
    const points=waterPath.map(([r,y])=>[Math.cos(a)*r,y,Math.sin(a)*r]);
    stream(tank,new THREE.CatmullRomCurve3(points.map(V),false,'centripetal'),`thickener-water-rise-${a}`,0x74ced9,3,13,.075,civil?.010:.024,2);
  }
  const launderWater=overlay(outlets,'thickener-launder-water',3);
  const waterBand=visual(mesh(launderWater,new THREE.RingGeometry(troughIn+wall,troughOut-wall,96),tint(0x65c4d5,.45),[0,troughBottom+(civil?.032:.115),0]));waterBand.rotation.x=-Math.PI/2;

  // Batch only static siblings; moving subassemblies and overlay roots stay
  // independent so disassembly never acquires an animated root transform.
  function batchRepeated(root) {
    const batches = new Map();
    for (const child of [...root.children]) {
      if (child.isGroup) batchRepeated(child);
      if (!child.isMesh || child.isInstancedMesh || child.userData.operationVisual) continue;
      const key = `${child.geometry.uuid}:${child.material.uuid}:${!!child.userData.cutaway}`;
      if (!batches.has(key)) batches.set(key, []); batches.get(key).push(child);
    }
    for (const set of batches.values()) {
      if (set.length < 2) continue;
      const item = new THREE.InstancedMesh(set[0].geometry, set[0].material, set.length);
      item.castShadow = true; item.receiveShadow = true; item.userData = { ...set[0].userData };
      set.forEach((child, i) => { child.updateMatrix(); item.setMatrixAt(i, child.matrix); root.remove(child); });
      item.computeBoundingBox(); item.computeBoundingSphere(); root.add(item);
    }
  }
  parts.forEach(p => batchRepeated(p.root));
  let elapsed = 0, mode = 'cutaway';
  function setViewMode(view) {
    mode = view;
    group.traverse(o => { if (o.userData.cutaway) o.visible = mode !== 'cutaway'; });
    for (const layer of layers) layer.visible = mode === 'cutaway';
  }
  function update(delta) {
    if (mode === 'exploded') return;
    elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .08));
    rake.rotation.y = -elapsed * RAKE_SPEED;
    updateSolids(elapsed); for (const tick of flows) tick(elapsed);
  }
  function setOperationStep(index = -1) {
    selectedStep = Number.isInteger(index) && index >= 0 && index < 4 ? index : -1;
    for (const layer of layers) {
      const active = selectedStep < 0 || layer.userData.operationStep === selectedStep;
      layer.traverse(object => {
        if (!object.isMesh || !object.userData.operationVisual) return;
        const material = object.material;
        material.userData.operationBaseOpacity ??= material.opacity;
        material.opacity = object === solids
          ? (selectedStep < 0 || selectedStep === 1 || selectedStep === 2 ? 1 : .2)
          : material.userData.operationBaseOpacity * (active ? 1 : .2);
      });
    }
    // Refresh the stage-specific particle colours without advancing the clock.
    updateSolids(elapsed);
  }
  const sources = [
    { title: 'Metso · High Rate Thickeners / Operation', url: 'https://www.metso.com/portfolio/high-rate-thickener/' },
    { title: 'FLS · Thickening and water stewardship', url: 'https://fls.com/en/innovation/water-stewardship/thickening' },
  ];
  const operationGuide = {
    title: '固体向下，澄清液向上',
    summary: '金色示踪沿给矿、沉降、耙集和底流路径前进，青蓝示踪向上汇入外围溢流槽。',
    steps: [
      { label: '给矿分散', description: '矿浆进入中心给矿井，进料动能减弱后向周围沉降区分配。', partId: 'thickener-feedwell', color: '#e2b568' },
      { label: '沉降浓缩', description: '固体逐渐向下沉降；较清的上层液体与下部浓密泥层形成浓度差。', partId: 'thickener-tank', color: '#c4a46d' },
      { label: '耙集底流', description: '耙架低速旋转，刮泥板将已沉降固体沿锥底送向中心，再由底流管排出。', partId: 'thickener-rake', color: '#e3af5b' },
      { label: '澄清溢流', description: '澄清液上升越过外围溢流堰，沿水槽汇出；后续回水路径应按当前流程接口追踪。', partId: 'thickener-outlets', color: '#74ced9' },
    ], sources,
  };
  update(0); setViewMode('cutaway');
  group.userData.partIds = parts.map(p => p.id);
  return { group, parts, update, setViewMode, setOperationStep, operationGuide, sources };
}
