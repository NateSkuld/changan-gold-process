import * as THREE from 'three';
import { PLANT_NODES, PLANT_EDGES } from './plant-flow.js';
import { createSiteJawCrusher, createSiteScreen } from './models/crushing-site.js';
import { createConeCrusher } from './models/cone-crusher.js';
import { createAuxiliary, createPlantSymbol } from './models/auxiliary.js';

// A diagram with site-referenced equipment envelopes and schematic steelwork.
// These positions are not surveyed coordinates. In particular, no conveyor is
// identified as the photographed 1# belt: its endpoints remain unconfirmed.
const LAYOUT = {
  'raw-ore': [-13, 4, -7],
  'jaw-primary': [-13, 1.7, 0],
  prescreen: [-6, 3.1, 0],
  'jaw-secondary': [-6, 1.8, 7],
  'closed-screen': [3, 3.4, 0],
  'cone-crusher': [11, 1.3, 4],
  'ore-bin': [3, .4, 8],
};
const FOCUS = {
  all: Object.keys(LAYOUT),
  coarse: ['raw-ore', 'jaw-primary', 'prescreen', 'jaw-secondary'],
  screening: ['prescreen', 'jaw-secondary', 'closed-screen'],
  closed: ['closed-screen', 'cone-crusher', 'ore-bin'],
};
const V = a => new THREE.Vector3(...a);
const UP = new THREE.Vector3(0, 1, 0);
const ROUTES = {
  'raw-ore>jaw-primary': { points: [[-13, 4.85, -5.55], [-13, 4.6, -3.6], [-13, 4.4, -1.55]], label: '原矿', at: .45 },
  'jaw-primary>prescreen': { points: [[-10.9, 2.75, 0], [-9.4, 3.25, 0], [-7.85, 3.8, 0]], label: '粗碎产品', at: .48 },
  'prescreen>jaw-secondary': { points: [[-6, 4.05, 1.5], [-6, 4, 3.4], [-6, 3.9, 5.45]], label: '筛上 +40 mm', color: 0xe6ac68, at: .48 },
  'prescreen>closed-screen': { points: [[-4.05, 4.1, -.35], [-1.6, 4.55, -.35], [.65, 4.8, -.35]], label: '筛下 −40 mm · 旁路', color: 0xa6c8cf, at: .46 },
  'jaw-secondary>closed-screen': { points: [[-3.85, 2.7, 7], [-.65, 2.8, 7], [-.65, 3.4, 3.2], [.65, 4.05, 1.25]], label: '中碎产品', at: .35 },
  'closed-screen>cone-crusher': { points: [[5.35, 4.7, .35], [7.15, 4.65, .45], [8.8, 4.15, 2.15], [9.65, 4.05, 2.65]], label: '筛上 +10 mm → 细碎', color: 0xe6ac68, at: .42 },
  'cone-crusher>closed-screen': { points: [[12.6, 1.85, 4], [14, 1.65, 2.3], [14, 1.65, -3.9], [6.9, 1.9, -4.4], [3, 2.5, -3.9], [3, 4.85, -1.8]], label: '细碎返筛', color: 0x72c4b1, at: .53 },
  'closed-screen>ore-bin': { points: [[3, 3.9, 1.7], [3, 3.15, 4.25], [3, 2.7, 6.55]], label: '筛下 −10 mm → 矿仓', color: 0xa6c8cf, at: .5 },
};

export function createCrushingScene() {
  const group = new THREE.Group();
  group.name = '破碎工段 · 现场外观与流程图';
  group.userData.evidence = '现场照片用于设备外观和钢架层次参照；节点身份和八条工艺边沿用原流程图，布局非测绘。';
  const nodeObjects = new Map(), nodeBounds = new Map(), hotspotPositions = new Map();
  const links = [], annotations = [];
  const nodes = PLANT_NODES.filter(n => Object.hasOwn(LAYOUT, n.id));
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = PLANT_EDGES.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitPipe = new THREE.CylinderGeometry(.5, .5, 1, 10);
  const unitBolt = new THREE.CylinderGeometry(.5, .5, 1, 6);
  const m = {
    deck: new THREE.MeshStandardMaterial({ color: 0x41494a, roughness: .79, metalness: .36 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x77807d, roughness: .65, metalness: .58 }),
    support: new THREE.MeshStandardMaterial({ color: 0x623839, roughness: .76, metalness: .3 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xc25418, roughness: .65, metalness: .24 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd7a819, roughness: .72, metalness: .17 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x21292a, roughness: .8, metalness: .32 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x656761, roughness: .96, metalness: 0 }),
    floor: new THREE.MeshBasicMaterial({ color: 0x0e201c, transparent:true, opacity:.6, depthWrite:false }),
  };

  // Static steelwork is instanced per node and material, keeping picking IDs
  // on the holder while avoiding one draw call per railing or bracing member.
  function platform(holder, width, depth, height, stairs = false) {
    const architecture = new THREE.Group(); architecture.name = '图示钢平台 · 非实测'; holder.add(architecture);
    const batches = new Map(), dummy = new THREE.Object3D();
    function instance(geometry, material, size, position, quaternion) {
      dummy.position.copy(V(position)); dummy.scale.copy(V(size));
      dummy.quaternion.copy(quaternion || new THREE.Quaternion()); dummy.updateMatrix();
      const key = `${geometry.id}:${material.id}`;
      if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [] });
      batches.get(key).matrices.push(dummy.matrix.clone());
    }
    const box = (material, size, position, quaternion) => instance(unitBox, material, size, position, quaternion);
    function beam(material, a, b, thickness) {
      const start = V(a), end = V(b), delta = end.clone().sub(start);
      box(material, [thickness, delta.length(), thickness], start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize()));
    }
    function pipe(material, a, b, diameter = .05) {
      const start = V(a), end = V(b), delta = end.clone().sub(start);
      instance(unitPipe, material, [diameter, delta.length(), diameter], start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize()));
    }
    function iBeam(length, x, y, z) {
      box(m.deck, [length, .25, .065], [x, y, z]);
      for (const dy of [-.14, .14]) box(m.edge, [length, .035, .19], [x, y + dy, z]);
    }
    box(m.deck, [width, .16, depth], [0, -.11, 0]);
    for (const z of [-depth / 2 + .08, depth / 2 - .08]) iBeam(width, 0, -.28, z);
    // Narrow rear grating and segmented plates establish scale without covering equipment.
    for (let px = -width / 2 + .16; px < width / 2; px += .13) box(m.edge, [.025, .025, .37], [px, -.016, -depth / 2 + .28]);
    for (const px of [-width / 4, width / 4]) box(m.dark, [.012, .008, depth - .13], [px, -.024, 0]);
    const x = width / 2 - .34, z = depth / 2 - .29;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(m.concrete, [.66, .18, .66], [sx * x, -height + .03, sz * z]);
      box(m.deck, [.42, .065, .42], [sx * x, -height + .16, sz * z]);
      const columnHeight = Math.max(.12, height - .3);
      box(m.support, [.17, columnHeight, .08], [sx * x, -height / 2 - .04, sz * z]);
      for (const dz of [-.09, .09]) box(m.support, [.21, columnHeight, .035], [sx * x, -height / 2 - .04, sz * z + dz]);
      for (const dx of [-.15, .15]) for (const dz of [-.15, .15]) instance(unitBolt, m.edge, [.045, .075, .045], [sx * x + dx, -height + .21, sz * z + dz]);
      box(m.support, [.31, .24, .035], [sx * x, -.4, sz * z + .12]);
      for (const dx of [-.095, .095]) instance(unitBolt, m.edge, [.035, .035, .035], [sx * x + dx, -.4, sz * z + .15], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    }
    if (height > .95) {
      // Bracing is on the rear and sides. The front remains open to the viewer.
      beam(m.support, [-x, -height + .2, -z], [x, -.35, -z], .11);
      beam(m.support, [x, -height + .2, -z], [-x, -.35, -z], .11);
      for (const sx of [-1, 1]) beam(m.support, [sx * x, -height + .2, -z], [sx * x, -.35, z], .095);
    }
    if (height > .8) {
      for (const px of [-width / 2 + .08, 0, width / 2 - .08]) pipe(m.orange, [px, -.02, -depth / 2 + .04], [px, .73, -depth / 2 + .04], .06);
      box(m.orange, [width, .17, .035], [0, .07, -depth / 2 + .04]);
      for (const y of [.34, .69]) {
        pipe(m.orange, [-width / 2, y, -depth / 2 + .04], [width / 2, y, -depth / 2 + .04]);
        for (const sx of [-1, 1]) pipe(m.orange, [sx * (width / 2 - .04), y, -depth * .48], [sx * (width / 2 - .04), y, depth * .18]);
      }
      // The photographs show intermittent yellow/black markings on the top rails.
      for (let px = -width / 2; px < width / 2 - .2; px += .6) pipe(m.yellow, [px, .69, -depth / 2 + .04], [Math.min(px + .22, width / 2), .69, -depth / 2 + .04], .057);
      for (const sx of [-1, 1]) pipe(m.orange, [sx * (width / 2 - .04), -.02, depth * .18], [sx * (width / 2 - .04), .73, depth * .18], .06);
    }
    if (stairs && height > 1) {
      // Access stairs are schematic, inspired by the visible grey stairs/orange rails.
      const sx = -width / 2 - .43, count = Math.ceil(height / .22), run = count * .2;
      for (let i = 0; i < count; i++) {
        const y = -height + (i + 1) * height / count, z = depth / 2 + run - i * .2;
        box(m.deck, [.68, .045, .22], [sx, y, z]);
        box(m.edge, [.68, .025, .026], [sx, y + .02, z + .1]);
        if (i % 3 === 0) pipe(m.orange, [sx - .36, y, z], [sx - .36, y + .66, z]);
      }
      for (const dx of [-.36, .36]) {
        beam(m.deck, [sx + dx, -height + .1, depth / 2 + run + .1], [sx + dx, -.05, depth / 2 + .1], .09);
        pipe(m.orange, [sx + dx, -height + .81, depth / 2 + run], [sx + dx, .7, depth / 2 + .18]);
      }
      box(m.deck, [.85, .05, .55], [sx, -.03, depth / 2 - .1]);
    }
    for (const { geometry, material, matrices } of batches.values()) {
      const batch = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
      batch.castShadow = true; batch.receiveShadow = true; batch.computeBoundingBox(); batch.computeBoundingSphere(); architecture.add(batch);
    }
  }

  const floor = new THREE.Mesh(unitBox, m.floor); floor.scale.set(32, .14, 21.5); floor.position.set(-.5, -.22, 1); floor.receiveShadow = true; group.add(floor);
  const floorOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-16.5, -.14, -9.75], [15.5, -.14, -9.75], [15.5, -.14, 11.75], [-16.5, -.14, 11.75]].map(V)), new THREE.LineBasicMaterial({ color: 0x516c60, transparent: true, opacity: .27 })); group.add(floorOutline);
  const jawTemplate = createSiteJawCrusher(); jawTemplate.update(0, 0);
  for (const node of nodes) {
    const holder = new THREE.Group(); holder.position.copy(V(LAYOUT[node.id])); holder.userData.nodeId = node.id; holder.name = node.label;
    let visual, scale = .6, width = 4.2, depth = 3.7;
    if (node.id === 'jaw-primary' || node.id === 'jaw-secondary') {
      // The clones share geometry and material; overview mechanisms stay still.
      visual = jawTemplate.group.clone(true); scale = node.id === 'jaw-primary' ? .58 : .51;
      holder.userData.referenceNote = '橙色颚破为现场同类外观参照，照片设备的粗碎 / 中碎身份待核对。';
    } else if (node.id === 'closed-screen') {
      const model = createSiteScreen(); model.update(0, 0); visual = model.group; scale = .62; width = 4.9;
      holder.userData.referenceNote = '蓝色外罩为现场同类外观参照，照片设备与本节点的对应及型号待核对。';
    } else if (node.id === 'prescreen') {
      const model = createAuxiliary('screen'); model.update(0, 0); visual = model.group; scale = .65;
      holder.userData.referenceNote = 'SZZ1500×4000 按流程图保留，使用通用预筛模型。';
    } else if (node.id === 'cone-crusher') {
      const model = createConeCrusher(); model.update(0); visual = model.group; scale = .55; width = 4.7; depth = 4.2;
      holder.userData.referenceNote = 'IMG_7484 现场标牌确认 CC300；外观参考实拍，位置与内部尺寸为示意。';
    } else {
      visual = createPlantSymbol('hopper'); scale = 1.05; width = 3.4; depth = 3.4;
      holder.userData.referenceNote = '矿仓为流程图符号，现场外形与位置未确认。';
    }
    visual.scale.setScalar(scale); holder.add(visual);
    platform(holder, width, depth, holder.position.y, ['jaw-primary', 'closed-screen', 'cone-crusher'].includes(node.id));
    const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-width / 2, -.018, -depth / 2], [width / 2, -.018, -depth / 2], [width / 2, -.018, depth / 2], [-width / 2, -.018, depth / 2]].map(V)), new THREE.LineBasicMaterial({ color: 0xc7b27c, transparent: true, opacity: .38 }));
    holder.add(rim); group.add(holder); nodeObjects.set(node.id, holder);
  }
  group.updateMatrixWorld(true);
  for (const [id, holder] of nodeObjects) {
    const box = new THREE.Box3().setFromObject(holder); nodeBounds.set(id, box);
    const p = holder.position.clone(); p.y = box.max.y + .32; hotspotPositions.set(id, p);
  }

  for (const [index, edge] of edges.entries()) {
    const route = ROUTES[`${edge.from}>${edge.to}`];
    const points = route ? route.points.map(V) : [V(LAYOUT[edge.from]), V(LAYOUT[edge.to])];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const color = route?.color || (edge.kind === 'return' ? 0x72c4b1 : 0xcbb482);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .87, depthWrite: false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(72)), material);
    line.name = `${edge.from} → ${edge.to}`; group.add(line);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .021, 4, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false })); group.add(tube);
    const contextObjects = [line, tube];
    for (const at of (edge.kind === 'return' ? [.22, .62, .87] : [.63])) {
      const origin = curve.getPointAt(at), tangent = curve.getTangentAt(at).normalize();
      const arrow = new THREE.ArrowHelper(tangent, origin, .58, color, .25, .2); group.add(arrow); contextObjects.push(arrow);
    }
    const labelPosition = curve.getPointAt(route?.at || .5); labelPosition.y += .4;
    annotations.push({ label: route?.label || edge.label || '工艺连接', position: labelPosition, kind: edge.kind });
    const box = new THREE.Box3().setFromPoints(curve.getPoints(24)); box.expandByScalar(.5);
    links.push({ edge, curve, line, color, material, box, contextObjects, phase: index * .137 });
  }
  annotations.push({ label: '蓝色筛为同类外观参照 · 节点对应待核对', position: new THREE.Vector3(3, 3.3, -2.35), kind: 'note' });

  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(.082, 7, 5), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, links.length * 3));
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beads.frustumCulled = false; group.add(beads);
  const matrix = new THREE.Matrix4(), beadColor = new THREE.Color();
  let focusIds = new Set(FOCUS.all), lastTime = 0;
  function update(dt, time) {
    lastTime = Number.isFinite(time) ? time : lastTime + Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1));
    let i = 0;
    for (const link of links) {
      for (let j = 0; j < 3; j++) {
        const t = ((lastTime * .075 + link.phase + j / 3) % 1 + 1) % 1;
        const p = link.curve.getPointAt(t); matrix.makeTranslation(p.x, p.y, p.z);
        beads.setMatrixAt(i, matrix); beads.setColorAt(i, beadColor.setHex(link.color)); i++;
      }
    }
    beads.count = i; beads.instanceMatrix.needsUpdate = true; if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
  }
  function positionFor(id) { return hotspotPositions.get(id)?.clone() || null; }
  function setFocus(id = 'all') {
    focusIds = new Set(FOCUS[id] || FOCUS.all);
    // Focus only changes camera bounds. Every node, hotspot and circuit stays
    // at its existing visibility and opacity; the closed loop is never hidden.
    return [...focusIds];
  }
  function bounds() {
    const box = new THREE.Box3();
    for (const id of focusIds) {
      if (nodeBounds.has(id)) box.union(nodeBounds.get(id));
      if (hotspotPositions.has(id)) box.expandByPoint(hotspotPositions.get(id));
    }
    for (const link of links) if (focusIds.has(link.edge.from) && focusIds.has(link.edge.to)) box.union(link.box);
    if (box.isEmpty()) box.set(new THREE.Vector3(-16, 0, -10), new THREE.Vector3(15, 7, 12));
    return box.expandByScalar(.55);
  }
  group.userData.nodeIds = [...nodeIds];
  group.userData.edgeCount = edges.length;
  setFocus('all'); update(0, 0);
  return { group, nodeObjects, positionFor, setFocus, bounds, update, annotations, links, motionLayer: beads };
}
