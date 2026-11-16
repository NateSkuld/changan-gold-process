import * as THREE from 'three';

// Visible envelopes follow the three user photographs dated 2026-10-21.
// Hidden mechanisms and all dimensions remain teaching schematics, not surveyed CAD.
const UP = new THREE.Vector3(0, 1, 0);
const V = a => new THREE.Vector3(...a);
let fieldTextures;

// Small deterministic textures vary dust and roughness without a canvas,
// network request or photographic decal. They are shared by every factory.
function surfaceTextures() {
  if (fieldTextures) return fieldTextures;
  const size = 128, color = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  let seed = 173;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = seed / 4294967295, cloud = (Math.sin(x * .12) + Math.cos(y * .087) + Math.sin((x + y) * .043)) / 3;
    const i = (y * size + x) * 4, shade = Math.round(236 + cloud * 7 + n * 11);
    color.set([shade, Math.max(0, shade - 2), Math.max(0, shade - 5), 255], i);
    const grain = Math.round(226 + n * 22 + cloud * 6); rough.set([grain, grain, grain, 255], i);
  }
  const texture = data => { const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  const albedo = texture(color), grain = texture(rough); albedo.colorSpace = THREE.SRGBColorSpace;
  const wireData = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) wireData.set([128, 139, 137, x < 2 || y < 2 ? 255 : 0], (y * 32 + x) * 4);
  const wire = new THREE.DataTexture(wireData, 32, 32, THREE.RGBAFormat); wire.wrapS = wire.wrapT = THREE.RepeatWrapping; wire.repeat.set(64, 5); wire.magFilter = THREE.LinearFilter; wire.needsUpdate = true; wire.colorSpace = THREE.SRGBColorSpace;
  fieldTextures = { albedo, grain, wire }; return fieldTextures;
}

function toolkit() {
  const textures = surfaceTextures();
  const paint = (color, roughness = .64, metalness = .36) => new THREE.MeshStandardMaterial({ color, roughness, metalness, map: textures.albedo, roughnessMap: textures.grain, bumpMap: textures.grain, bumpScale: .008, side: THREE.DoubleSide });
  const m = {
    orange: paint(0xb94d12), orangeEdge: paint(0xd77126, .48, .46), orangeDark: paint(0x843c20, .73, .25),
    blue: paint(0x167d9f, .59), blueEdge: paint(0x398ba5, .46, .48), blueDark: paint(0x15526a, .69),
    dark: paint(0x283033, .74, .27), steel: paint(0x919b97, .43, .76), steelDark: paint(0x4b5658, .58, .66),
    bolt: paint(0xb7bcb6, .34, .83), rubber: paint(0x19201f, .94, .02), ore: paint(0x837565, .96, .04),
    brass: paint(0xb09a71, .47, .66), yellow: paint(0xd5b43a, .68, .18),
    support: paint(0x6e4549, .76, .29), dust: paint(0x797061, .91, .08),
    wire: new THREE.MeshStandardMaterial({ color: 0x6c7975, map: textures.wire, alphaTest: .45, roughness: .77, metalness: .35, side: THREE.DoubleSide }),
  };
  const cache = new Map();
  const geometry = (key, build) => { if (!cache.has(key)) cache.set(key, build()); return cache.get(key); };
  function mesh(root, geo, material, p = [0, 0, 0], cut = false) {
    const o = new THREE.Mesh(geo, material); o.position.set(...p); o.castShadow = true; o.receiveShadow = true;
    if (cut) o.userData.cutaway = true;
    root.add(o); return o;
  }
  const box = (root, size, p, material, cut = false) => { const o = mesh(root, geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1)), material, p, cut); o.scale.set(...size); return o; };
  function cyl(root, radius, length, p, material, axis = 'y', cut = false, segments = 32) {
    const o = mesh(root, geometry(`unit-cylinder:${segments}`, () => new THREE.CylinderGeometry(1, 1, 1, segments)), material, p, cut); o.scale.set(radius, length, radius);
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    return o;
  }
  function ring(root, radius, tube, p, material, axis = 'z', cut = false) {
    const o = mesh(root, geometry(`r:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 64)), material, p, cut);
    if (axis === 'y') o.rotation.x = Math.PI / 2;
    if (axis === 'x') o.rotation.y = Math.PI / 2;
    return o;
  }
  function beam(root, a, b, width, material, cut = false) {
    const start = V(a), end = V(b), delta = end.clone().sub(start);
    const o = box(root, [width, delta.length(), width], start.add(end).multiplyScalar(.5).toArray(), material, cut);
    o.quaternion.setFromUnitVectors(UP, delta.normalize()); return o;
  }
  function quad(root, points, material, cut = false) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); return mesh(root, geo, material, [0, 0, 0], cut);
  }
  function plate(root, points, depth, z, material, cut = false) {
    const shape = new THREE.Shape(); shape.moveTo(...points[0]); points.slice(1).forEach(p => shape.lineTo(...p)); shape.closePath();
    const geo = geometry(`plate:${JSON.stringify(points)}:${depth}`, () => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .018, bevelThickness: .018, curveSegments: 1 }));
    return mesh(root, geo, material, [0, 0, z - depth / 2], cut);
  }
  function boltRow(root, points, axis = 'z', cut = false) { for (const p of points) cyl(root, .035, .065, p, m.bolt, axis, cut, 6); }
  function foot(root, x, z, height, color = m.steelDark) {
    box(root, [.52, .12, .5], [x, .07, z], m.dark);
    box(root, [.17, height, .17], [x, .13 + height / 2, z], color);
    for (const dx of [-.16, .16]) for (const dz of [-.15, .15]) cyl(root, .032, .07, [x + dx, .16, z + dz], m.bolt, 'y', false, 6);
  }
  function funnel(root, top, bottom, yTop, yBottom, material, cutFront = false, xTop = 0, xBottom = 0) {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      quad(root, [[xTop + a[0] * top[0] / 2, yTop, a[1] * top[1] / 2], [xTop + b[0] * top[0] / 2, yTop, b[1] * top[1] / 2], [xBottom + b[0] * bottom[0] / 2, yBottom, b[1] * bottom[1] / 2], [xBottom + a[0] * bottom[0] / 2, yBottom, a[1] * bottom[1] / 2]], material, cutFront && i === 2);
    }
  }
  function ductX(root, x0, x1, y0, y1, width, height, material, cutFront = false) {
    for (const z of [-width / 2, width / 2]) quad(root, [[x0, y0 - height / 2, z], [x0, y0 + height / 2, z], [x1, y1 + height / 2, z], [x1, y1 - height / 2, z]], material, cutFront && z > 0);
    for (const side of [-1, 1]) quad(root, [[x0, y0 + side * height / 2, -width / 2], [x0, y0 + side * height / 2, width / 2], [x1, y1 + side * height / 2, width / 2], [x1, y1 + side * height / 2, -width / 2]], material, cutFront && side > 0);
  }
  function motor(root, center, radius = .32, length = .8, color = m.dark) {
    const g = new THREE.Group(); g.position.set(...center); root.add(g);
    cyl(g, radius, length, [0, 0, 0], color, 'z');
    for (let i = 0; i < 9; i++) cyl(g, radius * 1.08, .027, [0, 0, -length * .37 + i * length * .0925], m.steelDark, 'z');
    cyl(g, radius * 1.04, .12, [0, 0, -length / 2 - .04], color, 'z');
    cyl(g, radius * .26, .27, [0, 0, length / 2 + .09], m.steel, 'z');
    box(g, [radius * .9, radius * .55, length * .43], [0, radius * 1.04, -.05], color);
    for (const x of [-radius * .68, radius * .68]) box(g, [.13, .16, length * .9], [x, -radius - .05, 0], m.steelDark);
    return g;
  }
  function grille(root, width, height, center, cut = false) {
    box(root, [width, height, .035], center, m.dark, cut);
    for (let i = 0; i <= 9; i++) box(root, [.012, height - .025, .015], [center[0] - width * .45 + i * width * .09, center[1], center[2] + .023], m.steelDark, cut);
    for (let i = 0; i <= 8; i++) box(root, [width - .025, .012, .015], [center[0], center[1] - height * .43 + i * height * .1075, center[2] + .025], m.steelDark, cut);
  }
  function handle(root, center, width, cut = false) {
    for (const x of [-width / 2, width / 2]) box(root, [.035, .065, .09], [center[0] + x, center[1], center[2]], m.dark, cut);
    box(root, [width + .035, .034, .035], [center[0], center[1], center[2] + .055], m.steel, cut);
  }
  function pipe(root, points, radius, material, cut = false) { return mesh(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)), points.length * 6, radius, 12, false), material, [0, 0, 0], cut); }
  return { m, mesh, box, cyl, ring, beam, quad, plate, boltRow, foot, funnel, ductX, motor, geometry, grille, handle, pipe };
}

function part(group, parts, id, name, description, anchor, explode) {
  const root = new THREE.Group(); root.name = name; root.userData.partId = id; group.add(root);
  parts.push({ id, name, description, root, anchor: V(anchor), explode: V(explode) }); return root;
}

// Keep animation subgroups and selectable roots intact; instance only static siblings.
function compact(root) {
  const buckets = new Map();
  for (const child of [...root.children]) {
    if (child.isGroup) compact(child);
    if (!child.isMesh || child.isInstancedMesh || child.userData.animated) continue;
    const key = `${child.geometry.uuid}:${child.material.uuid}:${!!child.userData.cutaway}`;
    if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(child);
  }
  for (const siblings of buckets.values()) {
    if (siblings.length < 2) continue;
    const first = siblings[0], batch = new THREE.InstancedMesh(first.geometry, first.material, siblings.length);
    batch.castShadow = true; batch.receiveShadow = true; batch.userData = { ...first.userData };
    siblings.forEach((o, i) => { o.updateMatrix(); batch.setMatrixAt(i, o.matrix); root.remove(o); });
    batch.computeBoundingBox(); batch.computeBoundingSphere(); root.add(batch);
  }
}

function interfaceFor(group, parts, animate, explosionSteps = []) {
  parts.forEach(p => compact(p.root));
  group.userData.partIds = parts.map(p => p.id);
  let elapsed = 0;
  return {
    group, parts, explosionSteps,
    setViewMode(mode) { group.traverse(o => { if (o.userData.cutaway) o.visible = mode !== 'cutaway'; }); },
    update(delta, time) {
      elapsed = Number.isFinite(time) ? time : elapsed + Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .08));
      animate?.(elapsed);
    },
  };
}

export function createSiteJawCrusher() {
  const group = new THREE.Group(), parts = [];
  group.name = '现场橙色颚式破碎机 · 外观与通用剖视';
  group.userData.evidence = '外观参照 IMG_7481、IMG_7482；内部机构与尺寸为教学示意，未确认现场厂家及型号。';
  const { m, mesh, box, cyl, ring, beam, plate, boltRow, foot, funnel, ductX, motor, grille, handle } = toolkit();

  const frame = part(group, parts, 'crusher-frame', '橙色机架与钢制基础', '橙色机架、侧护板及下方钢制支承来自现场照片。剖视移去前侧板以显示通用破碎腔；支承高度、板厚和内部结构尚未实测。', [0, 2.45, 1.45], [0, 0, -4.2]);
  for (const x of [-1.55, 1.55]) for (const z of [-1.18, 1.18]) foot(frame, x, z, 1.08);
  for (const z of [-1.18, 1.18]) box(frame, [3.75, .2, .18], [0, 1.22, z], m.steelDark);
  for (const x of [-1.65, 1.65]) box(frame, [.2, .2, 2.68], [x, 1.22, 0], m.steelDark);
  beam(frame, [-1.55, .28, -1.18], [1.55, 1.13, -1.18], .1, m.steelDark);
  beam(frame, [1.55, .28, -1.18], [-1.55, 1.13, -1.18], .1, m.steelDark);
  for (const x of [-1.55, 1.55]) beam(frame, [x, .26, -1.18], [x, 1.1, 1.18], .08, m.steelDark);
  const sideProfile = [[-1.56, 1.4], [-1.83, 3.48], [-1.68, 3.65], [1.5, 3.65], [1.76, 1.4]];
  for (const z of [-1.23, 1.23]) {
    const cut = z > 0;
    plate(frame, sideProfile, .14, z, m.orange, cut);
    for (const x of [-1.38, -.55, .4, 1.35]) {
      box(frame, [.095, 1.94, .09], [x, 2.46, z + Math.sign(z) * .13], m.orangeEdge, cut);
      boltRow(frame, [1.56, 2.07, 2.68, 3.36].map(y => [x, y, z + Math.sign(z) * .205]), 'z', cut);
    }
    for (const y of [1.48, 3.56]) box(frame, [3.58, .13, .16], [-.03, y, z], m.orangeEdge, cut);
  }
  for (const x of [-1.72, 1.62]) box(frame, [.2, .24, 2.56], [x, 3.51, 0], m.orangeDark);
  // Framed service hatch and separate cast-to-fabricated interfaces make the
  // enclosure read as a maintained machine, rather than one smooth orange box.
  box(frame, [1.12, .72, .065], [-.91, 2.14, 1.43], m.orangeDark, true);
  box(frame, [.98, .58, .075], [-.91, 2.14, 1.47], m.orange, true);
  for (const y of [1.94, 2.34]) box(frame, [.085, .12, .09], [-1.45, y, 1.51], m.steelDark, true);
  handle(frame, [-.55, 2.15, 1.54], .16, true);
  boltRow(frame, [[-1.34, 1.9, 1.54], [-1.34, 2.4, 1.54], [-.49, 1.9, 1.54], [-.49, 2.4, 1.54]], 'z', true);
  for (const x of [-1.54, 1.52]) {
    box(frame, [.27, .48, 2.55], [x, 1.59, 0], m.orangeDark);
    for (const z of [-1.29, 1.29]) cyl(frame, .085, .08, [x, 1.71, z], m.steel, 'z', z > 0, 6);
  }
  box(frame, [3.34, .025, .17], [-.03, 3.62, 1.18], m.dust, true);
  funnel(frame, [1.78, 2.08], [.92, 1.48], 1.61, .62, m.dark, true, 0, .2);
  for (const z of [-.78, .78]) box(frame, [1.16, .1, .1], [.2, .63, z], m.steelDark);

  const feed = part(group, parts, 'crusher-hopper', '上部黑色给料溜槽', '现场照片显示黑色给料溜槽与橙色机架相接。此处保留其导料外形；内部矿块和下落路径用于说明给料，不代表现场粒度或处理量。', [-.45, 4.48, .62], [0, 3.6, 0]);
  funnel(feed, [3.22, 2.51], [2.52, 2.18], 4.73, 3.58, m.dark, true, -.38, -.09);
  for (const z of [-1.26, 1.26]) {
    box(feed, [3.43, .13, .13], [-.38, 4.74, z], m.steelDark, z > 0);
    for (const x of [-1.48, -.42, .68]) beam(feed, [x, 4.67, z], [x + .25, 3.65, z * .88], .075, m.steelDark, z > 0);
  }
  for (const x of [-2.03, 1.28]) box(feed, [.13, .13, 2.58], [x, 4.74, 0], m.steelDark);
  // The sloping black inlet and bolted panel seams are visible site cues.
  // Its upstream endpoint is deliberately left unattached.
  ductX(feed, -3.06, -1.03, 5.21, 4.32, 2.2, .67, m.dark, true);
  for (const z of [-1.13, 1.13]) {
    beam(feed, [-3.07, 5.56, z], [-1.05, 4.67, z], .075, m.steelDark, z > 0);
    beam(feed, [-3.07, 4.87, z], [-1.05, 3.98, z], .09, m.steelDark, z > 0);
    for (const f of [.1, .58, .94]) {
      const x = -3.06 + 2.03 * f, y = 5.21 - .89 * f;
      box(feed, [.07, .75, .07], [x, y, z], m.steelDark, z > 0);
      boltRow(feed, [[x, y - .25, z + Math.sign(z) * .04], [x, y + .25, z + Math.sign(z) * .04]], 'z', z > 0);
    }
  }
  const inletHatch = box(feed, [.73, .36, .035], [-2.35, 4.93, 1.13], m.steelDark, true); inletHatch.rotation.z = -.41;
  handle(feed, [-2.37, 4.94, 1.2], .2, true);
  for (let i = 0; i < 8; i++) {
    const rock = mesh(feed, new THREE.DodecahedronGeometry(.11 + (i % 3) * .035, 0), m.ore, [-.8 + (i % 4) * .38, 3.76 + Math.floor(i / 4) * .28, ((i % 3) - 1) * .44]);
    rock.rotation.set(i * .42, i * .71, i * .25);
  }

  const fixed = part(group, parts, 'crusher-fixed-jaw', '定颚与耐磨齿板', '照片未展示内部颚板。本部件沿用颚式破碎机的通用原理：定颚与动颚形成上宽下窄的破碎腔，耐磨齿板接触矿石。', [-.85, 2.7, .33], [-3.1, .4, 0]);
  const fixedPlate = new THREE.Group(); fixedPlate.position.set(-.91, 2.47, 0); fixedPlate.rotation.z = .2; fixed.add(fixedPlate);
  box(fixedPlate, [.31, 2.05, 2.13], [0, 0, 0], m.steelDark);
  for (let i = 0; i < 12; i++) box(fixedPlate, [.12, 1.97, .095], [.2, 0, -.99 + i * .18], m.steel);
  for (const y of [-.84, .84]) boltRow(fixedPlate, [-.8, -.4, 0, .4, .8].map(z => [-.18, y, z]), 'x');

  const moving = part(group, parts, 'crusher-moving-jaw', '动颚、肘板与拉杆', '动颚摆动、肘板支承和拉杆布置为通用教学结构，需由现场总装图校准。摆动令破碎腔周期性缩小，矿石受压后由下方排出。', [.62, 2.57, .3], [3.9, .4, 0]);
  const jawPivot = new THREE.Group(); jawPivot.position.set(.84, 3.23, 0); moving.add(jawPivot);
  box(jawPivot, [.38, 1.78, 2.08], [0, -.78, 0], m.dark);
  for (let i = 0; i < 12; i++) box(jawPivot, [.12, 1.73, .095], [-.24, -.78, -.99 + i * .18], m.steel);
  for (const z of [-.83, .83]) {
    beam(moving, [.52, 1.56, z], [1.58, 1.83, z], .13, m.steelDark);
    cyl(moving, .09, 1.47, [1.12, 1.42, z], m.steel, 'x');
    for (let i = 0; i < 7; i++) cyl(moving, .135, .045, [1.48 + i * .055, 1.42, z], m.steelDark, 'x');
  }

  const eccentric = part(group, parts, 'crusher-eccentric', '大圆护罩、飞轮与偏心轴', '大圆橙色侧传动护罩是照片可见特征。剖视移去护罩，露出通用飞轮和偏心轴示意；飞轮直径、偏心量与内部构造尚未核验。', [.84, 3.63, 1.83], [0, .4, 4.4]);
  cyl(eccentric, .155, 3.6, [.84, 3.23, 0], m.steel, 'z');
  const wheels = [];
  for (const z of [-1.54, 1.54]) {
    const wheel = new THREE.Group(); wheel.position.set(.84, 3.23, z); eccentric.add(wheel); wheels.push(wheel);
    ring(wheel, .86, .12, [0, 0, 0], m.steelDark);
    ring(wheel, .91, .026, [0, 0, .105], m.steel);
    cyl(wheel, .22, .3, [0, 0, 0], m.steel, 'z');
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3; beam(wheel, [Math.cos(a) * .18, Math.sin(a) * .18, 0], [Math.cos(a) * .8, Math.sin(a) * .8, 0], .095, m.orangeDark);
    }
  }
  cyl(eccentric, 1.09, .44, [.84, 3.23, 1.9], m.orange, 'z', true, 64);
  ring(eccentric, 1.075, .036, [.84, 3.23, 2.126], m.orangeEdge, 'z', true);
  ring(eccentric, 1.075, .025, [.84, 3.23, 1.69], m.orangeDark, 'z', true);
  grille(eccentric, .37, .43, [.84, 2.95, 2.144], true);
  box(eccentric, [.42, .11, .025], [.84, 2.62, 2.145], m.yellow, true);
  // The narrow label plate is intentionally blank; no manufacturer is inferred.
  boltRow(eccentric, Array.from({ length: 10 }, (_, i) => [.84 + Math.cos(i * Math.PI / 5) * 1.015, 3.23 + Math.sin(i * Math.PI / 5) * 1.015, 2.15]), 'z', true);
  for (const x of [.2, 1.48]) box(eccentric, [.11, .23, .16], [x, 2.35, 1.77], m.orangeDark, true);
  for (const z of [-1.31, 1.31]) {
    box(eccentric, [.67, .18, .38], [.84, 3.02, z], m.orangeDark);
    cyl(eccentric, .26, .26, [.84, 3.23, z], m.orangeEdge, 'z');
  }

  const drive = part(group, parts, 'crusher-drive', '侧置电机与带传动', '电机和传动按通用结构补充，照片中的护罩限制了内部识别。示意带传动驱动飞轮与偏心轴；实际电机规格、带轮比及检修布置待确认。', [2.72, 1.25, 1.1], [4, 0, 4.8]);
  box(drive, [1.54, .18, 1.47], [2.69, .52, .75], m.steelDark);
  for (const x of [2.13, 3.26]) foot(drive, x, .75, .35);
  motor(drive, [2.69, 1.03, .62], .35, 1.05);
  cyl(drive, .29, .16, [2.69, 1.03, 1.38], m.steelDark, 'z');
  for (const z of [1.39, 1.47]) {
    beam(drive, [2.88, 1.24, z], [1.51, 3.88, z], .039, m.rubber);
    beam(drive, [2.45, .86, z], [.1, 2.73, z], .039, m.rubber);
  }
  plate(drive, [[2.33, .72], [3.03, 1.07], [1.57, 3.91], [.16, 2.55]], .06, 1.57, m.orangeDark, true);
  grille(drive, .46, .4, [2.55, 1.22, 1.62], true);
  for (const x of [2.13, 3.26]) box(drive, [.44, .075, 1.22], [x, .67, .75], m.orangeDark);
  const model = interfaceFor(group, parts, time => {
    jawPivot.rotation.z = -.22 + Math.sin(time * 3.6) * .035;
    wheels.forEach(w => { w.rotation.z = -time * 1.8; });
  }, [
    { title: '移开外部总成', description: '完整机架向后、给料溜槽向上分开，露出内部工作区。', parts: ['crusher-frame', 'crusher-hopper'] },
    { title: '展开两侧颚板', description: '定颚与动颚向左右分开，展示上宽下窄破碎腔的示意配合。', parts: ['crusher-fixed-jaw', 'crusher-moving-jaw'] },
    { title: '分离偏心传动', description: '护罩、飞轮与偏心轴总成前移，展示与动颚连接的示意位置。', parts: ['crusher-eccentric'] },
    { title: '展开电机驱动', description: '电机与带传动移向外侧，展示动力传入飞轮的位置。', parts: ['crusher-drive'] },
  ]);
  model.update(0, 0); return model;
}

export function createSiteScreen() {
  const group = new THREE.Group(), parts = [];
  group.name = '现场蓝色封闭振动筛 · 外观与双层筛分示意';
  group.userData.evidence = '蓝色筛箱与外部钢架参照 IMG_7483；内部双层筛网、激振机构及全部尺寸为通用示意，厂家型号未推断。';
  const { m, mesh, box, cyl, ring, beam, plate, boltRow, foot, ductX, motor, handle, pipe } = toolkit();
  const body = part(group, parts, 'body', '蓝色封闭筛箱与支架', '根据现场照片表现蓝色长筛箱、倾斜外轮廓、加强筋及钢制支架。前侧盖和上盖可移除；安装角度与尺寸为比例示意。', [0, 3.05, 1.44], [0, .35, -4.7]);
  const inner = part(group, parts, 'inside', '双层筛网与物料分级', '双层筛网是为解释筛分原理而补充的通用结构，照片未展示内部层数。矿粒沿筛面前移，小颗粒穿过筛孔，筛上物从端部排出；孔径及运动幅度均非实测。', [.15, 2.65, .35], [0, 3.35, 0]);
  const service = part(group, parts, 'service', '弹簧、激振与进出料溜槽', '弹性支承、激振组件和进出料通道用于说明筛箱运动与物料去向。外部布置参照可见照片，内部驱动方式及各出口的现场连接仍需核实。', [1.6, 1.65, 1.6], [0, -.05, 5]);
  const angle = -.16, height = 2.52;
  const tilted = root => { const g = new THREE.Group(); root.add(g); g.position.y = height; g.rotation.z = angle; return g; };
  const shell = tilted(body), decks = tilted(inner), fittings = tilted(service);
  const profile = [[-2.85, -.73], [-2.85, .87], [1.88, .87], [3.05, .18], [3.05, -.73]];
  for (const z of [-1.25, 1.25]) {
    const cut = z > 0;
    plate(shell, profile, .12, z, m.blue, cut);
    for (const x of [-2.55, -1.5, -.45, .6, 1.65, 2.65]) {
      const h = x > 2 ? 1.1 : 1.49;
      box(shell, [.085, h, .095], [x, -.71 + h / 2, z + Math.sign(z) * .12], m.blueEdge, cut);
      boltRow(shell, [-.59, -.15, x > 2 ? .25 : .71].map(y => [x, y, z + Math.sign(z) * .195]), 'z', cut);
    }
    box(shell, [5.98, .105, .16], [.08, -.71, z], m.blueDark, cut);
    box(shell, [4.86, .1, .16], [-.45, .88, z], m.blueEdge, cut);
    box(shell, [4.89, .19, .055], [-.45, 1.015, z + Math.sign(z) * .03], m.blue, cut);
    box(shell, [4.89, .035, .09], [-.45, 1.12, z + Math.sign(z) * .025], m.blueEdge, cut);
    for (const x of [-2.03, -.91, .23, 1.38]) {
      // Shallow seams distinguish removable pressed panels from deep ribs.
      box(shell, [.024, 1.38, .016], [x, .02, z + Math.sign(z) * .077], m.blueDark, cut);
      for (const y of [-.61, .68]) box(shell, [.16, .035, .025], [x, y, z + Math.sign(z) * .092], m.steelDark, cut);
    }
    const slope = box(shell, [1.37, .1, .16], [2.46, .535, z], m.blueEdge, cut); slope.rotation.z = -.533;
    box(shell, [1.15, .61, .045], [-.52, .05, z + Math.sign(z) * .16], m.blueDark, cut);
    box(shell, [1.01, .48, .055], [-.52, .05, z + Math.sign(z) * .19], m.blue, cut);
    if (z > 0) {
      handle(shell, [-.52, .08, z + .26], .24, true);
      for (const y of [-.1, .22]) box(shell, [.055, .12, .055], [-1.02, y, z + .25], m.steelDark, true);
      for (const x of [-.92, -.12]) boltRow(shell, [[x, -.16, z + .24], [x, .26, z + .24]], 'z', true);
      handle(shell, [-1.95, .38, z + .15], .24, true);
    }
  }
  for (let i = 0; i < 4; i++) {
    box(shell, [1.16, .095, 2.5], [-2.23 + i * 1.2, .88, 0], m.blue, true);
    box(shell, [.055, .055, 2.56], [-2.82 + i * 1.2, .95, 0], m.blueEdge, true);
  }
  const hood = box(shell, [1.38, .09, 2.5], [2.48, .53, 0], m.blue, true); hood.rotation.z = -.533;
  box(shell, [5.8, .11, 2.43], [.04, -.77, 0], m.blueDark);
  // Taller inlet cheek and capped upper seams follow the photographed outline.
  box(shell, [.12, .84, 2.59], [-2.85, 1.22, 0], m.blue, true);
  box(shell, [.16, .055, 2.65], [-2.85, 1.66, 0], m.blueEdge, true);
  for (const z of [-1.17, 1.17]) box(shell, [.14, .77, .065], [-2.77, 1.25, z], m.blueDark, true);
  for (const x of [-2.82, -1.62, -.42, .78]) {
    for (const z of [-.92, .92]) box(shell, [.13, .035, .065], [x + .12, .955, z], m.steelDark, true);
  }
  cyl(shell, .29, .075, [-.82, .985, -.36], m.steelDark, 'y', true);
  cyl(shell, .215, .28, [-.82, 1.16, -.36], m.rubber, 'y', true);
  for (const y of [1.05, 1.27]) ring(shell, .215, .025, [-.82, y, -.36], m.steel, 'y', true);
  pipe(shell, [[-.82, 1.27, -.36], [-.82, 1.7, -.36], [-.82, 1.91, -.56], [-.82, 1.93, -1.03]], .18, m.steel, true);
  // The external grey connection is a visual reference, not a reconstructed
  // dust-system circuit or a claim about the hidden fan/duct equipment.
  cyl(shell, .215, .045, [-.82, 1.93, -1.02], m.steelDark, 'z', true);
  for (const x of [-.96, -.68]) cyl(shell, .026, .06, [x, 1.03, -.51], m.bolt, 'y', true, 6);

  for (const x of [-2.15, 2.15]) for (const z of [-1.19, 1.19]) {
    const springTop = height + Math.sin(angle) * x + Math.cos(angle) * -.79;
    const bottom = springTop - .47;
    foot(body, x, z, bottom - .13);
    box(service, [.57, .12, .58], [x, bottom, z], m.steelDark);
    box(fittings, [.64, .12, .62], [x, -.78, z], m.blueDark);
    const points = Array.from({ length: 85 }, (_, i) => { const f = i / 84, a = f * Math.PI * 12; return new THREE.Vector3(x + Math.cos(a) * .17, bottom + .04 + f * .37, z + Math.sin(a) * .17); });
    mesh(service, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 100, .033, 5, false), m.steel);
    cyl(service, .2, .045, [x, bottom + .035, z], m.dark);
  }
  for (const z of [-1.19, 1.19]) beam(body, [-2.15, .5, z], [2.15, .85, z], .08, m.steelDark);

  for (const [level, count] of [[.2, 27], [-.32, 36]]) {
    for (const z of [-1.1, 1.1]) box(decks, [5.53, .11, .1], [-.03, level - .04, z], m.steelDark);
    for (let i = 0; i < count; i++) box(decks, [.028, .045, 2.18], [-2.66 + i * 5.3 / (count - 1), level, 0], m.steel);
    for (let i = 0; i < 12; i++) box(decks, [5.33, .035, .024], [-.01, level + .022, -.99 + i * .18], m.steel);
    for (let i = 0; i < 7; i++) box(decks, [.09, .12, 2.23], [-2.5 + i * .82, level - .09, 0], m.blueDark);
  }
  const grainCount = 28, grains = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.08, 0), m.ore, grainCount);
  grains.castShadow = true; grains.frustumCulled = false; grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage); decks.add(grains);
  const dummy = new THREE.Object3D();
  ductX(fittings, -3.78, -2.84, .98, .39, 1.92, .7, m.dark, true);
  ductX(fittings, 2.92, 3.91, .05, -.44, 2.12, .35, m.blueDark, true);
  ductX(fittings, 2.93, 3.55, -.56, -1.08, 1.65, .28, m.dark, true);
  for (const z of [-1.08, 1.08]) beam(fittings, [2.95, .22, z], [3.91, -.27, z], .065, m.blueEdge);
  cyl(fittings, .17, 3.18, [.05, -.1, 0], m.steel, 'z');
  for (const z of [-1.49, 1.49]) {
    cyl(fittings, .38, .25, [.05, -.1, z], m.blueDark, 'z');
    ring(fittings, .33, .04, [.05, -.1, z + Math.sign(z) * .15], m.blueEdge);
    boltRow(fittings, Array.from({ length: 8 }, (_, i) => [.05 + Math.cos(i * Math.PI / 4) * .3, -.1 + Math.sin(i * Math.PI / 4) * .3, z + Math.sign(z) * .19]), 'z');
  }
  motor(fittings, [.05, -.1, -1.98], .28, .64, m.blueDark);
  const exciter = new THREE.Group(); exciter.position.set(.05, -.1, 1.67); fittings.add(exciter);
  cyl(exciter, .23, .11, [0, 0, 0], m.steel, 'z');
  box(exciter, [.26, .13, .13], [.1, .04, .07], m.brass);
  const model = interfaceFor(group, parts, time => {
    const dx = Math.sin(time * 14) * .014, dy = Math.cos(time * 14) * .01;
    for (const g of [shell, decks, fittings]) { g.position.x = dx; g.position.y = height + dy; }
    exciter.rotation.z = time * 4;
    for (let i = 0; i < grainCount; i++) {
      const f = (time * .095 + i / grainCount) % 1, fine = i % 4 === 0;
      const y = fine && f > .47 ? -.24 : .29 + Math.abs(Math.sin(time * 7 + i)) * .025;
      dummy.position.set(-2.58 + f * 5.15, y, Math.sin(i * 3.1) * .89); dummy.rotation.set(i, time * .7 + i, i * .4); dummy.scale.setScalar(fine ? .5 : .7 + (i % 3) * .2); dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
  }, [
    { title: '后移完整筛箱', description: '蓝色外罩连同支架向后移开，露出筛网与激振组件。', parts: ['body'] },
    { title: '提起双层筛网', description: '两层筛网整体上提，展示矿粒逐层分级的示意结构。', parts: ['inside'] },
    { title: '分离激振支承', description: '弹簧、激振器与溜槽向前展开，展示筛箱支承和给排料的示意配合。', parts: ['service'] },
  ]);
  model.update(0, 0); return model;
}

function conveyorPieces(length, roots, kit, animated = false) {
  const { m, mesh, box, cyl, ring, beam, foot, motor, quad, geometry } = kit;
  const { frame, belt, drive } = roots, half = length / 2, y = 1;
  for (const z of [-.76, .76]) {
    box(frame, [length + .46, .19, .13], [0, .79, z], m.orange);
    box(frame, [length + .46, .045, .19], [0, .9, z], m.orangeEdge);
  }
  const stands = Math.max(2, Math.ceil(length / 2.2));
  for (let i = 0; i < stands; i++) {
    const x = -half + .4 + i * (length - .8) / (stands - 1);
    for (const z of [-.77, .77]) foot(frame, x, z, .55, animated ? m.support : m.steelDark);
    box(frame, [.15, .13, animated ? 2.65 : 1.75], [x, .65, animated ? .44 : 0], m.steelDark);
    beam(frame, [x - .2, .2, -.77], [x + .2, .65, .77], .065, animated ? m.support : m.steelDark);
    if (animated && i < stands - 1) {
      const nextX = -half + .4 + (i + 1) * (length - .8) / (stands - 1);
      for (const z of [-.77, .77]) {
        beam(frame, [x, .17, z], [nextX, .61, z], .075, m.support);
        beam(frame, [x, .61, z], [nextX, .17, z], .075, m.support);
      }
    }
  }
  const stations = Math.max(3, Math.ceil(length / .55));
  for (let i = 0; i <= stations; i++) {
    const x = -half + i * length / stations;
    if (animated) {
      cyl(frame, .085, .56, [x, .905, 0], m.steel, 'z', false, 16);
      for (const side of [-1, 1]) {
        const roller = cyl(frame, .082, .46, [x, .982, side * .49], m.steel, 'y', false, 16);
        roller.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, side * .333, .943).normalize());
        box(frame, [.09, .27, .075], [x, .88, side * .72], m.orangeDark);
        box(frame, [.08, .1, .07], [x, .85, side * .27], m.steelDark);
      }
    } else cyl(frame, .085, 1.4, [x, .89, 0], m.steel, 'z', false, 12);
    for (const z of [-.71, .71]) box(frame, [.09, .2, .08], [x, .83, z], m.orangeDark);
  }
  for (const z of [-.31, .31]) {
    // The removable front strip reveals the rollers without removing the
    // entire belt loop. Overview symbols always keep their full belt surface.
    if (!animated) box(belt, [length, .058, .62], [0, y, z], m.rubber);
    else box(belt, [length, .058, .27], [0, y, Math.sign(z) * .135], m.rubber, z > 0);
    box(belt, [length, .047, .62], [0, .53, z], m.rubber, animated && z > 0);
  }
  if (animated) {
    for (const side of [-1, 1]) {
      const wing = box(belt, [length - .85, .052, .46], [0, 1.081, side * .487], m.rubber, side > 0); wing.rotation.x = -side * .34;
      for (const end of [-1, 1]) quad(belt, [[end * half, 1.013, side * .27], [end * half, 1.013, side * .71], [end * (half - .425), 1.161, side * .71], [end * (half - .425), 1.005, side * .27]], m.rubber, side > 0);
    }
    // A single maintenance walkway follows the photographed orange enclosure.
    // It ends before the drive station so the deck does not intersect the motor.
    const walkLength = length - .9, walkCenter = -.45;
    for (const z of [.99, 1.66]) box(frame, [walkLength + .12, .14, .11], [walkCenter, .68, z], m.steelDark, true);
    for (let i = 0; i <= Math.ceil(walkLength / .17); i++) {
      const x = -half + i * walkLength / Math.ceil(walkLength / .17);
      box(frame, [.032, .05, .61], [x, .76, 1.325], m.steelDark, true);
    }
    for (const z of [1.13, 1.49]) box(frame, [walkLength, .035, .026], [walkCenter, .78, z], m.steel, true);
    box(frame, [walkLength + .12, .2, .045], [walkCenter, .83, 1.72], m.orange, true);
    const postCount = Math.max(3, Math.ceil(walkLength / 1.25));
    for (let i = 0; i <= postCount; i++) {
      const x = -half + i * walkLength / postCount;
      box(frame, [.065, .98, .065], [x, 1.23, 1.72], m.orange, true);
      box(frame, [.16, .05, .14], [x, .77, 1.72], m.orangeDark, true);
    }
    box(frame, [walkLength, .055, .055], [walkCenter, 1.25, 1.72], m.orange, true);
    const stripeCount = Math.ceil(walkLength / .31);
    for (let i = 0; i < stripeCount; i++) box(frame, [walkLength / stripeCount, .065, .065], [-half + (i + .5) * walkLength / stripeCount, 1.7, 1.72], i % 2 ? m.dark : m.yellow, true);
    mesh(frame, geometry(`walk-wire:${walkLength}`, () => new THREE.PlaneGeometry(walkLength, .38)), m.wire, [walkCenter, 1.02, 1.7], true);
    // The far side is lower and open enough to keep the belt legible.
    for (let i = 0; i <= postCount; i++) box(frame, [.055, .58, .055], [-half + i * length / postCount, 1.14, -.91], m.orange);
    box(frame, [length + .1, .055, .055], [0, 1.42, -.91], m.orange);
    for (const x of [-half + .18, half - 1.08]) box(frame, [.36, .22, .025], [x, 1.18, 1.76], m.yellow, true);
  }
  for (const x of [-half, half]) {
    cyl(belt, .247, 1.24, [x, .765, 0], m.rubber, 'z');
    cyl(drive, .1, 1.91, [x, .765, 0], m.steel, 'z');
    for (const z of [-.84, .84]) {
      box(drive, [.45, .12, .3], [x, .59, z], m.orangeDark);
      cyl(drive, .16, .2, [x, .765, z], m.orangeEdge, 'z');
      ring(drive, .12, .025, [x, .765, z + Math.sign(z) * .11], m.steel);
    }
  }
  if (animated) {
    motor(drive, [half, .765, 1.26], .23, .56, m.orangeDark);
    box(drive, [.78, .13, .77], [half, .41, 1.13], m.steelDark);
    const guardShape = new THREE.Shape(); guardShape.moveTo(.355, 0); guardShape.absarc(0, 0, .355, 0, Math.PI, false); guardShape.lineTo(-.305, 0); guardShape.absarc(0, 0, .305, Math.PI, 0, true); guardShape.closePath();
    const guardGeometry = geometry('drum-half-hood', () => new THREE.ExtrudeGeometry(guardShape, { depth: 1.58, steps: 1, curveSegments: 16, bevelEnabled: false }));
    for (const x of [-half, half]) {
      mesh(drive, guardGeometry, m.orangeDark, [x, .765, -.79], true);
      for (const z of [-.83, .83]) {
        box(drive, [.78, .055, .045], [x, .765, z], m.orangeEdge, true);
        box(drive, [.11, .23, .11], [x + .3, .65, z], m.orangeDark);
      }
      for (const z of [-.55, .55]) cyl(drive, .028, .045, [x, 1.13, z], m.bolt, 'y', true, 6);
    }
  } else box(drive, [.45, .37, .54], [half, .765, 1.03], m.orangeDark);
  return { length, y };
}

/** Low-detail conveyor, aligned to local X; placement and slope belong to the scene. */
export function createConveyorSymbol(length = 5) {
  const safeLength = Number.isFinite(length) && length >= 1 ? length : 5;
  const group = new THREE.Group(); group.name = '胶带输送机 · 路径示意';
  group.userData.axis = 'x'; group.userData.nominalLength = safeLength;
  group.userData.evidence = '照片确认有 1# 胶带输送机；本符号不确认实际设备连接及路径。';
  conveyorPieces(safeLength, { frame: group, belt: group, drive: group }, toolkit()); compact(group); return group;
}

export function createSiteConveyor() {
  const group = new THREE.Group(), parts = [], kit = toolkit(), length = 6.4;
  group.name = '1# 胶带输送机 · 外观与输送原理';
  group.userData.evidence = 'IMG_7482 可见 1# 胶带输送机标识及橙色外框；输送方向、上下游连接和传动细节为示意，未据照片判定。';
  const frame = part(group, parts, 'conveyor-frame', '橙色走道与槽形托辊', '橙色检修走道、黄黑栏杆和酒红色钢架参照现场照片；槽形三联托辊用于解释承载带的支承。托辊、支腿间距及安装尺寸为通用示意；现场楼层和实际输送路径由后续测绘校准。', [-.8, .79, .86], [0, 0, -3.3]);
  const belt = part(group, parts, 'conveyor-belt', '胶带与承载面', '承载带输送矿石，回程带返回。动画仅演示连续输送，不确认照片中 1# 胶带机的现场流向、带速或实际起止设备。', [0, 1.24, .25], [0, 3.1, 0]);
  const drive = part(group, parts, 'conveyor-drive', '滚筒、护罩与驱动', '驱动滚筒通过摩擦带动胶带循环，轴承支承滚筒。端部护罩可在剖视中移除。电机、滚筒及张紧布置为补充原理示意，照片未提供铭牌和内部总装依据。', [3.2, 1.25, 1.25], [0, .1, 3.8]);
  conveyorPieces(length, { frame, belt, drive }, kit, true);
  const particles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.1, 0), kit.m.ore, 22);
  particles.castShadow = true; particles.frustumCulled = false; particles.userData.cutaway = true; particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); belt.add(particles);
  const dummy = new THREE.Object3D();
  const model = interfaceFor(group, parts, time => {
    for (let i = 0; i < 22; i++) {
      const f = (time * .075 + i / 22) % 1;
      const z = Math.sin(i * 2.1) * .43;
      dummy.position.set(-length / 2 + .1 + f * (length - .2), 1.1 + Math.max(0, Math.abs(z) - .27) * .34, z);
      dummy.rotation.set(i, i * .43, i * .2); dummy.scale.set(.6 + (i % 3) * .2, .55 + (i % 2) * .35, .6 + (i % 4) * .1); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
  }, [
    { title: '提起完整胶带', description: '承载带与回程带整体上提，露出支承带面的槽形托辊。', parts: ['conveyor-belt'] },
    { title: '后移托辊机架', description: '走道、机架和托辊向后分开，展示胶带承托结构的示意配合。', parts: ['conveyor-frame'] },
    { title: '分离头尾驱动', description: '头尾滚筒、完整护罩与电机向前展开，展示动力和胶带循环的示意关系。', parts: ['conveyor-drive'] },
  ]);
  model.update(0, 0);
  // Only the standalone equipment adopts the photograph's inclined posture.
  // Keep anchors and explode vectors in group-local coordinates, as expected
  // by the viewer; the lightweight process symbol stays horizontal.
  group.rotation.z = .22;
  group.updateMatrixWorld(true);
  group.position.y = .01 - new THREE.Box3().setFromObject(group).min.y;
  group.userData.presentation = '倾斜姿态参照照片；0.22 rad 为展示角度，不是现场测量值。';
  group.updateMatrixWorld(true);
  return model;
}
