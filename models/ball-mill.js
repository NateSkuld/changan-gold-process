import * as THREE from 'three';
import { rubberPanelGeometry } from './rubber-lining.js';

/** Ball-mill teaching model based on the supplied photograph; dimensions are illustrative. */
export function createBallMill(options = {}) {
  const requested = Number(typeof options === 'object' ? options?.unit : options);
  const unit = requested === 2 || requested === 3 ? requested : 1;
  const rubberLined = unit !== 1;
  const workingLength = unit === 2 ? 4000 : 3600;
  const lengthRatio = workingLength / 3600;
  const endOffset = 2.2 * (lengthRatio - 1);
  const group = new THREE.Group();
  group.name = unit + '# 球磨机 · ' + (rubberLined ? '橡胶衬板' : '钢衬板');
  Object.assign(group.userData, {unit, linerMaterial: rubberLined ? 'rubber' : 'steel', workingLengthMM:workingLength});
  const parts = [];
  const CY = 2.18;
  const M = {
    shell: new THREE.MeshStandardMaterial({ color: 0x226c67, metalness: .72, roughness: .31 }),
    shellEdge: new THREE.MeshStandardMaterial({ color: 0x397f75, metalness: .7, roughness: .3 }),
    darkTeal: new THREE.MeshStandardMaterial({ color: 0x143c3e, metalness: .72, roughness: .35 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb7a16c, metalness: .88, roughness: .3 }),
    brassDark: new THREE.MeshStandardMaterial({ color: 0x80704d, metalness: .87, roughness: .38 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x717d7e, metalness: .88, roughness: .29 }),
    steelBright: new THREE.MeshStandardMaterial({ color: 0xa9b1ae, metalness: .94, roughness: .22 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x29383a, metalness: .75, roughness: .37 }),
    base: new THREE.MeshStandardMaterial({ color: 0x485150, metalness: .35, roughness: .7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x172629, metalness: .2, roughness: .65 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xbd783b, metalness: .58, roughness: .42 }),
    ore: new THREE.MeshStandardMaterial({ color: 0x685d49, metalness: .22, roughness: .88 }),
    slot: new THREE.MeshStandardMaterial({ color: 0x122124, metalness: .15, roughness: .8 }),
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Share identical shapes so repeated fasteners, tiles and teeth can be
  // submitted as instances without changing their geometry or material.
  const geometryCache = new Map();
  function cachedGeometry(key, create) {
    if (!geometryCache.has(key)) geometryCache.set(key, create());
    return geometryCache.get(key);
  }
  function part(id, name, description, anchor, explode) {
    const root = new THREE.Group();
    root.name = name;
    root.userData.partId = id;
    group.add(root);
    const result = { id, name, description, root, anchor: V(...anchor), explode: V(...explode) };
    parts.push(result);
    return root;
  }
  function mesh(root, geo, mat, x = 0, y = 0, z = 0, cutaway = false) {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    if (cutaway) o.userData.cutaway = true;
    root.add(o);
    return o;
  }
  function box(root, w, h, d, mat, x, y, z, cutaway = false) {
    const geo = cachedGeometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
    return mesh(root, geo, mat, x, y, z, cutaway);
  }
  function cyl(root, radius, length, mat, x, y, z, axis = 'x', radialSegments = 48, cutaway = false, radius2 = radius) {
    const geo = cachedGeometry(`cyl:${radius2}:${radius}:${length}:${radialSegments}`, () => new THREE.CylinderGeometry(radius2, radius, length, radialSegments));
    const o = mesh(root, geo, mat, x, y, z, cutaway);
    if (axis === 'x') o.rotation.z = -Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    return o;
  }
  function ring(root, radius, thickness, mat, x, y, z, cutaway = false) {
    const geo = cachedGeometry(`ring:${radius}:${thickness}`, () => new THREE.TorusGeometry(radius, thickness, 8, 96));
    const o = mesh(root, geo, mat, x, y, z, cutaway);
    o.rotation.y = Math.PI / 2;
    return o;
  }
  // A closed annular sector, with real wall thickness and flat cut faces.
  function sector(root, inner, outer, length, start, end, mat, x = 0, cutaway = false, yc = CY, zc = 0) {
    const cacheKey = `sector:${inner}:${outer}:${length}:${start}:${end}`;
    if (geometryCache.has(cacheKey)) return mesh(root, geometryCache.get(cacheKey), mat, x, yc, zc, cutaway);
    const n = Math.max(3, Math.ceil((end - start) * 24));
    const positions = [], indices = [];
    for (let j = 0; j <= n; j++) {
      const a = start + (end - start) * j / n;
      for (const xx of [-length / 2, length / 2]) {
        for (const r of [inner, outer]) positions.push(xx, Math.sin(a) * r, Math.cos(a) * r);
      }
    }
    const q = (a, b, c, d) => indices.push(a, c, b, a, d, c);
    for (let j = 0; j < n; j++) {
      const k = j * 4, p = k + 4;
      q(k + 1, p + 1, p + 3, k + 3);
      q(k, k + 2, p + 2, p);
      q(k, p, p + 1, k + 1);
      q(k + 2, k + 3, p + 3, p + 2);
    }
    q(0, 1, 3, 2);
    q(n * 4, n * 4 + 2, n * 4 + 3, n * 4 + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometryCache.set(cacheKey, geo);
    return mesh(root, geo, mat, x, yc, zc, cutaway);
  }
  function bolts(root, x, radius, count, size, material = M.steelBright, cut = false, yc = CY, zc = 0) {
    const geo = cachedGeometry(`bolt:${size}`, () => new THREE.CylinderGeometry(size, size, .055, 6));
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      const b = mesh(root, geo, material, x, yc + radius * Math.sin(a), zc + radius * Math.cos(a), cut);
      b.rotation.z = Math.PI / 2;
      b.rotation.y = a;
    }
  }
  // Keep the back wall and continuous upper/lower strips. Only the front
  // 120-degree window opens; narrow end bands retain its rectangular outline.
  const cutSector = angle => Math.cos(angle) > .5;
  const WINDOW_LENGTH = 3.66 * lengthRatio;
  const SHELL_LENGTH = 4.4 * lengthRatio;
  // Explode translations separate the complete assemblies, including all
  // covers. Bearings stay on the floor as a common assembly datum. The paths
  // illustrate relationships, not a maintenance or lifting procedure.
  const explosionSteps = [
    { title: '移开传动', description: '齿圈向左、电机组向左前方移开，保留两者与筒体左端的传动关系。', parts: ['gear', 'drive'] },
    { title: '提起筒体', description: '完整筒体连同端盖上移，外罩保留，露出原本包在里面的结构。', parts: ['shell'] },
    { title: '展开筒内', description: rubberLined ? '近侧橡胶筒衬单独移开，露出纵向提升条、两端扇形衬板与独立的钢球层。' : '钢衬板与钢球向前分为两层，分别观察内壁保护层和研磨介质。', parts: rubberLined ? ['liners', 'liner-panel', 'charge'] : ['liners', 'charge'] },
    { title: '对照支承', description: '两端中空轴成组上移，主轴承与基础留在原位作为装配基准。', parts: ['trunnions', 'bearings'] },
  ];

  const shell = part('shell', '筒体、端盖与观察窗', '依据现场提供的教学模型照片，表现筒体两端法兰、成排紧固螺栓与正面矩形观察窗。观察窗用于演示内部结构，不代表生产设备运行时敞开；几何比例为示意，尚未依据总装尺寸校核。', [0, 3.35, .5], [0, 4.05, -.35]);
  const windowArcs = [[-Math.PI / 3, Math.PI / 3, true], [Math.PI / 3, Math.PI * 5 / 3, false]];
  for (const [a, b, cut] of windowArcs) {
    if (cut) {
      sector(shell, 1.14, 1.225, WINDOW_LENGTH, a, b, M.shell, 0, true);
      for (const side of [-1, 1]) {
        sector(shell, 1.14, 1.225, (SHELL_LENGTH - WINDOW_LENGTH) / 2, a, b, M.shell, side * (SHELL_LENGTH + WINDOW_LENGTH) / 4);
      }
    } else {
      sector(shell, 1.14, 1.225, SHELL_LENGTH, a, b, M.shell);
    }
  }
  for (const x of [-2.13 - endOffset, 2.13 + endOffset]) sector(shell, 1.22, 1.268, .11, 0, Math.PI * 2, M.shellEdge, x);
  // Longitudinal bolt rows follow both edges of the model's opening.
  for (const side of [-1, 1]) {
    const angle = side * Math.PI / 3;
    for (let i = 0; i < 13; i++) {
      const x = (-1.95 + i * .325) * lengthRatio;
      const fastener = cyl(shell, .035, .085, M.dark, x, CY + 1.264 * Math.sin(angle), 1.264 * Math.cos(angle), 'y', 6);
      fastener.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, Math.sin(angle), Math.cos(angle)));
    }
    const rail = box(shell, WINDOW_LENGTH + .03, .038, .06, M.steelBright, 0, CY + side * 1.19 * Math.sin(Math.PI / 3), 1.19 * .5);
    rail.rotation.x = -side * Math.PI / 3;
  }
  for (const x of [-WINDOW_LENGTH / 2, WINDOW_LENGTH / 2]) {
    sector(shell, 1.134, 1.237, .045, -Math.PI / 3, Math.PI / 3, M.steelBright, x);
  }
  for (const sign of [-1, 1]) {
    const x = sign * (2.24 + endOffset);
    sector(shell, .53, 1.27, .15, 0, Math.PI * 2, M.shellEdge, x);
    sector(shell, 1.22, 1.3, .18, 0, Math.PI * 2, M.steel, x);
    // The end covers remain legible around the central inspection window.
    const coverGeo = cachedGeometry('open-end-cover', () => new THREE.LatheGeometry(
      [[1.18,-.225],[.56,.225],[.306,.225],[.306,.166],[1.102,-.225],[1.18,-.225]].map(p => new THREE.Vector2(...p)), 64));
    mesh(shell, coverGeo, M.shell, sign * (2.48 + endOffset), CY, 0).rotation.z = -sign * Math.PI / 2;
    ring(shell, 1.276, .022, M.steelBright, sign * (2.335 + endOffset), CY, 0);
    bolts(shell, sign * (2.35 + endOffset), 1.245, 40, .037);
    sector(shell, .4, .58, .1, 0, Math.PI * 2, M.steel, sign * (2.76 + endOffset));
    bolts(shell, sign * (2.83 + endOffset), .505, 12, .034);
  }
  // The inspection cover, lifting eyes, and seam fasteners give the shell scale.
  box(shell, .85, .065, .43, M.darkTeal, -.72, 3.43, .02, true);
  box(shell, .75, .048, .34, M.shellEdge, -.72, 3.48, .02, true);
  for (const x of [-1.05, -.39]) for (const z of [-.13, .17]) cyl(shell, .03, .045, M.steelBright, x, 3.515, z, 'y', 6, true);
  for (const x of [-1.55, 1.5]) {
    const eye = mesh(shell, new THREE.TorusGeometry(.105, .035, 8, 24), M.steel, x, 3.49, -.23, true);
    eye.rotation.y = Math.PI / 2;
    box(shell, .2, .075, .22, M.shellEdge, x, 3.4, -.23, true);
  }

  const liner = part('liners', rubberLined ? '橡胶筒衬与扇形端衬' : '分块钢衬板与紧固件',
    rubberLined ? '筒壁上的长条沿轴向延伸；到达端面，扇形橡胶衬板围绕中空轴开口径向排列。板块接缝、圆肩凸条与环形收口参考筒内实拍，数量与断面尺寸为示意。'
      : '1# 球磨机使用钢衬板。保留教学模型照片中成排的矩形金属衬块与紧固件；衬板保护筒壁，并将钢球提升后释放。', [0, 2.63, -.89], [1.45, .65, 2.9]);
  let frontLiner = null;
  if (rubberLined) {
    frontLiner = part('liner-panel', '近侧橡胶衬板与提升条', '沿筒体轴线，橡胶提升条从较平的筒衬表面凸起。圆肩轮廓和宽板面来自现场照片；拆解时移开近侧这组衬板，便于观察内表面。', [0, 2.45, 1.05], [-2.3, 1.45, 3.65]);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x393c3d, metalness: .025, roughness: .46 });
    const rubberAlt = rubber.clone(); rubberAlt.color.setHex(0x323638); rubberAlt.roughness = .50;
    rubber.name = rubberAlt.name = '模压橡胶';
    const count = 18, pitch = 2 * Math.PI / count, bays = 3, bayLength = 4.24 * lengthRatio / bays;
    const panel = rubberPanelGeometry({pitch, length:bayLength - .018});
    const ends = [-1, 1].map(endSide => rubberPanelGeometry({pitch, endSide}));
    for (let i = 0; i < count; i++) {
      const angle = (i + .5) * pitch, cut = cutSector(angle);
      for (let j = 0; j < bays; j++) {
        const obj = mesh(cut ? frontLiner : liner, panel, (i + j) % 4 === 0 ? rubberAlt : rubber, (j - 1) * bayLength, CY, 0, cut);
        obj.rotation.x = -angle;
        obj.userData.linerRole = 'axial-lifter';
      }
      for (const [k, side] of [[0, -1], [1, 1]]) {
        const obj = mesh(liner, ends[k], i % 4 === 0 ? rubberAlt : rubber, side * endOffset, CY, 0, cut);
        obj.rotation.x = -angle;
        obj.userData.linerRole = 'radial-end-plate';
      }
    }
    for (const side of [-1, 1]) for (const [a,b,cut] of windowArcs) {
      const collar = sector(liner, .287, .392, .12, a, b, rubber, side * (2.201 + endOffset), cut);
      collar.userData.linerRole = 'throat-collar';
    }
  } else {
    for (let row = 0; row < 9; row++) {
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2 + .008;
        const b = (i + 1) / 24 * Math.PI * 2 - .008;
        const mid = (a + b) / 2;
        const cut = cutSector(mid);
        const x = -1.952 + row * .488;
        sector(liner, 1.048, 1.143, .476, a, b, (row + i) % 5 === 0 ? M.steelBright : M.steel, x, cut);
        const stud = cyl(liner, .022, .025, M.dark, x, CY + 1.032 * Math.sin(mid), 1.032 * Math.cos(mid), 'y', 6, cut);
        stud.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, Math.sin(mid), Math.cos(mid)));
        if (i % 4 === 0) {
          sector(liner, 1.012, 1.052, .474, mid - .02, mid + .02, M.dark, x, cut);
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + .025;
      const b = (i + 1) * Math.PI / 6 - .025;
      sector(liner, .42, 1.08, .065, a, b, M.dark, -2.15, cutSector((a + b) / 2));
    }
    // The rotating discharge diaphragm is part of the drum, upstream of
    // the hollow shaft. Actual slots span the working annulus in the end
    // face; do not put a stationary screen across the shaft itself.
    for (const [a,b,cut] of windowArcs) for (const [inner,outer] of
      [[.01,.40],[.40,.47],[.63,.66],[.81,.84],[.98,1.085]]) {
      sector(liner, inner, outer, .075, a, b, M.steel, 2.15, cut);
    }
    for (let i = 0; i < 48; i++) {
      const angle = (i + .5) * Math.PI / 24;
      const rib = sector(liner, .465, .985, .075, -.036, .036, M.dark, 2.15, cutSector(angle));
      rib.rotation.x = -angle;
    }
  }

  const charge = part('charge', '钢球研磨介质', rubberLined ? '照片中筒底的圆球是钢制研磨介质，黑色筒壁是橡胶衬板。提升条带起球荷，钢球抛落或沿料层滚落，冲击和磨细矿粒。显示的球数、粒径与动画速度为示意。' : '1# 的钢球与钢衬板是两个独立部件。不同粒径的钢球通过冲击和摩擦使矿粒变细；显示的球数、粒径与动画速度为示意。', [-.25, 1.73, .6], [1.45, -.5, 5.35]);
  const DRUM_SPEED = .16;
  const INNER_RADIUS = rubberLined ? .947 : 1.012;
  const INNER_HALF_LENGTH = rubberLined ? 1.955 + endOffset : 2.1;
  const ballGeo = new THREE.SphereGeometry(1, 14, 10);
  const ballCount = 175;
  const balls = new THREE.InstancedMesh(ballGeo, M.steelBright, ballCount);
  balls.name = 'ball-mill-steel-charge';
  balls.userData.labelObstacle = false;
  balls.userData.motionRole = 'steel-charge';
  balls.userData.containment = { radius: INNER_RADIUS, halfLength: INNER_HALF_LENGTH, centerY: CY };
  balls.castShadow = true;
  balls.receiveShadow = true;
  balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  charge.add(balls);
  const dummy = new THREE.Object3D();
  const ballData = [];
  let seed = 17891;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < ballCount; i++) {
    const r = .078 + random() * .058;
    const x = (random() * 2 - 1) * (rubberLined ? INNER_HALF_LENGTH - .145 : 1.92);
    const z = (random() - .5) * 1.25;
    const y = CY - Math.sqrt((.96 - r) ** 2 - z * z) + random() * .22;
    // These are explanatory paths, not a contact/DEM simulation. The lifted
    // subset follows the shell's angular speed; the bed never rotates rigidly.
    const mode = i < 32 ? 'cataract' : i < 66 ? 'cascade' : 'bed';
    const sweep = mode === 'cataract' ? 2.12 : 1.24;
    const liftDuration = sweep / DRUM_SPEED;
    const dropDuration = mode === 'cataract' ? 2.1 : 3.4;
    const rollDuration = mode === 'cataract' ? 4 : 3;
    ballData.push({ x, y, z, r, phase: random(), mode, sweep, liftDuration, dropDuration, rollDuration,
      period: liftDuration + dropDuration + rollDuration });
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(r);
    dummy.updateMatrix();
    balls.setMatrixAt(i, dummy.matrix);
    balls.setColorAt(i, new THREE.Color().setHSL(.13, .025, .44 + random() * .23));
  }
  // The low-contrast slurry stays inside the drum. A small number of bright
  // mineral tracers and arrowheads make axial transport visible through the
  // original rectangular observation window without adding floating labels.
  const flowLayer = new THREE.Group();
  flowLayer.name = 'ball-mill-operation-layer';
  flowLayer.userData.labelObstacle = false;
  charge.add(flowLayer);
  const noRaycast = () => {};
  const oreMaterial = new THREE.MeshStandardMaterial({ color: 0xd6af69, emissive: 0x805326, emissiveIntensity: .22, metalness: .38, roughness: .6 });
  const oreCount = 84;
  const ore = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), oreMaterial, oreCount);
  ore.name = 'ball-mill-ore-flow';
  ore.userData.labelObstacle = false;
  ore.userData.motionRole = 'axial-mineral-flow';
  ore.userData.containment = balls.userData.containment;
  ore.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ore.raycast = noRaycast;
  flowLayer.add(ore);
  const oreData = Array.from({ length: oreCount }, (_, i) => ({
    phase: i / oreCount,
    speed: .055 + random() * .021,
    y: -.28 + random() * .17,
    z: .1 + random() * .55,
    wobble: random() * Math.PI * 2,
    radius: .038 + random() * .017,
  }));
  const slurryRadius = Math.min(.98, INNER_RADIUS - .014), slurryLevel = -.22;
  const slurryShape = new THREE.Shape();
  const rightAngle = Math.asin(slurryLevel / slurryRadius);
  const leftAngle = -Math.PI - rightAngle;
  for (let i = 0; i <= 56; i++) {
    const angle = leftAngle + (rightAngle - leftAngle) * i / 56;
    const z = slurryRadius * Math.cos(angle), y = slurryRadius * Math.sin(angle);
    if (!i) slurryShape.moveTo(z, y); else slurryShape.lineTo(z, y);
  }
  slurryShape.closePath();
  const slurryMaterial = new THREE.MeshStandardMaterial({ color: 0x439a94, emissive: 0x123d3c, emissiveIntensity: .15,
    metalness: .12, roughness: .28, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide });
  const slurryLength = rubberLined ? 2 * (INNER_HALF_LENGTH - .03) : 3.96;
  const slurry = new THREE.Mesh(new THREE.ExtrudeGeometry(slurryShape, { depth: slurryLength, bevelEnabled: false, steps: 1 }), slurryMaterial);
  slurry.name = 'ball-mill-slurry';
  slurry.position.set(-slurryLength / 2, CY, 0);
  slurry.rotation.y = Math.PI / 2;
  slurry.userData.labelObstacle = false;
  slurry.raycast = noRaycast;
  flowLayer.add(slurry);
  const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x79d2c5, emissive: 0x2c9b90, emissiveIntensity: .32,
    metalness: .25, roughness: .4, transparent: true, opacity: .84, depthWrite: false });
  const arrowShaftGeometry = new THREE.CylinderGeometry(.012, .012, .19, 6);
  const arrowHeadGeometry = new THREE.ConeGeometry(.047, .105, 10);
  for (const x of [-1.26, 0, 1.26]) {
    const arrow = new THREE.Group();
    arrow.name = 'ball-mill-flow-arrow';
    arrow.position.set(x * lengthRatio, CY + .025, .67);
    arrow.userData.labelObstacle = false;
    const shaft = new THREE.Mesh(arrowShaftGeometry, arrowMaterial);
    shaft.rotation.z = -Math.PI / 2;
    const head = new THREE.Mesh(arrowHeadGeometry, arrowMaterial);
    head.rotation.z = -Math.PI / 2;
    head.position.x = .14;
    for (const piece of [shaft, head]) {
      piece.userData.labelObstacle = false;
      piece.raycast = noRaycast;
      arrow.add(piece);
    }
    flowLayer.add(arrow);
  }
  const operationGuide = {
    title: '矿浆如何通过磨机',
    summary: '左端入料，筒内研磨，右端排料。银色钢球显示提升、抛落与泻落，金色矿粒随青绿色矿浆沿轴向前进。' + (rubberLined ? '本机为橡胶衬板溢流型球磨机。' : '本机为钢衬板格子型球磨机。'),
    steps: [
      { label: '入料', description: '矿石与水经左端中空轴进入筒体；青绿色箭头指向矿浆总体前进方向。', partId: 'trunnions', color: '#79d2c5' },
      { label: '研磨', description: '衬板随筒体提升钢球，一部分钢球抛落冲击矿粒，另一部分沿料层泻落产生研磨；底部球荷持续翻动。', partId: 'charge', color: '#c7d2cd' },
      { label: '排料', description: rubberLined ? '料浆达到排矿口高度后，从中空轴溢流排出，进入相应的旋流器分级回路。' : '矿浆经排矿端格子板的孔隙进入排矿通道，送往双螺旋分级机。', partId: 'trunnions', color: '#d6af69' },
    ],
  };

  const gearing = part('gear', '左端大齿圈与护罩', '参照照片将齿圈及防护罩布置在筒体左端，与下方电机、减速传动对应。小齿轮带动大齿圈，再将转矩传递给筒体；剖视时移除部分护罩便于观察。', [-2.34, 3.47, .3], [-2.45, .05, -.1]);
  const gearRotor = new THREE.Group();
  gearRotor.position.set(-2.34, CY, 0);
  gearing.add(gearRotor);
  sector(gearRotor, 1.265, 1.39, .22, 0, Math.PI * 2, M.brass, 0, false, 0);
  sector(gearRotor, 1.277, 1.345, .035, 0, Math.PI * 2, M.brassDark, .13, false, 0);
  ring(gearRotor, 1.32, .018, M.brass, .15, 0, 0);
  bolts(gearRotor, .154, 1.309, 48, .024, M.steelBright, false, 0);
  for (let i = 0; i < 108; i++) {
    const a = i / 108 * Math.PI * 2;
    const tooth = box(gearRotor, .25, .083, .042, i % 3 ? M.brass : M.brassDark, 0, 1.414 * Math.sin(a), 1.414 * Math.cos(a));
    tooth.rotation.x = Math.PI / 2 - a;
  }

  // Stationary left-end gear guard, opened toward the visitor in section view.
  for (const [a, b, cut] of windowArcs) {
    sector(gearing, 1.465, 1.59, .39, a, b, M.darkTeal, -2.34, cut);
    for (const x of [-2.565, -2.115]) sector(gearing, 1.285, 1.59, .045, a, b, M.shellEdge, x, cut);
  }
  for (const z of [-.86, .86]) {
    box(gearing, .57, .5, .18, M.darkTeal, -2.34, .44, z);
    box(gearing, .72, .09, .42, M.dark, -2.34, .17, z);
  }

  const drive = part('drive', '左侧电机、减速器与小齿轮', '电机通过联轴器和减速机构驱动小齿轮，以较低转速带动筒体连续转动。护罩与底座用于隔离旋转部件并保持对中。', [-3.35, .95, 1.62], [-1.5, .05, 2.1]);
  // The low pinion sits tangentially below and in front of the ring gear.
  const PINY = 1.2, PINZ = 1.3;
  box(drive, 2.71, .15, 1.07, M.dark, 2.67, .17, PINZ);
  box(drive, 2.51, .1, .93, M.base, 2.67, .285, PINZ);
  const pinion = new THREE.Group();
  pinion.position.set(2.34, PINY, PINZ);
  drive.add(pinion);
  cyl(pinion, .2, .28, M.brass, 0, 0, 0);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const t = box(pinion, .29, .06, .05, M.brass, 0, .22 * Math.sin(a), .22 * Math.cos(a));
    t.rotation.x = Math.PI / 2 - a;
  }
  cyl(drive, .075, 1.46, M.steelBright, 2.18, PINY, PINZ);
  for (const x of [1.28, 2.18]) {
    box(drive, .29, .18, .44, M.darkTeal, x, .51, PINZ);
    box(drive, .22, .54, .3, M.darkTeal, x, .84, PINZ);
    cyl(drive, .166, .23, M.darkTeal, x, PINY, PINZ);
    cyl(drive, .095, .25, M.steel, x, PINY, PINZ);
  }
  // Compact enclosed gearbox with side ribs and service cover.
  box(drive, .67, .64, .68, M.darkTeal, 2.59, .94, PINZ);
  box(drive, .59, .11, .85, M.shell, 2.59, .55, PINZ);
  cyl(drive, .27, .035, M.shellEdge, 2.59, .93, PINZ + .36, 'z');
  cyl(drive, .08, .045, M.brass, 2.59, .93, PINZ + .388, 'z');
  for (let i = 0; i < 5; i++) box(drive, .043, .39, .055, M.shellEdge, 2.34 + i * .12, .96, PINZ + .365);
  // Motor is parallel to the mill shaft with radial fins and perforation-like slots.
  cyl(drive, .32, .81, M.shell, 3.53, 1.03, PINZ, 'x', 40);
  cyl(drive, .355, .07, M.shellEdge, 3.14, 1.03, PINZ);
  cyl(drive, .343, .16, M.darkTeal, 3.99, 1.03, PINZ);
  cyl(drive, .29, .016, M.dark, 4.077, 1.03, PINZ);
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const fin = box(drive, .71, .061, .035, M.shellEdge, 3.53, 1.03 + Math.sin(a) * .335, PINZ + Math.cos(a) * .335);
    fin.rotation.x = Math.PI / 2 - a;
  }
  for (let i = -3; i <= 3; i++) {
    const zz = i * .063;
    const hh = Math.sqrt(.25 * .25 - zz * zz) * 2;
    box(drive, .012, hh, .019, M.slot, 4.09, 1.03, PINZ + zz);
  }
  for (const x of [3.26, 3.8]) {
    box(drive, .16, .34, .58, M.darkTeal, x, .54, PINZ);
    box(drive, .24, .07, .69, M.shellEdge, x, .39, PINZ);
    for (const zz of [-.26, .26]) cyl(drive, .031, .035, M.steelBright, x, .445, PINZ + zz, 'y', 6);
  }
  box(drive, .35, .17, .31, M.darkTeal, 3.58, 1.43, PINZ);
  box(drive, .37, .035, .34, M.shellEdge, 3.58, 1.53, PINZ);
  cyl(drive, .118, .25, M.rubber, 3.006, 1.03, PINZ);
  for (const x of [2.92, 3.09]) cyl(drive, .15, .035, M.steel, x, 1.03, PINZ);
  for (const x of [1.46, 3.77]) for (const zz of [-.38, .38]) cyl(drive, .043, .045, M.steelBright, x, .357, PINZ + zz, 'y', 6);

  // The reference places the motor and reducer on the left, in front of
  // the trunnion pedestal. Reflect child transforms, not the public part root.
  for (const child of drive.children) child.position.x *= -1;

  const support = part('bearings', '主轴承与基础', '两端主轴承支承中空轴及筒体总成，将载荷传递到基础。轴承润滑和安装对中是稳定运行的关键。', [-2.93, 1.35, .43], [0, 0, 0]);
  for (const side of [-1, 1]) {
    const x = side * 2.99;
    box(support, 1.32, .19, 1.67, M.base, x, .12, 0);
    box(support, 1.12, .18, 1.45, M.dark, x, .29, 0);
    // Continuous broad pedestal beneath each trunnion, following the photo.
    box(support, .93, 1.38, 1.18, M.darkTeal, x, 1.08, 0);
    box(support, 1.02, .12, 1.3, M.shell, x, 1.57, 0);
    sector(support, .436, .57, .75, 0, 2 * Math.PI, M.shell, x);
    sector(support, .35, .44, .77, 0, 2 * Math.PI, M.dark, x);
    sector(support, .324, .352, .79, 0, 2 * Math.PI, M.steelBright, x);
    box(support, .86, .092, 1.21, M.shellEdge, x, CY - .04, 0);
    for (const xx of [-.32, .32]) for (const zz of [-.49, .49]) {
      cyl(support, .052, .085, M.steelBright, x + xx, CY + .04, zz, 'y', 6);
    }
    for (const xx of [-.42, .42]) for (const zz of [-.55, .55]) {
      cyl(support, .052, .085, M.steelBright, x + xx, .423, zz, 'y', 6);
    }
    for (const zz of [-.41, .41]) {
      const rib = box(support, .82, .56, .063, M.shellEdge, x, .71, zz);
      rib.rotation.x = zz < 0 ? -.17 : .17;
    }
    cyl(support, .048, .13, M.brass, x, CY + .6, -.04, 'y', 12);
    ring(support, .38, .016, M.brassDark, x + side * .405, CY, 0);
    // Grease pipe, gauge face and pedestal access plate.
    cyl(support, .019, .51, M.brassDark, x + .29, 1.47, .48, 'y', 10);
    cyl(support, .08, .038, M.brass, x + .29, 1.78, .505, 'z', 20);
    cyl(support, .059, .043, M.steelBright, x + .29, 1.78, .509, 'z', 20);
    box(support, .31, .22, .02, M.dark, x, .72, .602);
    for (const xx of [-.12, .12]) for (const yy of [-.077, .077]) cyl(support, .017, .027, M.steelBright, x + xx, .72 + yy, .626, 'z', 6);
  }

  const feed = part('trunnions', rubberLined ? '中空轴与溢流排矿口' : '中空轴与排矿通道',
    rubberLined ? '设备标示卡确认本机为溢流型。扇形橡胶端衬在中空轴孔周围收口；矿浆经排矿端溢出。孔径、端衬断面和排矿端细节为原理示意。' : '设备标示卡确认 1# 为格子型。矿浆通过排矿端格子孔进入排矿通道；本图以格栅示意通流关系，孔形和数量未经实测。', [-3.56, 2.7, 0], [0, 1.9, 0]);
  for (const side of [-1, 1]) {
    sector(feed, .26, .325, 1.12, 0, Math.PI * 2, M.steel, side * 3.01);
    sector(feed, .257, .377, .09, 0, Math.PI * 2, M.shellEdge, side * 3.56);
    bolts(feed, side * 3.63, .328, 12, .029);
    // Hollow bell mouth visible in the supplied teaching model photograph.
    const flare = new THREE.CylinderGeometry(.51, .28, .43, 48, 1, true);
    flare.rotateZ(-side * Math.PI / 2);
    const mouthMaterial = M.steel.clone();
    mouthMaterial.side = THREE.DoubleSide;
    mesh(feed, flare, mouthMaterial, side * 3.76, CY, 0);
    ring(feed, .506, .028, M.steelBright, side * 3.975, CY, 0);
  }

  // Only the working barrel is longer on 2#. Slide end assemblies intact;
  // this keeps the gear teeth, steel balls and supports at their normal size.
  if (endOffset) {
    for (const assembly of [gearing, drive, support, feed]) for (const child of assembly.children)
      child.position.x += (assembly === gearing || assembly === drive ? -1 : Math.sign(child.position.x)) * endOffset;
    for (const p of parts) if (['gear','drive','bearings','trunnions'].includes(p.id)) p.anchor.x -= endOffset;
  }

  // Instance only direct siblings sharing geometry, material and cutaway
  // behavior. Separate part roots and rotating subassemblies remain intact.
  function instanceRepeatedMeshes(root) {
    const batches = new Map();
    for (const child of [...root.children]) {
      if (child.isGroup) instanceRepeatedMeshes(child);
      if (!child.isMesh || child.isInstancedMesh) continue;
      const key = `${child.geometry.uuid}:${child.material.uuid}:${!!child.userData.cutaway}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(child);
    }
    for (const repeated of batches.values()) {
      if (repeated.length < 2) continue;
      const first = repeated[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, repeated.length);
      batch.name = 'Repeated ' + first.geometry.type;
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.userData = { ...first.userData };
      repeated.forEach((child, index) => {
        child.updateMatrix();
        batch.setMatrixAt(index, child.matrix);
        root.remove(child);
      });
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      root.add(batch);
    }
  }
  for (const p of parts) instanceRepeatedMeshes(p.root);

  // The shell and liners turn as one drum, while the bearing pedestals,
  // hopper, trunnion feed pipe and drive housing remain stationary.
  // Keep the public part roots free for the application's explode animation.
  function drumPivot(root) {
    const pivot = new THREE.Group();
    pivot.position.y = CY;
    const children = [...root.children];
    for (const child of children) {
      pivot.add(child);
      child.position.y -= CY;
    }
    root.add(pivot);
    return pivot;
  }
  const shellPivot = drumPivot(shell);
  const linerPivot = drumPivot(liner);
  const panelPivot = frontLiner && drumPivot(frontLiner);
  let elapsed = 0;
  let viewMode = 'cutaway';
  function setViewMode(view) {
    viewMode = view;
    // An exploded assembly must retain its real shell and guard; only the
    // section view removes covers to open an inspection window.
    group.traverse(object => { if (object.userData.cutaway) object.visible = viewMode !== 'cutaway'; });
    // Fix the section plane in space whenever its opening is visible.
    const angle = viewMode === 'solid' ? elapsed * DRUM_SPEED : 0;
    shellPivot.rotation.x = angle;
    linerPivot.rotation.x = angle;
    if (panelPivot) panelPivot.rotation.x = angle;
    flowLayer.visible = viewMode === 'cutaway';
  }
  function update(delta) {
    if (viewMode === 'exploded') return;
    elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, .08));
    gearRotor.rotation.x = elapsed * DRUM_SPEED;
    pinion.rotation.x = -elapsed * DRUM_SPEED * 6;
    if (viewMode === 'solid') {
      shellPivot.rotation.x = gearRotor.rotation.x;
      linerPivot.rotation.x = gearRotor.rotation.x;
      if (panelPivot) panelPivot.rotation.x = gearRotor.rotation.x;
    }
    for (let i = 0; i < ballCount; i++) {
      const b = ballData[i];
      let y = b.y - CY + Math.sin(elapsed * 1.4 + b.phase * Math.PI * 2) * .013;
      let z = b.z + Math.sin(elapsed * 1.13 + b.phase * Math.PI * 2) * .013;
      if (b.mode !== 'bed') {
        const t = (elapsed + b.phase * b.period) % b.period;
        const orbit = INNER_RADIUS - b.r - .035;
        const releaseAngle = -Math.PI / 2 - b.sweep;
        const releaseY = orbit * Math.sin(releaseAngle), releaseZ = orbit * Math.cos(releaseAngle);
        const impactY = -orbit * (b.mode === 'cataract' ? .66 : .78);
        const impactZ = orbit * (b.mode === 'cataract' ? .52 : .32);
        if (t < b.liftDuration) {
          const angle = -Math.PI / 2 - t * DRUM_SPEED;
          y = orbit * Math.sin(angle);
          z = orbit * Math.cos(angle);
        } else if (t < b.liftDuration + b.dropDuration) {
          const f = (t - b.liftDuration) / b.dropDuration;
          z = releaseZ + (impactZ - releaseZ) * f;
          // A parabolic airborne segment and a lower sliding segment explain
          // the two actions separately. Neither is a calibrated trajectory.
          y = b.mode === 'cataract'
            ? releaseY + .08 * f - (releaseY - impactY + .08) * f * f
            : releaseY + (impactY - releaseY) * f + .015 * Math.sin(Math.PI * f);
        } else {
          const f = (t - b.liftDuration - b.dropDuration) / b.rollDuration;
          y = impactY + (-orbit - impactY) * f;
          z = impactZ * (1 - f);
        }
      }
      // Bound the complete ball, not just its centre, by the inner lining.
      const maxRadius = INNER_RADIUS - b.r - .008;
      const radial = Math.hypot(y, z);
      if (radial > maxRadius) { y *= maxRadius / radial; z *= maxRadius / radial; }
      dummy.position.set(b.x, CY + y, z);
      dummy.rotation.set(elapsed * .6 + b.phase, b.phase, elapsed * .25);
      dummy.scale.setScalar(b.r);
      dummy.updateMatrix();
      balls.setMatrixAt(i, dummy.matrix);
    }
    balls.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < oreCount; i++) {
      const grain = oreData[i];
      const progress = (grain.phase + elapsed * grain.speed) % 1;
      // Reset occurs at the concealed end band, outside the observation window.
      // Smaller downstream tracers illustrate cumulative size reduction.
      const radius = grain.radius * (1 - .46 * progress);
      const tracerReach = rubberLined ? INNER_HALF_LENGTH - .06 : 2.025;
      dummy.position.set((2 * progress - 1) * tracerReach,
        CY + grain.y + .034 * Math.sin(elapsed * 1.3 + grain.wobble),
        grain.z + .025 * Math.sin(elapsed + grain.wobble));
      dummy.rotation.set(elapsed * .8 + grain.wobble, grain.wobble, elapsed * .5);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      ore.setMatrixAt(i, dummy.matrix);
    }
    ore.instanceMatrix.needsUpdate = true;
    arrowMaterial.opacity = .68 + .16 * (.5 + .5 * Math.sin(elapsed * 2.2));
  }
  // Populate dynamic matrices immediately, including when opening paused.
  update(0);
  balls.boundingSphere = new THREE.Sphere(V(0, CY, 0), Math.hypot(INNER_HALF_LENGTH, INNER_RADIUS));
  ore.boundingSphere = balls.boundingSphere.clone();
  group.userData.partIds = parts.map(p => p.id);
  group.userData.description = unit + '# 球磨机 · ' + (rubberLined ? '现场实拍橡胶筒衬、提升条与放射状端衬' : '分块钢衬板') + ' · 结构与运动原理示意';
  return { group, parts, explosionSteps, operationGuide, update, setViewMode };
}
