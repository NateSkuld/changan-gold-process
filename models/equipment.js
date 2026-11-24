import * as THREE from 'three';

// Shared visual language. Dimensions illustrate the mechanisms, not a fabrication drawing.
const mat = {
  teal: new THREE.MeshStandardMaterial({ color: 0x276d68, metalness: 0.68, roughness: 0.34, side: THREE.DoubleSide }),
  edge: new THREE.MeshStandardMaterial({ color: 0x438780, metalness: 0.58, roughness: 0.36, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x202d30, metalness: 0.65, roughness: 0.44 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8d9b99, metalness: 0.85, roughness: 0.29 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xcaa05d, metalness: 0.72, roughness: 0.34 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x131d20, metalness: 0.12, roughness: 0.8 }),
  pale: new THREE.MeshStandardMaterial({ color: 0xd4d6c6, metalness: 0.08, roughness: 0.78, side: THREE.DoubleSide }),
  ore: new THREE.MeshStandardMaterial({ color: 0x8a8170, metalness: 0.1, roughness: 0.95 }),
  slurry: new THREE.MeshStandardMaterial({ color: 0x729b96, metalness: 0.15, roughness: 0.43, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  flow: new THREE.MeshStandardMaterial({ color: 0xf2c173, metalness: 0.25, roughness: 0.35, emissive: 0x573614, emissiveIntensity: 0.45 }),
  bubbles: new THREE.MeshStandardMaterial({ color: 0xd9ede4, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.65 }),
};
const UP = new THREE.Vector3(0, 1, 0);
const vec = a => new THREE.Vector3(...a);

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], cutaway = false) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  if (cutaway) item.userData.cutaway = true;
  parent.add(item);
  return item;
}
function box(parent, size, position, material = mat.teal, rotation, cutaway = false) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, position, rotation, cutaway);
}
function cyl(parent, radius, height, position, material = mat.steel, rotation, radiusBottom = radius, cutaway = false, segments = 32) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radiusBottom, height, segments), material, position, rotation, cutaway);
}
function beam(parent, start, end, radius = 0.08, material = mat.steel) {
  const a = vec(start), b = vec(end), direction = b.clone().sub(a);
  const m = cyl(parent, radius, direction.length(), a.add(b).multiplyScalar(0.5).toArray(), material, undefined, radius, false, 12);
  m.quaternion.setFromUnitVectors(UP, direction.normalize());
  return m;
}
function ring(parent, radius, tube, position, material = mat.brass, rotation = [Math.PI / 2, 0, 0]) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 64), material, position, rotation);
}
function pipe(parent, points, radius = 0.12, material = mat.teal) {
  const path = new THREE.CatmullRomCurve3(points.map(vec), false, 'centripetal');
  return mesh(parent, new THREE.TubeGeometry(path, Math.max(16, points.length * 10), radius, 10, false), material);
}
function part(group, parts, id, name, description, anchor, explode) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.partId = id;
  group.add(root);
  parts.push({ id, name, description, root, anchor: vec(anchor), explode: vec(explode) });
  return root;
}
function foot(parent, x, z, top, width = 0.24) {
  box(parent, [0.65, 0.12, 0.65], [x, 0.08, z], mat.dark);
  box(parent, [width, top, width], [x, top / 2 + 0.13, z], mat.dark);
  for (const dx of [-0.22, 0.22]) for (const dz of [-0.22, 0.22]) cyl(parent, 0.043, 0.09, [x + dx, 0.18, z + dz], mat.steel, undefined, 0.043, false, 6);
}
function flange(parent, position, radius, axis = 'y', material = mat.steel) {
  const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  cyl(parent, radius, 0.08, position, material, rot);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, r = radius * 0.77;
    const p = [...position];
    if (axis === 'x') { p[1] += Math.sin(a) * r; p[2] += Math.cos(a) * r; }
    else if (axis === 'z') { p[0] += Math.sin(a) * r; p[1] += Math.cos(a) * r; }
    else { p[0] += Math.sin(a) * r; p[2] += Math.cos(a) * r; }
    cyl(parent, 0.035, 0.105, p, mat.brass, rot, 0.035, false, 6);
  }
}
function motor(parent, position, length = 1, radius = 0.32, axis = 'x') {
  const root = new THREE.Group(); root.position.set(...position); parent.add(root);
  if (axis === 'x') root.rotation.z = -Math.PI / 2;
  if (axis === 'z') root.rotation.x = Math.PI / 2;
  cyl(root, radius, length, [0, 0, 0], mat.dark);
  for (let i = 0; i < 9; i++) cyl(root, radius * 1.1, 0.04, [0, (i / 8 - 0.5) * length * 0.76, 0], mat.edge);
  cyl(root, radius * 0.96, 0.1, [0, -length / 2 - 0.03, 0], mat.dark);
  cyl(root, radius * 0.36, 0.22, [0, length / 2 + 0.08, 0], mat.steel);
  box(root, [radius * 0.8, length * 0.4, radius * 0.6], [0, 0, radius], mat.dark);
  return root;
}
function halfShell(parent, rTop, rBottom, height, y, material = mat.teal) {
  // Positive-Z shell is the removable half facing the default presentation camera.
  mesh(parent, new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true, Math.PI / 2, Math.PI), material, [0, y, 0]);
  mesh(parent, new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true, -Math.PI / 2, Math.PI), material, [0, y, 0], undefined, true);
}
function funnel(parent, topW, topD, bottomW, bottomD, height, center, material = mat.teal, removableFront = false) {
  const [x, y, z] = center;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const values = [a[0]*topW/2, height/2, a[1]*topD/2, b[0]*topW/2, height/2, b[1]*topD/2, b[0]*bottomW/2, -height/2, b[1]*bottomD/2, a[0]*bottomW/2, -height/2, a[1]*bottomD/2];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(values, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    mesh(parent, g, material, [x, y, z], undefined, removableFront && i === 2);
  }
}

export function createCrusher() {
  const group = new THREE.Group(), parts = [];
  const frame = part(group, parts, 'crusher-frame', '机架与侧护板', '刚性机架承受破碎载荷；可拆侧护板保护轴承并便于检修。剖视可观察动、定颚之间的破碎腔。', [0, 1.5, 1.5], [0, 0, 2.5]);
  for (const x of [-1.7, 1.7]) for (const z of [-1.18, 1.18]) foot(frame, x, z, 1.02, 0.35);
  box(frame, [4.15, 0.4, 2.85], [0, 1.2, 0], mat.dark);
  for (const z of [-1.42, 1.42]) {
    box(frame, [3.85, 2.15, 0.18], [0, 2.47, z], mat.teal, undefined, z > 0);
    for (const x of [-1.7, -0.85, 0, 0.85, 1.7]) {
      box(frame, [0.095, 1.65, 0.075], [x, 2.4, z + Math.sign(z) * 0.12], mat.edge, undefined, z > 0);
      for (const y of [1.7, 3.25]) cyl(frame, 0.064, 0.09, [x, y, z + Math.sign(z) * 0.18], mat.brass, [Math.PI/2, 0, 0], 0.064, z > 0, 6);
    }
  }
  box(frame, [3.8, 0.15, 2.9], [0, 3.62, 0], mat.edge, undefined, true);
  funnel(frame, 2.1, 2.1, 1.1, 1.5, 0.7, [0.15, 0.85, 0], mat.dark, true);

  const feed = part(group, parts, 'crusher-hopper', '进料斗', '原矿由上部进入破碎腔，料斗导向颚板工作区。进料粒度和连续给料需与现场设备能力匹配。', [0, 4.15, 0], [0, 1.6, 0]);
  funnel(feed, 3.9, 3.1, 2.25, 2.15, 1.0, [0, 4.05, 0], mat.teal, true);
  for (const z of [-1.55, 1.55]) box(feed, [4.1, 0.1, 0.13], [0, 4.57, z], mat.brass);
  for (const x of [-1.95, 1.95]) box(feed, [0.13, 0.1, 3.15], [x, 4.57, 0], mat.edge);
  for (let i = 0; i < 8; i++) {
    const rock = mesh(feed, new THREE.DodecahedronGeometry(0.15 + i % 3 * 0.05), mat.ore, [-0.75 + (i % 4)*0.45, 3.82 + Math.floor(i/4)*0.24, (i % 2 - 0.5)*0.67]);
    rock.rotation.set(i, i * 0.7, i * 0.4);
  }

  const fixed = part(group, parts, 'crusher-fixed-jaw', '定颚与耐磨齿板', '定颚保持固定，耐磨齿板与动颚共同形成上宽下窄的破碎腔；矿石在周期挤压中破碎。', [-0.78, 2.6, 0], [-1.7, 0.35, 0]);
  const fixedPlate = new THREE.Group(); fixedPlate.position.set(-0.85, 2.48, 0); fixedPlate.rotation.z = 0.21; fixed.add(fixedPlate);
  box(fixedPlate, [0.4, 2.2, 2.5], [0, 0, 0], mat.dark);
  for (let i = 0; i < 11; i++) box(fixedPlate, [0.14, 2.08, 0.09], [0.25, 0, (i-5)*0.22], mat.steel);

  const moving = part(group, parts, 'crusher-moving-jaw', '动颚与肘板', '偏心轴带动动颚往复摆动；肘板支承并传递力。排料口处的最小间隙影响出料粒度。', [0.85, 2.55, 0], [1.7, 0.35, 0]);
  const jawPivot = new THREE.Group(); jawPivot.position.set(0.83, 3.52, 0); jawPivot.rotation.z = -0.16; moving.add(jawPivot);
  box(jawPivot, [0.43, 2.1, 2.45], [0, -1.02, 0], mat.dark);
  for (let i = 0; i < 11; i++) box(jawPivot, [0.14, 2.01, 0.09], [-0.25, -1.02, (i-5)*0.22], mat.steel);
  beam(moving, [0.78, 1.51, -0.9], [1.68, 1.88, -0.9], 0.09, mat.brass);
  beam(moving, [0.78, 1.51, 0.9], [1.68, 1.88, 0.9], 0.09, mat.brass);

  const eccentric = part(group, parts, 'crusher-eccentric', '偏心轴与飞轮', '偏心轴将连续旋转转为动颚摆动，飞轮储存并释放能量，使负载变化更平稳。', [0.8, 3.42, 1.97], [0, 0, -2.3]);
  cyl(eccentric, 0.15, 4.15, [0.83, 3.45, 0], mat.steel, [Math.PI/2, 0, 0]);
  const wheels = [];
  for (const z of [-1.89, 1.89]) {
    const wheel = new THREE.Group(); wheel.position.set(0.83, 3.45, z); eccentric.add(wheel); wheels.push(wheel);
    ring(wheel, 0.9, 0.11, [0, 0, 0], mat.dark, [0, 0, 0]);
    ring(wheel, 0.93, 0.035, [0, 0, 0.07], mat.brass, [0, 0, 0]);
    cyl(wheel, 0.23, 0.32, [0, 0, 0], mat.steel, [Math.PI/2, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = i*Math.PI/3; beam(wheel, [Math.cos(a)*0.2, Math.sin(a)*0.2, 0], [Math.cos(a)*0.84, Math.sin(a)*0.84, 0], 0.055, mat.edge); }
  }

  const drive = part(group, parts, 'crusher-drive', '电机与带传动', '电机经带传动驱动偏心轴。传动护罩、轴承润滑与紧固件需要在现场定期检查。', [-2.95, 1.0, 1.8], [-1.4, 0, 1.3]);
  box(drive, [1.65, 0.22, 1.4], [-2.86, 0.45, 0.95], mat.dark);
  motor(drive, [-2.86, 0.94, 0.97], 1.05, 0.37, 'z');
  cyl(drive, 0.37, 0.16, [-2.86, 0.94, 1.85], mat.steel, [Math.PI/2, 0, 0]);
  beam(drive, [-2.99, 1.29, 1.91], [0.48, 4.29, 1.91], 0.043, mat.rubber);
  beam(drive, [-2.58, 0.69, 1.91], [1.37, 2.72, 1.91], 0.043, mat.rubber);
  box(drive, [1.5, 0.04, 1.3], [-2.86, 0.57, 0.95], mat.edge);
  return { group, parts, update(delta, time) { jawPivot.rotation.z = -0.16 + Math.sin(time * 3.6) * 0.035; wheels.forEach(w => w.rotation.z = -time * 1.8); } };
}

// Wet-process helpers are deliberately separate from the other equipment factories.
// These are explanatory paths, not a CFD solution or measurements from the plant.
function wetWall(parent, top, bottom, height, y, thickness, material) {
  const profile = [new THREE.Vector2(bottom, -height / 2), new THREE.Vector2(top, height / 2),
    new THREE.Vector2(top - thickness, height / 2), new THREE.Vector2(bottom - thickness, -height / 2),
    new THREE.Vector2(bottom, -height / 2)];
  for (const [start, removable] of [[Math.PI / 2, false], [-Math.PI / 2, true]]) {
    const sector = new THREE.Group(); sector.position.y = y; parent.add(sector);
    if (removable) sector.userData.cutaway = true;
    mesh(sector, new THREE.LatheGeometry(profile, 40, start, Math.PI), material);
    for (const a of [start, start + Math.PI]) {
      const values = profile.slice(0, 4).flatMap(p => [Math.sin(a) * p.x, p.y, Math.cos(a) * p.x]);
      const face = new THREE.BufferGeometry(); face.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      face.setIndex([0, 1, 2, 0, 2, 3]); face.computeVertexNormals(); mesh(sector, face, material);
    }
  }
}
function wetPipe(parent, points, radius, material = mat.teal, thickness = .045) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec), false, 'centripetal');
  const segments = Math.max(20, points.length * 7), radial = 8;
  const p = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), radialVector = new THREE.Vector3();
  // Both halves have real wall thickness. The front half is removed in section view.
  for (const [start, removable] of [[Math.PI / 2, false], [-Math.PI / 2, true]]) {
    const positions = [], indices = [], stride = (radial + 1) * 2;
    for (let i = 0; i <= segments; i++) {
      curve.getPointAt(i / segments, p); curve.getTangentAt(i / segments, tangent);
      n.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
      if (n.lengthSq() < .01) n.set(0, 1, 0).addScaledVector(tangent, -tangent.y);
      n.normalize(); b.crossVectors(tangent, n).normalize();
      for (const r of [radius, Math.max(radius - thickness, radius * .5)]) for (let j = 0; j <= radial; j++) {
        const angle = start + j / radial * Math.PI;
        radialVector.copy(n).multiplyScalar(Math.cos(angle) * r).addScaledVector(b, Math.sin(angle) * r).add(p);
        positions.push(radialVector.x, radialVector.y, radialVector.z);
      }
    }
    const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const k = i * stride + j; quad(k, k + 1, k + stride + 1, k + stride);
        const h = k + radial + 1; quad(h, h + stride, h + stride + 1, h + 1);
      }
      for (const j of [0, radial]) { const k = i * stride + j; quad(k, k + radial + 1, k + stride + radial + 1, k + stride); }
    }
    for (const i of [0, segments]) for (let j = 0; j < radial; j++) {
      const k = i * stride + j; quad(k, k + 1, k + radial + 2, k + radial + 1);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(parent, geometry, material, undefined, undefined, removable);
  }
  return curve;
}
function wetFlange(parent, position, radius, axis = 'y', material = mat.steel) {
  const root = new THREE.Group(); root.position.set(...position); parent.add(root);
  if (axis === 'x') root.rotation.z = Math.PI / 2;
  if (axis === 'z') root.rotation.x = Math.PI / 2;
  const bore = radius * .58, profile = [[bore,-.045],[radius,-.045],[radius,.045],[bore,.045],[bore,-.045]].map(p=>new THREE.Vector2(...p));
  mesh(root,new THREE.LatheGeometry(profile,32),material);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(root,.035,.115,[Math.sin(a)*radius*.81,0,Math.cos(a)*radius*.81],mat.brass,undefined,.035,false,6);}
}
function wetOverlay(parent, name) {
  const layer = new THREE.Group(); layer.name = name; layer.userData.operationLayer = true; parent.add(layer); return layer;
}
function wetVisual(object) {
  object.userData.labelObstacle = false; object.userData.operationVisual = true; object.raycast = () => {};
  object.castShadow = false; object.receiveShadow = false; return object;
}
function wetBounds(batch, points, padding = .18) {
  batch.boundingBox = new THREE.Box3().setFromPoints(points).expandByScalar(padding);
  batch.boundingSphere = batch.boundingBox.getBoundingSphere(new THREE.Sphere());
}
function wetFlow(parent, points, {name, color = 0xdda753, count = 18, speed = .12, size = .055, arrows = 4, closed = false, step = 0, opacity = .95} = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec), closed, 'centripetal');
  curve.arcLengthDivisions = Math.max(200, points.length * 4); curve.updateArcLengths();
  const root = wetOverlay(parent, name), trackMaterial = new THREE.MeshBasicMaterial({color, transparent:true, opacity:.24, depthWrite:false});
  const movingMaterial = new THREE.MeshBasicMaterial({color, transparent:true, opacity, depthWrite:false, toneMapped:false});
  const track = wetVisual(mesh(root, new THREE.TubeGeometry(curve, Math.min(240, Math.max(32, points.length * 2)), .012, 5, closed), trackMaterial));
  const particles = wetVisual(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(size, 0), movingMaterial, count));
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particles.name = `${name}:particles`; root.add(particles);
  const direction = wetVisual(new THREE.InstancedMesh(new THREE.ConeGeometry(size * 1.6, size * 4.2, 6), movingMaterial, arrows));
  direction.instanceMatrix.setUsage(THREE.DynamicDrawUsage); direction.name = `${name}:arrows`; root.add(direction);
  const samples = curve.getPoints(240); wetBounds(particles, samples); wetBounds(direction, samples, .25);
  const dummy = new THREE.Object3D(), tangent = new THREE.Vector3();
  root.userData.flow = {name, step, direction:'along-path', schematic:true};
  function update(time) {
    for (let i = 0; i < count; i++) {
      const t = ((time * speed + i / count) % 1 + 1) % 1;
      curve.getPointAt(t, dummy.position); dummy.quaternion.identity(); dummy.scale.setScalar(1 + i % 3 * .12); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < arrows; i++) {
      const t = ((time * speed + (i + .35) / arrows) % 1 + 1) % 1;
      curve.getPointAt(t, dummy.position); curve.getTangentAt(t, tangent); dummy.quaternion.setFromUnitVectors(UP, tangent.normalize()); dummy.scale.setScalar(1); dummy.updateMatrix(); direction.setMatrixAt(i, dummy.matrix);
    }
    particles.instanceMatrix.needsUpdate = true; direction.instanceMatrix.needsUpdate = true;
  }
  function focus(index) { const active = index < 0 || index === step; trackMaterial.opacity = active ? .24 : .055; movingMaterial.opacity = active ? opacity : .2; }
  update(0); return {root, track, particles, direction, update, focus};
}
function wetModes(group, layers, flows, extraFocus = () => {}) {
  return {
    setViewMode(view) {
      const cutaway = view === 'cutaway'; layers.forEach(layer => { layer.visible = cutaway; });
      group.traverse(object => { if (object.userData.cutaway) object.visible = !cutaway; });
    },
    setOperationStep(index = -1) { const chosen = Number.isInteger(index) && index >= 0 && index <= 2 ? index : -1; flows.forEach(flow => flow.focus(chosen)); extraFocus(chosen); },
  };
}

export function createCyclone() {
  const group = new THREE.Group(), parts = [], flows = [], layers = [];
  group.name = '水力旋流器 · 通用分级原理';
  const linerMaterial=new THREE.MeshStandardMaterial({color:0x52645f,metalness:.08,roughness:.78,side:THREE.DoubleSide});
  const shell = part(group, parts, 'cyclone-shell', '圆柱筒体与锥段', '钢壳包围圆柱段与锥段并承受载荷。剖切露出有厚度的壳壁、耐磨衬层及内外旋流；外观尺寸为通用示意。', [1, 3.2, .3], [2.5, 0, 0]);
  wetWall(shell, 1.10, 1.10, 1.1, 3.7, .065, mat.teal);
  wetWall(shell, 1.10, .31, 2, 2.15, .065, mat.teal);
  cyl(shell, 1.1, .13, [0, 4.29, 0], mat.teal, undefined, 1.1, true);
  for (const y of [3.14, 4.21]) ring(shell, 1.12, .065, [0, y, 0], mat.brass);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    cyl(shell, .046, .17, [Math.sin(a)*1.1, 3.14, Math.cos(a)*1.1], mat.steel, undefined, .046, false, 6);
  }
  const overflow = part(group, parts, 'cyclone-overflow', '溢流管与涡流管', '涡流管深入圆柱段，接收中心附近上行的细粒矿浆。青蓝粒子沿管内上升后进入溢流出口；颜色只表示示意粒级，不表示矿物成分。', [0, 4.55, 0], [0, 1.6, 0]);
  const overflowPoints = [[0,3.27,0],[0,4.40,0],[0,4.8,0],[.55,4.9,0],[1.85,4.9,0]];
  wetPipe(overflow, overflowPoints, .29, mat.edge, .055);
  wetFlange(overflow, [1.85, 4.9, 0], .4, 'x');
  ring(overflow, .29, .035, [0, 3.29, 0], mat.brass);

  const feed = part(group, parts, 'cyclone-feed', '切向给矿管与渣浆泵', '泵送矿浆沿圆柱段切线方向进入，使矿浆绕中心旋转。泵与连接管路仅表示给矿关系，不对应本矿具体泵型。', [-2.75, 1, .6], [-2.2, 0, 0]);
  // The final inlet segment runs parallel to X at z=.88: tangential, not radial.
  const feedPoints = [[-3.05,1,.88],[-3.05,2.65,.88],[-2.75,3.88,.88],[-1.8,3.93,.88],[0,3.93,.88]];
  wetPipe(feed, feedPoints, .21, mat.teal);
  wetFlange(feed, [-1.7,3.93,.88], .32, 'x');
  box(feed, [2.05,.16,1.25], [-2.8,.2,.45], mat.dark);
  cyl(feed, .48, .45, [-3.08,.85,.88], mat.teal, [Math.PI/2,0,0]);
  motor(feed, [-2.55,.75,.05], .9, .3, 'x');
  pipe(feed, [[-3.08,.85,1.2],[-3.08,.85,1.7],[-4.15,.85,1.7]], .19);
  wetFlange(feed, [-4.15,.85,1.7], .29, 'x');

  const under = part(group, parts, 'cyclone-underflow', '沉砂嘴与返砂管', '较粗颗粒主要随外旋流下行，从沉砂嘴随部分水排出。底流在磨矿分级闭路中返回磨机；图中排出路线为原理示意。', [0,.95,0], [0,0,2.2]);
  wetWall(under, .31, .24, .56, .91, .055, mat.rubber);
  ring(under, .255, .055, [0,1.17,0], mat.steel);
  funnel(under, .7,.7,.32,.32,.42,[0,.43,0],mat.dark,true);
  const underPoints = [[0,.92,0],[0,.43,0],[.4,.26,0],[1.7,.26,0],[2.45,.26,0]];
  wetPipe(under, underPoints.slice(1), .18, mat.edge);

  const flow = part(group, parts, 'cyclone-flow', '耐磨衬层与内外旋流', '耐磨衬层保护内壁。金色外旋流携较粗颗粒向下，青蓝内旋流携较细颗粒向上，中心浅色柱示意空气核。内外旋流保持同一周向旋转方向；轨迹不代表 CFD 或精确分级界面。', [.2,2.5,.2], [0,0,-2.1]);
  wetWall(flow, 1.025,1.025,1.08,3.7,.075,linerMaterial);
  wetWall(flow, 1.025,.24,2.0,2.15,.055,linerMaterial);
  // A material break makes the wear liner legible on the two cut faces.
  for (const x of [-1,1]) beam(flow,[x*.98,3.18,0],[x*.98,4.24,0],.022,mat.pale);
  const overlay = wetOverlay(flow, '旋流分级 / 教学流动层'); layers.push(overlay);
  const airMaterial = new THREE.MeshStandardMaterial({color:0xd8ede5,transparent:true,opacity:.22,depthWrite:false,roughness:.5,side:THREE.DoubleSide});
  const airCore = wetVisual(cyl(overlay,.065,3.55,[0,2.58,0],airMaterial,undefined,.035,false,24)); airCore.name='中心空气核（示意）';
  for(const y of [1.3,2.0,2.7,3.4,4.15]) wetVisual(ring(overlay,.072,.009,[0,y,0],mat.pale));
  flows.push(wetFlow(overlay, feedPoints, {name:'切向给矿',color:0xb9c3a9,count:14,speed:.11,size:.047,arrows:3,step:0}));
  const outer=[];
  for(let i=0;i<=144;i++){
    const t=i/144,y=3.93-2.76*t,r=y>=3.15?.88:.105+(y-1.15)/2*.77,a=Math.PI/2-t*Math.PI*8;
    outer.push([Math.cos(a)*r,y,Math.sin(a)*r]);
  }
  outer.push([0,.93,0],...underPoints.slice(1));
  flows.push(wetFlow(overlay,outer,{name:'外旋流 · 粗粒底流',color:0xf1b75f,count:32,speed:.065,size:.056,arrows:7,step:1}));
  const inner=[];
  // Both paths turn clockwise as time advances; only their axial directions differ.
  for(let i=0;i<=112;i++){
    const t=i/112,a=Math.PI/2-t*Math.PI*7,r=.115+.055*t;
    inner.push([Math.cos(a)*r,1.43+t*2.78,Math.sin(a)*r]);
  }
  inner.push([0,4.43,0],[0,4.8,0],[.55,4.9,0],[1.85,4.9,0]);
  flows.push(wetFlow(overlay,inner,{name:'内旋流 · 细粒溢流',color:0x75d7df,count:27,speed:.09,size:.037,arrows:6,step:2}));

  const support = part(group, parts, 'cyclone-support', '支架与检修平台', '支架定位旋流器并支承给矿、溢流管路。平台与支腿位置在这里用于表达机械支承，不代表现场测绘尺寸。', [1.4,1.4,-1.2], [0,-.15,-3.2]);
  for(const x of [-1.35,1.35])for(const z of [-1.05,1.05])foot(support,x,z,3.02,.16);
  for(const z of [-1.05,1.05]){box(support,[2.9,.16,.16],[0,3.12,z],mat.dark);beam(support,[-1.35,.45,z],[1.35,2.9,z],.045,mat.edge);}
  const modes=wetModes(group,layers,flows,index=>{airMaterial.opacity=index<0||index===2?.22:.08;});
  modes.setViewMode('solid');
  const operationGuide={
    title:'看清旋流器如何分级',summary:'金色表示较粗颗粒，青蓝表示较细颗粒。两股旋流周向同向、轴向相反，分别从底流和溢流排出。',
    steps:[
      {label:'切向进入',description:'泵送矿浆从圆柱段侧面沿切线进入，建立旋转流动。',partId:'cyclone-feed',color:'#b9c3a9'},
      {label:'外旋下行',description:'较粗颗粒主要靠近外壁向下，经沉砂嘴与底流管排出。',partId:'cyclone-underflow',color:'#f1b75f'},
      {label:'内旋上行',description:'较细颗粒随中心附近矿浆上行，经涡流管从溢流口排出；中心浅柱表示空气核。',partId:'cyclone-overflow',color:'#75d7df'},
    ],sources:[{title:'McLanahan · Hydrocyclones 工作原理',url:'https://www.mclanahan.com/products/hydrocyclones'},{title:'Weir · Cavex 结构与耐磨衬层',url:'https://www.global.weir/newsroom/global-news/2016/cavex-hydrocyclones-celebrate-20-years-of-innovative-efficiency/'}],
  };
  return {group,parts,...modes,operationGuide,update(delta,time){const clock=Number.isFinite(time)?time:0;flows.forEach(flow=>flow.update(clock));}};
}

export function createFlotation() {
  const group = new THREE.Group(), parts = [], layers = [], flows = [];
  group.name = '浮选机 · 双视图复建';
  // Dimensions are overridden dimension TEXT in the supplied DWG, not a
  // single drawing-space scale. Both projections agree at the centreline.
  const mm=.0016, L=2180*mm, W=2250*mm, H=1900*mm, R=W/2;
  const floor=.16, lip=floor+H, t=.032;
  group.userData.unitsPerMetre=mm*1000;
  group.userData.cad={drawing:'浮选机.dwg', tankMm:[2180,2250,1900], sideInsetMm:550, bottomOffsetMm:400, processCapacity:null};
  const tank = part(group,parts,'flotation-tank','U 形浮选槽','正视图标注 2180 mm，侧视图跨宽 2250 mm，槽底到上缘 1900 mm。侧视两直壁接半圆底；近侧剖开后可见槽底与中心轴。壁厚、漆色为显示用，原图没有标注。',[.7,2.35,W/2],[3.4,0,0]);
  // Positive-Z half opens towards the viewer. Each shell has a continuous
  // curved base and a flat end closure cut along that same centre plane.
  const profile=(sign,inset=0)=>{
    const r=R-inset, pts=[[sign*r,H]];
    for(let j=0;j<=36;j++){
      const a=j*Math.PI/72;
      pts.push([sign*r*Math.cos(a),R-r*Math.sin(a)]);
    }
    return pts;
  };
  function section(parent,points,x0,length,material,cut,name){
    const shape=new THREE.Shape(points.map(([z,y])=>new THREE.Vector2(z,y)));
    shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:12});
    g.rotateY(-Math.PI/2);
    const o=mesh(parent,g,material,[x0+length,floor,0],undefined,cut);o.name=name;return o;
  }
  const shellGroup=new THREE.Group();shellGroup.name='图示U形槽外壳';tank.add(shellGroup);
  for(const sign of [-1,1]){
    const cut=sign>0, outer=profile(sign), inner=profile(sign,t);
    section(shellGroup,[...outer,...inner.reverse()],-L/2,L,mat.teal,cut,'卷板槽身');
    for(const x of [-L/2,L/2-t]){
      section(shellGroup,[...outer,[0,H]],x,t,mat.teal,cut,'槽端板');
      box(tank,[.052,.05,R],[x+t/2,lip-.025,sign*R/2],mat.edge,undefined,cut);
    }
    box(tank,[L,.07,.055],[0,lip-.035,sign*(R-.025)],mat.edge,undefined,cut);
  }

  const rotor=part(group,parts,'flotation-rotor','中心主轴与搅拌机构','图中可辨中心立轴、下方锥台轮廓和固定框，底部两侧定位线距端面各 550 mm。叶片数和定子内部未详绘；剖视的叶片与流线用于解释搅拌。',[0,1.45,.25],[0,.6,2.8]);
  const shaft=new THREE.Group();shaft.name='旋转主轴';rotor.add(shaft);
  cyl(shaft,.123,3.03,[0,2.94,0],mat.steel);
  for(const y of [lip-.13,lip+.65])cyl(shaft,.185,.11,[0,y,0],mat.dark);
  const impeller=new THREE.Group();impeller.position.y=1.32;impeller.name='旋转叶轮';rotor.add(impeller);
  cyl(impeller,.49,.39,[0,0,0],mat.edge,undefined,.30);
  cyl(impeller,.49,.055,[0,.19,0],mat.steel);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;box(impeller,[.23,.25,.045],[Math.cos(a)*.40,-.06,Math.sin(a)*.40],mat.brass,[0,-a,0]);}
  const stator=new THREE.Group();stator.name='固定定子';stator.userData.stationary=true;rotor.add(stator);
  const lowerX=L/2-550*mm, lowerY=floor+400*mm;
  for(const x of [-lowerX,lowerX]){
    for(const z of [-.30,.30])box(stator,[.085,.19,.12],[x,lowerY+.095,z],mat.steel);
    box(stator,[.17,.075,.75],[x,lowerY+.20,0],mat.dark);
  }
  for(const z of [-.30,.30])box(stator,[2*lowerX+.08,.07,.07],[0,lowerY+.235,z],mat.dark);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;box(stator,[.084,.60,.105],[Math.cos(a)*.65,1.34,Math.sin(a)*.65],mat.steel,[0,-a,0]);
  }
  ring(stator,.65,.033,[0,1.06,0],mat.dark);ring(stator,.65,.033,[0,1.64,0],mat.dark);
  const circulation=wetOverlay(rotor,'叶轮泵送与矿浆循环');layers.push(circulation);
  for(const side of [-1,1]){
    const circulationPoints=[[side*.48,1.31,.38],[side*1.12,1.3,.45],[side*1.58,1.57,.48],[side*1.58,2.13,.45],[side*.85,2.34,.3],[side*.36,1.87,.25]];
    flows.push(wetFlow(circulation,circulationPoints,{name:`矿浆循环 ${side<0?'左':'右'}`,color:0x57b7a7,count:13,speed:.12,size:.043,arrows:4,closed:true,step:0}));
  }

  const drive=part(group,parts,'flotation-drive','槽顶横梁与带槽轮','按正视图还原跨槽横梁、中心轴线和上部轮缘的槽形轮廓。轮高、槽形和支承截面按轮廓示意，未给出的电机位置与皮带路线不作推定。',[0,4.15,0],[0,1.85,0]);
  for(const z of [-.27,.27]){
    box(drive,[L,.19,.05],[0,lip-.075,z],mat.edge);
    for(const y of [lip-.18,lip+.025])box(drive,[L,.025,.155],[0,y,z],mat.dark);
  }
  for(const x of [-L/2+.065,L/2-.065])box(drive,[.13,.07,.70],[x,lip-.18,0],mat.steel);
  cyl(drive,.20,.59,[0,lip+.31,0],mat.edge);
  cyl(drive,.28,.075,[0,lip+.059,0],mat.dark);
  // Top grooved wheel outline and hub on one shaft; no assumed belt drive model.
  const profileWheel=[[.13,-.22],[.94,-.22],[.94,-.18],[.84,-.145],[.84,-.115],[.94,-.08],[.94,-.045],[.84,-.012],[.84,.012],[.94,.045],[.94,.08],[.84,.115],[.84,.145],[.94,.18],[.94,.22],[.13,.22],[.13,-.22]];
  const wheel = new THREE.Group();wheel.name='上部带槽轮';wheel.position.y=lip+.85;drive.add(wheel);
  mesh(wheel,new THREE.LatheGeometry(profileWheel.map(([x,y])=>new THREE.Vector2(x,y)),72),mat.dark);
  cyl(wheel,.217,.54,[0,0,0],mat.steel);
  box(wheel,[.065,.025,.13],[.163,.276,0],mat.brass);

  const air=part(group,parts,'flotation-air','充气与携矿气泡（示意）','气管路线为运行示意。空气从管路进入叶轮附近并被分散。部分经药剂调理的疏水矿粒附着于气泡表面，上升进入泡沫；金色小点是携矿示意，不是可见金粒或回收率统计。',[-.85,2.03,.65],[-3.1,0,.7]);
  const airPoints=[[-3.1,3.23,-.7],[-1.38,3.23,-.7],[-.35,3.18,-.35],[-.24,2.18,-.12],[-.23,1.28,0]];
  wetPipe(air,airPoints,.085,mat.brass,.025);wetFlange(air,[-2.6,3.23,-.7],.15,'x');
  const bubblesLayer=wetOverlay(air,'气泡上升与矿粒附着');layers.push(bubblesLayer);
  flows.push(wetFlow(bubblesLayer,airPoints,{name:'充气方向',color:0xd8e9e6,count:10,speed:.13,size:.025,arrows:3,step:1}));
  const bubbleMaterial=new THREE.MeshStandardMaterial({color:0xc9ede5,metalness:.12,roughness:.16,transparent:true,opacity:.58,depthWrite:false});
  const mineralMaterial=new THREE.MeshStandardMaterial({color:0xe5b963,metalness:.24,roughness:.55,emissive:0x69501f,emissiveIntensity:.3,transparent:true,opacity:1});
  const bubbles=wetVisual(new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,7),bubbleMaterial,66));bubbles.name='上升气泡';bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bubblesLayer.add(bubbles);
  const attached=wetVisual(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mineralMaterial,44));attached.name='附着在气泡上的疏水矿粒';attached.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bubblesLayer.add(attached);
  const bubbleBounds=[new THREE.Vector3(-1.8,1.1,-1.8),new THREE.Vector3(1.8,3.14,1.8)];wetBounds(bubbles,bubbleBounds,.08);wetBounds(attached,bubbleBounds,.08);
  const bubbleDummy=new THREE.Object3D();
  function updateBubbles(time){
    let mineral=0;
    for(let i=0;i<66;i++){
      const phase=((time*.105+i/66)%1+1)%1,a=i*2.39996323+.1*Math.sin(phase*6+i),r=(.42+(i%9)/9*.88)*(.72+phase*.3),s=.041+(i%4)*.013;
      const x=Math.cos(a)*r,z=Math.sin(a)*r,y=1.37+phase*1.59;
      bubbleDummy.position.set(x,y,z);bubbleDummy.quaternion.identity();bubbleDummy.scale.setScalar(s*(.8+phase*.35));bubbleDummy.updateMatrix();bubbles.setMatrixAt(i,bubbleDummy.matrix);
      // Two out of three illustrated bubbles carry a small cluster; this is not a yield ratio.
      if(i%3!==0){bubbleDummy.position.set(x+s*.6,y-s*.58,z+s*.3);bubbleDummy.scale.set(.023,.018,.02);bubbleDummy.updateMatrix();attached.setMatrixAt(mineral++,bubbleDummy.matrix);}
    }
    bubbles.instanceMatrix.needsUpdate=true;attached.instanceMatrix.needsUpdate=true;
  }

  const froth=part(group,parts,'flotation-froth','泡沫层与精矿溜槽（示意）','携矿泡沫汇集后越过槽沿。图纸未标液位与精矿口；泡沫厚度、溜槽位置和越堰轨迹为工艺示意。',[1.85,3.08,.5],[0,1.35,-2.8]);
  const surfaceMaterial=new THREE.MeshStandardMaterial({color:0x9b9b7d,metalness:.06,roughness:.88});
  for(const sign of [-1,1])box(froth,[L-.09,.035,R-.045],[0,lip-.16,sign*(R-.045)/2],surfaceMaterial,undefined,sign>0);
  const frontFoam=new THREE.Group();frontFoam.userData.cutaway=true;froth.add(frontFoam);
  const backFoam=new THREE.Group();froth.add(backFoam);
  for(const[holder,sign]of [[backFoam,-1],[frontFoam,1]]){
    const foam=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),mat.pale,60),d=new THREE.Object3D();
    for(let i=0;i<60;i++){
      const x=((i%10+.5+(i%3-1)*.17)/10-.5)*(L-.22), z=(Math.floor(i/10)+.55+(i%4-1.5)*.12)/6*(R-.12);
      const s=.12+(i%4)*.018;d.position.set(x,lip-.14+i%3*.015,z*sign);d.scale.set(s,s*.49,s);d.updateMatrix();foam.setMatrixAt(i,d.matrix);
    }
    foam.computeBoundingBox();foam.computeBoundingSphere();foam.castShadow=true;holder.add(foam);
  }
  // A single side launder matches the straight tank edge rather than an
  // annular launder left over from the former generic circular cell.
  const launder=new THREE.Group();launder.name='原理示意：直边泡沫槽';froth.add(launder);
  box(launder,[.30,.055,W-.10],[L/2+.155,lip-.30,0],mat.edge);
  box(launder,[.043,.31,W-.10],[L/2+.29,lip-.17,0],mat.teal);
  for(const z of [-1,1])box(launder,[.30,.31,.047],[L/2+.155,lip-.17,z*(W/2-.055)],mat.teal);
  const concentratePoints=[[L/2+.15,lip-.30,0],[2.65,2.58,0],[3,2.12,0],[3.8,2.06,0]];
  wetPipe(froth,concentratePoints,.16,mat.teal);wetFlange(froth,[3.8,2.06,0],.25,'x');
  const frothLayer=wetOverlay(froth,'泡沫越堰与精矿排出');layers.push(frothLayer);
  flows.push(wetFlow(frothLayer,[[.5,lip-.09,.6],[1.2,lip-.04,.48],[L/2+.005,lip+.04,.2],[L/2+.16,lip-.06,0],...concentratePoints],{name:'携矿泡沫 → 精矿溜槽',color:0xf1c77c,count:16,speed:.075,size:.061,arrows:4,step:2}));

  const feeds=part(group,parts,'flotation-pulp','给矿与矿浆出口（示意）','管口位置未见图纸标注。给矿管把调理后的矿浆送入槽内。未被该槽泡沫回收的矿浆从低位出口排出；进入下一次浮选或尾矿处理由所属工艺节点决定，不能把每个槽的排浆都视作最终尾矿。',[-2.5,1.05,.4],[0,0,-4.3]);
  const feedPoints=[[-3.9,1.52,0],[-2.85,1.52,0],[-2.28,1.52,0],[-1.05,1.46,0]];
  wetPipe(feeds,feedPoints,.22,mat.teal);wetFlange(feeds,[-3.65,1.52,0],.34,'x');
  const tailPoints=[[1.3,.91,-.75],[2.65,.91,-.75],[2.65,1.44,-.75],[3.7,1.44,-.75]];
  wetPipe(feeds,tailPoints,.21,mat.teal);wetFlange(feeds,[3.7,1.44,-.75],.33,'x');
  cyl(feeds,.32,.42,[2.65,1.16,-.75],mat.dark,undefined,.32,true);
  beam(feeds,[2.65,1.37,-.75],[2.65,2,-.75],.045,mat.steel);ring(feeds,.22,.024,[2.65,2.03,-.75],mat.brass);
  const pulp=wetOverlay(feeds,'给矿与未回收矿浆');layers.push(pulp);
  flows.push(wetFlow(pulp,feedPoints,{name:'矿浆给入',color:0x57b7a7,count:9,speed:.12,size:.05,arrows:2,step:0}));
  flows.push(wetFlow(pulp,tailPoints,{name:'槽底矿浆 → 后续作业',color:0x93b9ae,count:12,speed:.1,size:.047,arrows:3,step:2}));
  const modes=wetModes(group,layers,flows,index=>{const active=index<0||index===1;bubbleMaterial.opacity=active?.58:.14;mineralMaterial.opacity=active?1:.22;});
  function update(delta,time){const clock=Number.isFinite(time)?time:0;impeller.rotation.y=-clock*1.25;shaft.rotation.y=wheel.rotation.y=-clock*1.25;flows.forEach(flow=>flow.update(clock));updateBubbles(clock);}
  const applyMode=modes.setViewMode;
  const processOnly=[air,froth,feeds].map(root=>{
    const wrapper=new THREE.Group();wrapper.name='原理补充，图中未定型';
    wrapper.add(...root.children.slice());root.add(wrapper);return wrapper;
  });
  modes.setViewMode=(view)=>{applyMode(view);for(const o of processOnly)o.visible=view!=='solid';};
  update(0,0);modes.setViewMode('solid');
  const operationGuide={
    title:'从矿浆到含矿泡沫',summary:'青绿表示矿浆循环，浅色气泡携金色矿粒上升，米金色表示含矿泡沫越堰进入精矿溜槽。',
    steps:[
      {label:'搅拌与循环',description:'叶轮与主轴旋转，定子固定。矿浆在叶轮泵送作用下循环并接触分散的空气。',partId:'flotation-rotor',color:'#57b7a7'},
      {label:'气泡携矿上升',description:'部分疏水矿粒附着在气泡上并上浮；金色小点表示矿粒，不代表肉眼可见金粒。',partId:'flotation-air',color:'#d1e8df'},
      {label:'泡沫与矿浆分流',description:'含矿泡沫越堰进入精矿溜槽；未被本槽回收的矿浆由低位出口进入后续作业。',partId:'flotation-froth',color:'#f1c77c'},
    ],sources:[{title:'Metso · 浮选转子与定子结构',url:'https://www.metso.com/insights/blog/mining-and-metals/regular-maintenance-inspections-help-achieve-optimal-metallurgical-performance-in-flotation-machines/'},{title:'Metso · RCS 浮选与气泡矿粒接触',url:'https://www.metso.com/portfolio/rcs-series/'},{title:'Metso · 泡沫输送与溜槽回收',url:'https://www.metso.com/portfolio/flotation-upgrades/'}],
  };
  return {group,parts,...modes,operationGuide,update};
}

export { createThickener } from './thickener.js';

export { createFilter } from './filter-press.js';
