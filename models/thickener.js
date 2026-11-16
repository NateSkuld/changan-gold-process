import * as THREE from 'three';

// General settling / raking teaching model; no plant dimensions or reagent
// settings are inferred. Particle paths explain direction, not CFD or DEM.
export function createThickener() {
  const group = new THREE.Group(), parts = [];
  group.name = '浓密机 · 沉降与回水';
  const RADIUS = 3.16, FLOOR_BASE = .852, FLOOR_SLOPE = .385, SURFACE = 3.115;
  const RAKE_SPEED = .065;
  const floorAt = r => FLOOR_BASE + FLOOR_SLOPE * r;
  const up = new THREE.Vector3(0, 1, 0), dummy = new THREE.Object3D();
  const V = a => new THREE.Vector3(...a);
  const M = {
    teal: new THREE.MeshStandardMaterial({ color: 0x286e68, metalness: .64, roughness: .36, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ color: 0x4b8a80, metalness: .57, roughness: .38, side: THREE.DoubleSide }),
    lining: new THREE.MeshStandardMaterial({ color: 0xb2b4a6, metalness: .14, roughness: .74, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x28373a, metalness: .68, roughness: .42 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9fa9a4, metalness: .84, roughness: .3, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: 0xbba16d, metalness: .74, roughness: .38 }),
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
    const bore = radius * .62;
    mesh(holder, new THREE.LatheGeometry([[bore, -.04], [radius, -.04], [radius, .04], [bore, .04], [bore, -.04]].map(p => new THREE.Vector2(...p)), 32), M.steel);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cyl(holder, .027, .105, [Math.sin(a) * radius * .82, 0, Math.cos(a) * radius * .82], M.brass, 6); }
  }
  function pipe(parent, points, radius, material = M.teal) {
    const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
    const p = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3();
    const segments = 64, sides = 10, stride = (sides + 1) * 2;
    for (const [start, cut] of [[Math.PI / 2, false], [-Math.PI / 2, true]]) {
      const positions = [], indices = [];
      for (let i = 0; i <= segments; i++) {
        curve.getPointAt(i / segments, p); curve.getTangentAt(i / segments, tangent);
        n.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
        if (n.lengthSq() < .01) n.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
        n.normalize(); b.crossVectors(tangent, n).normalize();
        for (const r of [radius, radius - .04]) for (let j = 0; j <= sides; j++) {
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
      mesh(parent, geo, material, undefined, cut);
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

  const tank = part('thickener-tank', '浓密池、内衬与锥形池底', '矿浆在池内进行固液沉降。上层较清，固体浓度向下增加；锥形池底与耙架共同将沉降固体送向中心。分层界面与池体尺寸均为原理示意。', [2.4, 2.25, 1.5], [2.25, 0, 0]);
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

  const feed = part('thickener-feedwell', '给矿管、给矿井与分配区', '给矿井消减入料动能，使矿浆向周围沉降区分配，避免高速射流直接扰动整个池体。是否添加絮凝剂及其制度需依据现场试验确认。', [0, 2.87, 0], [0, .65, -1.4]);
  halfProfile(feed, [[.87, 2.39], [.87, 3.25], [.79, 3.25], [.79, 2.39], [.87, 2.39]], M.teal, 'thickener-feedwell-wall');
  ring(feed, .87, .04, [0, 3.25, 0], M.brass);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    beam(feed, [Math.sin(a) * .85, 3.17, Math.cos(a) * .85], [Math.sin(a) * 1.14, 3.38, Math.cos(a) * .48], .035, M.steel);
  }
  const feedCurve = pipe(feed, [[-4.35, 3.43, -.63], [-3.3, 3.43, -.63], [-1.4, 3.43, -.63], [-.42, 3.38, -.57], [-.25, 2.96, -.32]], .16);
  flange(feed, [-3.8, 3.43, -.63], .25, 'x');
  stream(feed, feedCurve, 'thickener-feed-flow', 0xe2b568, 0, 28, .095, .041, 3);

  const rakePart = part('thickener-rake', '耙架、刮泥板与中心轴', '耙架低速旋转，倾斜刮泥板将底部沉降物逐步推向中心集泥口。它主要输送已沉降的固体，不把整池矿浆搅成旋涡。', [1.4, 1.58, 0], [0, .3, 1.7]);
  const rake = new THREE.Group(); rake.name = 'thickener-rake-rotor'; rakePart.add(rake);
  cyl(rake, .095, 2.55, [0, 2.35, 0], M.steel);
  cyl(rake, .24, .45, [0, 1.23, 0], M.brass);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; rake.add(arm);
    beam(arm, [.14, 1.24, 0], [2.94, floorAt(2.94) + .25, 0], .055, M.brass);
    beam(arm, [.14, 1.79, 0], [2.94, floorAt(2.94) + .25, 0], .033, M.steel);
    for (let j = 1; j <= 6; j++) {
      const x = .4 + j * .4, floor = floorAt(x);
      const blade = box(arm, [.12, .19, .49], [x, floor + .13, 0], M.edge); blade.rotation.y = .42;
      beam(arm, [x, floor + .22, 0], [x, 1.79 + (floorAt(2.94) + .25 - 1.79) * x / 2.94, 0], .018, M.steel);
      box(arm, [.14, .035, .52], [x, floor + .035, 0], M.steel).rotation.y = .42;
    }
  }

  const drive = part('thickener-drive', '工作桥、减速器与中心传动', '工作桥支承中心减速传动与检修通道。传动机构带动耙架低速运转，运行中需要结合扭矩、泥层与底流状态判断工况。', [0, 3.98, 0], [0, 1, 0]);
  for (const z of [-.43, .43]) box(drive, [6.9, .17, .16], [0, 3.34, z], M.dark);
  for (let i = 0; i < 32; i++) box(drive, [.035, .04, .85], [-3.33 + i * .215, 3.45, 0], M.steel);
  for (const z of [-.49, .49]) {
    for (const x of [-3.23, -2.15, -1.08, 1.08, 2.15, 3.23]) beam(drive, [x, 3.45, z], [x, 4.04, z], .022, M.brass);
    for (const y of [3.74, 4.04]) beam(drive, [-3.42, y, z], [3.42, y, z], .023, M.brass);
  }
  cyl(drive, .47, .25, [0, 3.59, 0], M.teal);
  box(drive, [.69, .34, .68], [0, 3.88, 0], M.dark);
  cyl(drive, .28, .56, [0, 4.34, 0], M.teal);
  for (let i = 0; i < 7; i++) cyl(drive, .304, .025, [0, 4.13 + i * .068, 0], M.edge);
  cyl(drive, .29, .07, [0, 4.65, 0], M.dark);
  box(drive, [.23, .22, .18], [0, 4.34, .3], M.dark);
  for (const x of [-.27, .27]) for (const z of [-.26, .26]) cyl(drive, .032, .04, [x, 3.742, z], M.brass, 6);

  const outlets = part('thickener-outlets', '中心底流、溢流堰与澄清水槽', '金色路径为中心排出的浓缩底流，青蓝路径为上缘溢流堰收集的澄清液。精矿与尾矿浓密后的具体去向不同，应按流程接口继续追踪。', [3, 2.9, 0], [0, 0, -1.7]);
  halfProfile(outlets, [[3.26, 2.89], [3.5, 2.89], [3.5, 3.16], [3.445, 3.16], [3.445, 2.945], [3.26, 2.945], [3.26, 2.89]], M.edge, 'thickener-overflow-launder');
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, x = Math.sin(a) * 3.272, z = Math.cos(a) * 3.272;
    const tooth = box(outlets, [.06, .105, .036], [x, 3.055, z], M.steel, z > .015); tooth.rotation.y = a;
  }
  const waterCurve = pipe(outlets, [[3.39, 2.99, -.15], [3.75, 2.91, -.15], [4.17, 2.55, -.15]], .13, M.edge);
  const bottomCurve = pipe(outlets, [[0, 1.01, 0], [0, .55, 0], [.42, .34, 0], [2.55, .34, 0], [3.78, .34, 0]], .21);
  flange(outlets, [3.78, .34, 0], .31, 'x');
  flange(outlets, [0, .79, 0], .29);
  stream(outlets, bottomCurve, 'thickener-underflow', 0xe3af5b, 2, 28, .085, .046, 3);
  stream(outlets, waterCurve, 'thickener-clearwater-return', 0x71cbd7, 3, 16, .13, .03, 2);

  const densityLayer = overlay(tank, 'thickener-density-layers', 1);
  function tint(color, opacity) { return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false, metalness: .03, roughness: .65, side: THREE.DoubleSide }); }
  const mudProfile = [[.38, floorAt(.38) + .065], [3.06, floorAt(3.06) + .065], [3.06, floorAt(3.06) + .24], [.38, floorAt(.38) + .24], [.38, floorAt(.38) + .065]];
  const mud = visual(mesh(densityLayer, new THREE.LatheGeometry(mudProfile.map(p => new THREE.Vector2(...p)), 80), tint(0x8c754f, .24)));
  mud.name = 'thickener-dense-bed';
  visual(cyl(densityLayer, 3.06, .28, [0, 2.42, 0], tint(0x8fa69a, .085), 80)).name = 'thickener-transition-layer';
  visual(cyl(densityLayer, 3.08, .43, [0, 2.88, 0], tint(0x8ac4cc, .075), 80)).name = 'thickener-clear-layer';
  const topSurface = visual(mesh(densityLayer, new THREE.RingGeometry(.88, 3.13, 96), tint(0x91d4d8, .12), [0, SURFACE, 0])); topSurface.rotation.x = -Math.PI / 2;

  const solidsLayer = overlay(tank, 'thickener-settling-and-raking', 1);
  const solidCount = 168;
  const solids = visual(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.solids, solidCount));
  solids.name = 'thickener-solids'; solids.instanceMatrix.setUsage(THREE.DynamicDrawUsage); solidsLayer.add(solids);
  fixedBounds(solids, [new THREE.Vector3(-3.05, .86, -3.05), new THREE.Vector3(3.05, 3.06, 3.05)], .06);
  const phases = new Float32Array(solidCount);
  solids.userData.motion = { kind: 'settle-then-rake-inward', phases, radius: RADIUS, surface: SURFACE, floorBase: FLOOR_BASE, floorSlope: FLOOR_SLOPE };
  let seed = 72529;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const grainData = Array.from({ length: solidCount }, (_, i) => ({ phase: i / solidCount, period: 23 + random() * 9,
    angle: random() * Math.PI * 2, radius: 1.28 + random() * 1.54, size: .025 + random() * .017 }));
  const goldColor = new THREE.Color(0xb77b2c), subduedColor = new THREE.Color(0xaeb1a2);
  let selectedStep = -1;
  function updateSolids(time) {
    for (let i = 0; i < solidCount; i++) {
      const grain = grainData[i], p = (grain.phase + time / grain.period) % 1;
      phases[i] = p;
      let radius, y, angle = grain.angle;
      if (p < .16) {
        const f = p / .16; radius = .24 + .42 * f; y = 2.94 - .59 * f; angle += .22 * f;
      } else if (p < .52) {
        const f = (p - .16) / .36; radius = .66 + (grain.radius - .66) * f;
        y = 2.35 + (floorAt(grain.radius) + .18 - 2.35) * f; angle += .22;
      } else if (p < .94) {
        const f = (p - .52) / .42; radius = grain.radius + (.37 - grain.radius) * f;
        y = floorAt(radius) + .18; angle += .22 + (p - .52) * grain.period * RAKE_SPEED;
      } else {
        const f = (p - .94) / .06; radius = .37 * (1 - f);
        y = floorAt(.37) + .18 + (.94 - floorAt(.37) - .18) * f;
        angle += .22 + .42 * grain.period * RAKE_SPEED;
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
    const points = [[1.05, 2.4], [1.75, 2.66], [2.56, 2.9], [3.16, SURFACE], [3.33, SURFACE], [3.39, 3.015]].map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]);
    stream(tank, new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal'), `thickener-water-rise-${a}`, 0x74ced9, 3, 13, .075, .024, 2);
  }
  // Show water collection in the upper channel as a shallow, bounded band.
  const launderWater = overlay(outlets, 'thickener-launder-water', 3);
  const waterBand = visual(mesh(launderWater, new THREE.RingGeometry(3.29, 3.43, 96), tint(0x65c4d5, .45), [0, 3.005, 0])); waterBand.rotation.x = -Math.PI / 2;

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
