import * as THREE from 'three';

// Small deterministic PBR surfaces; generated from typed arrays in browser or
// Node. The grain/dust is illustrative surface treatment, not a damage survey.
// Shared across scene/detail instances so the same textures are uploaded once.
const coneSurfaceCache = new Map();
function coneSurface(kind) {
  if (coneSurfaceCache.has(kind)) return coneSurfaceCache.get(kind);
  const size = 256, color = new Uint8Array(size * size * 4), relief = new Uint8Array(size * size * 4);
  const hash = (x, y) => { let n = Math.imul(x + 19, 374761393) ^ Math.imul(y + 71, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; };
  const noise = (x, y, periodX, periodY) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix % periodX, iy % periodY), b = hash((ix + 1) % periodX, iy % periodY);
    const c = hash(ix % periodX, (iy + 1) % periodY), d = hash((ix + 1) % periodX, (iy + 1) % periodY);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, grain = hash(x, y);
    const broad = noise(u * 8, v * 8, 8, 8), medium = noise(u * 32, v * 24, 32, 24);
    const streak = noise(u * 64, v * 4, 64, 4);
    const dust = Math.max(0, broad - .38) * .38 + Math.max(0, streak - .57) * .18;
    const silver = kind === 'cast', painted = kind === 'red';
    const tone = silver ? 221 + broad * 22 + medium * 7 + grain * 5
      : painted ? 223 + broad * 24 + grain * 6 : 191 + broad * 31 + streak * 18 + grain * 7;
    const at = (y * size + x) * 4;
    color[at] = Math.min(255, tone + dust * (silver ? 5 : 28));
    color[at + 1] = Math.min(255, tone + dust * 7);
    color[at + 2] = Math.min(255, tone - dust * (silver ? 8 : 20));
    color[at + 3] = 255;
    const height = 122 + (grain - .5) * (silver ? 42 : 12) + (medium - .5) * (silver ? 20 : 8);
    relief[at] = height;
    relief[at + 1] = Math.min(255, (silver ? 192 : painted ? 176 : 209) + dust * 110 + grain * 17);
    relief[at + 2] = 255; relief[at + 3] = 255;
  }
  const texture = data => {
    const result = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true; result.needsUpdate = true;
    return result;
  };
  const maps = { map: texture(color), relief: texture(relief) };
  maps.map.colorSpace = THREE.SRGBColorSpace;
  coneSurfaceCache.set(kind, maps);
  return maps;
}


/**
 * Field silhouette reconstructed from the locally supplied IMG_7484 / IMG_7483.
 * The visible shell is site-referenced; the unseen internals remain a generic
 * teaching mechanism, not a measured CC300 fabrication model.
 * Public part roots are reserved for the viewer's explode translations.
 */
export function createConeCrusher() {
  const group = new THREE.Group();
  group.name = 'CC300 圆锥破碎机 · 现场外观与原理剖面';
  const parts = [];
  const TAU = Math.PI * 2;
  const CUT_START = -.48, CUT_END = 1.78;
  const M = {
    teal: new THREE.MeshStandardMaterial({ color: 0x246e68, metalness: .72, roughness: .33 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x418b7f, metalness: .69, roughness: .3 }),
    deep: new THREE.MeshStandardMaterial({ color: 0x163e40, metalness: .76, roughness: .38 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e9a96, metalness: .89, roughness: .28 }),
    cut: new THREE.MeshStandardMaterial({ color: 0xb5beb5, metalness: .8, roughness: .39 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x29383a, metalness: .73, roughness: .4 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc2a16c, metalness: .86, roughness: .29 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x94603c, metalness: .83, roughness: .34 }),
    liner: new THREE.MeshStandardMaterial({ color: 0x717d77, metalness: .82, roughness: .46 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x162326, metalness: .13, roughness: .7 }),
    oil: new THREE.MeshStandardMaterial({ color: 0xb98c46, metalness: .2, roughness: .33 }),
    fieldSilver: new THREE.MeshStandardMaterial({ color: 0xa5aaa4, metalness: .48, roughness: .56 }),
    silverEdge: new THREE.MeshStandardMaterial({ color: 0xb9bdb5, metalness: .63, roughness: .43 }),
    silverShade: new THREE.MeshStandardMaterial({ color: 0x737b78, metalness: .5, roughness: .62 }),
    fieldRed: new THREE.MeshStandardMaterial({ color: 0xa51c29, metalness: .35, roughness: .53 }),
    hood: new THREE.MeshStandardMaterial({ color: 0x303637, metalness: .48, roughness: .66 }),
    hoodEdge: new THREE.MeshStandardMaterial({ color: 0x454c4b, metalness: .52, roughness: .57 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xd0b43b, metalness: .18, roughness: .62 }),
  };
  for (const [name, kind, strength] of [
    ['fieldSilver', 'cast', .009], ['silverShade', 'cast', .006],
    ['hood', 'hood', .0024], ['hoodEdge', 'hood', .0015], ['fieldRed', 'red', .002],
  ]) {
    const surface = coneSurface(kind), material = M[name];
    material.map = surface.map; material.roughnessMap = surface.relief;
    material.bumpMap = surface.relief; material.bumpScale = strength;
  }
  M.fieldSilver.roughness = .76; M.silverShade.roughness = .84;
  M.hood.roughness = .91; M.hood.metalness = .32;
  M.hoodEdge.roughness = .76; M.fieldRed.roughness = .68;
  M.fieldSilver.color.setHex(0xb0b4ad);
  const geoCache = new Map(), sectionMaterials = new Map();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }
  function part(id, name, description, anchor, explode) {
    const root = new THREE.Group(); root.name = name; root.userData.partId = id; group.add(root);
    parts.push({ id, name, description, root, anchor: V(...anchor), explode: V(...explode) });
    return root;
  }
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0, cut = false) {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z);
    item.castShadow = true; item.receiveShadow = true;
    if (cut) item.userData.cutaway = true;
    parent.add(item); return item;
  }
  function box(parent, w, h, d, material, x, y, z, cut = false) {
    return mesh(parent, cached(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), material, x, y, z, cut);
  }
  function cyl(parent, r, h, material, x = 0, y = 0, z = 0, axis = 'y', cut = false, rb = r, segments = 48) {
    const item = mesh(parent, cached(`c:${r}:${rb}:${h}:${segments}`, () => new THREE.CylinderGeometry(r, rb, h, segments)), material, x, y, z, cut);
    if (axis === 'x') item.rotation.z = -Math.PI / 2;
    if (axis === 'z') item.rotation.x = Math.PI / 2;
    return item;
  }
  function torus(parent, r, tube, material, x, y, z, axis = 'y') {
    const item = mesh(parent, cached(`t:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 8, 64)), material, x, y, z);
    item.rotation.x = axis === 'y' ? Math.PI / 2 : 0;
    if (axis === 'x') item.rotation.y = Math.PI / 2;
    return item;
  }
  // Closed, genuinely thick lathed walls. Distinct cut faces remain visible
  // when the front portion is hidden; no transparent-shell visual shortcut.
  function sectionGeometry(profile, start, length) {
    return cached(`s:${JSON.stringify(profile)}:${start}:${length}`, () => {
      const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
      const closed = [...pts, pts[0].clone()];
      const lathe = new THREE.LatheGeometry(closed, Math.ceil(length * 18), start, length);
      const positions = Array.from(lathe.attributes.position.array);
      const normals = Array.from(lathe.attributes.normal.array);
      // Continue cylindrical UVs across the front/back section boundaries.
      const uvs = [];
      for (let i = 0; i < lathe.attributes.position.count; i++) {
        uvs.push((start + lathe.attributes.uv.getX(i) * length) / TAU, lathe.attributes.position.getY(i) * .31);
      }
      const indices = Array.from(lathe.index.array);
      const sideCount = indices.length;
      const triangles = THREE.ShapeUtils.triangulateShape(pts, []);
      // Boundary outward normals point away from the retained angular sector.
      for (const [angle, sign] of [[start, -1], [start + length, 1]]) {
        const offset = positions.length / 3;
        const outward = V(Math.cos(angle) * sign, 0, -Math.sin(angle) * sign);
        for (const p of pts) {
          positions.push(Math.sin(angle) * p.x, p.y, Math.cos(angle) * p.x);
          normals.push(outward.x, outward.y, outward.z);
          uvs.push(p.x * .2, p.y * .31);
        }
        for (const tri of triangles) {
          const a = V().fromArray(positions, (offset + tri[0]) * 3);
          const b = V().fromArray(positions, (offset + tri[1]) * 3);
          const c = V().fromArray(positions, (offset + tri[2]) * 3);
          if (b.sub(a).cross(c.sub(a)).dot(outward) >= 0) indices.push(...tri.map(i => i + offset));
          else indices.push(offset + tri[0], offset + tri[2], offset + tri[1]);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.normalizeNormals();
      geometry.addGroup(0, sideCount, 0); geometry.addGroup(sideCount, indices.length - sideCount, 1);
      lathe.dispose(); return geometry;
    });
  }
  function roundedProfile(profile, radius = .08) {
    const smooth = [];
    for (let i = 0; i < profile.length; i++) {
      const previous = new THREE.Vector2(...profile[(i + profile.length - 1) % profile.length]);
      const point = new THREE.Vector2(...profile[i]), next = new THREE.Vector2(...profile[(i + 1) % profile.length]);
      const before = previous.clone().sub(point), after = next.clone().sub(point);
      const distance = Math.min(radius, before.length() * .28, after.length() * .28);
      const a = point.clone().add(before.normalize().multiplyScalar(distance));
      const b = point.clone().add(after.normalize().multiplyScalar(distance));
      for (let j = 0; j <= 3; j++) {
        const t = j / 3;
        smooth.push([a.x * (1 - t) ** 2 + point.x * 2 * t * (1 - t) + b.x * t * t,
          a.y * (1 - t) ** 2 + point.y * 2 * t * (1 - t) + b.y * t * t]);
      }
    }
    return smooth;
  }
  function radialBox(parent, size, angle, radius, y, material, cut = false) {
    const result = box(parent, ...size, material, Math.sin(angle) * radius, y, Math.cos(angle) * radius, cut);
    result.rotation.y = angle; return result;
  }
  function roundedPlate(parent, width, height, depth, material, x, y, z) {
    const geometry = cached(`plate:${width}:${height}:${depth}`, () => {
      const r = Math.min(width, height) * .1, w = width / 2, h = height / 2;
      const shape = new THREE.Shape(); shape.moveTo(-w + r, -h); shape.lineTo(w - r, -h);
      shape.quadraticCurveTo(w, -h, w, -h + r); shape.lineTo(w, h - r);
      shape.quadraticCurveTo(w, h, w - r, h); shape.lineTo(-w + r, h);
      shape.quadraticCurveTo(-w, h, -w, h - r); shape.lineTo(-w, -h + r);
      shape.quadraticCurveTo(-w, -h, -w + r, -h);
      return new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true,
        bevelThickness: .009, bevelSize: .009, bevelSegments: 1, curveSegments: 3 });
    });
    return mesh(parent, geometry, material, x, y, z - depth / 2);
  }
  function sectional(parent, profile, material, y = 0, frontCut = true) {
    if (!sectionMaterials.has(material)) sectionMaterials.set(material, [material, M.cut]);
    const materials = sectionMaterials.get(material);
    const back = mesh(parent, sectionGeometry(profile, CUT_END, TAU - (CUT_END - CUT_START)), materials, 0, y, 0);
    const front = mesh(parent, sectionGeometry(profile, CUT_START, CUT_END - CUT_START), materials, 0, y, 0, frontCut);
    return [back, front];
  }
  function band(parent, ri, ro, h, y, material, cut = true) {
    return sectional(parent, [[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2]], material, y, cut);
  }
  function bolts(parent, radius, y, count, size = .042, cutFront = true) {
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, normalized = a > Math.PI ? a - TAU : a;
      const cut = cutFront && normalized >= CUT_START && normalized <= CUT_END;
      cyl(parent, size * 1.35, .017, M.dark, Math.sin(a) * radius, y, Math.cos(a) * radius, 'y', cut, size * 1.35, 20);
      cyl(parent, size, .06, M.steel, Math.sin(a) * radius, y + .035, Math.cos(a) * radius, 'y', cut, size, 6);
    }
  }
  function pipe(parent, points, radius, material) {
    const path = new THREE.CatmullRomCurve3(points.map(p => V(...p)), false, 'centripetal');
    return mesh(parent, new THREE.TubeGeometry(path, points.length * 8, radius, 8, false), material);
  }
  function movingAssembly(parent, pivotY) {
    const pivot = new THREE.Group(); pivot.position.y = pivotY; parent.add(pivot); return pivot;
  }

  // Explode offsets are presentation spacing, not measured removal paths.
  // Keep the complete casting fixed. The intact shells stack above it;
  // internals fan out into left/right columns in the default (.52,.27,.85)
  // view. Spacing accounts for full-part bounds, including motor and hood.
  const frame = part('cone-frame', '银灰机体与承载底座', '现场照片可见银灰色宽鼓形机体、下部承载结构和设备标识。外形、曲面过渡与银灰铸造质感按实拍调整；程序化积尘仅表达表面质感，壁厚、内部承载肋和底部空间仍为教学示意，未根据制造图或现场尺寸测绘。', [-1.58, 2.06, .95], [0, 0, 0]);
  // The site machine has a broad lower casting, not the narrow vertical
  // cylindrical body of the earlier tabletop teaching model.
  for (const z of [-1.56, 1.56]) {
    box(frame, 4.34, .28, .34, M.silverShade, 0, .29, z);
    box(frame, 4.5, .075, .49, M.fieldSilver, 0, .09, z);
  }
  for (const x of [-1.87, 1.87]) {
    box(frame, .3, .3, 2.99, M.silverShade, x, .29, 0);
    for (const z of [-1.56, 1.56]) {
      box(frame, .61, .11, .65, M.fieldSilver, x, .13, z);
      for (const dx of [-.2, .2]) cyl(frame, .05, .06, M.steel, x + dx, .215, z, 'y', false, .05, 6);
    }
  }
  sectional(frame, roundedProfile([[1.33, .48], [1.86, .48], [2.04, .7], [2.13, 1.08], [2.1, 1.93], [1.94, 2.53], [1.83, 2.86], [1.35, 2.86], [1.35, .91], [1.33, .7]], .12), M.fieldSilver);
  band(frame, 1.69, 2.075, .13, .72, M.silverEdge);
  band(frame, 1.41, 1.99, .105, 2.72, M.silverEdge);
  bolts(frame, 1.91, .81, 28, .047);
  bolts(frame, 1.83, 2.79, 28, .048);
  // Low cast bosses and lifting ears are modest site-visible surface details.
  for (const a of [2.05, 2.95, 4.05, 5.15]) {
    const boss = box(frame, .17, .55, .15, M.silverShade, Math.sin(a) * 2.05, 1.32, Math.cos(a) * 2.05);
    boss.rotation.y = a;
    const ear = torus(frame, .095, .036, M.silverShade, Math.sin(a) * 1.94, 2.45, Math.cos(a) * 1.94, 'z');
    ear.rotation.y = a;
  }
  // A stepped lower rim and sparse bearing-boss supports add depth beneath
  // the casting. Their proportions remain schematic where the platform hides it.
  band(frame, 1.58, 1.89, .1, .46, M.silverShade);
  for (const a of [1.95, 3.28, 4.6, 5.92]) {
    const cut = a > 5.8;
    const gusset = radialBox(frame, [.12, .43, .42], a, 1.85, .58, M.fieldSilver, cut);
    gusset.rotation.x = -.2;
  }
  // Retained internal pedestal is intentionally distinct from the field shell.
  band(frame, .26, .62, .22, .77, M.dark, false);
  for (const a of [2.2, 3.45, 4.7]) {
    const rib = box(frame, .15, .43, 1.12, M.dark, Math.sin(a) * 1.12, .97, Math.cos(a) * 1.12);
    rib.rotation.y = a;
  }
  // An equipment identifier, not a fabricated manufacturer/specification plate.
  const plateRoot = new THREE.Group(); plateRoot.position.set(1.12, 1.43, 1.77); plateRoot.rotation.y = .56;
  plateRoot.userData.cutaway = true; frame.add(plateRoot);
  box(plateRoot, .82, .31, .035, M.dark, 0, 0, 0);
  box(plateRoot, .77, .26, .012, M.plate, 0, 0, .025);
  const glyphs = { C:['01110','10001','10000','10000','10000','10001','01110'], '3':['11110','00001','00001','01110','00001','00001','11110'], '0':['01110','10001','10011','10101','11001','10001','01110'] };
  [...'CC300'].forEach((letter, index) => glyphs[letter].forEach((row, j) => [...row].forEach((pixel, i) => {
    if (pixel === '1') box(plateRoot, .017, .017, .004, M.dark, -.28 + index * .12 + i * .018, .055 - j * .018, .034);
  })));
  for (const x of [-.35, .35]) for (const y of [-.1, .1]) cyl(plateRoot, .012, .012, M.steel, x, y, .039, 'z', false, .012, 8);

  const bowl = part('cone-bowl', '红色结合环与上部支承', '实拍可见银灰机体上方的红色环带、收口和上部支承。结合环外观按照片表达；剖面保留通用调整套与定锥支承关系。红色环带本身的具体机构形式不能仅凭照片确定。', [-1.44, 3.29, .58], [-.29, 2.05, -.47]);
  sectional(bowl, roundedProfile([[1.35, 2.8], [1.98, 2.8], [1.98, 3.02], [1.65, 3.17], [1.5, 3.78], [1.63, 4.08], [1.76, 4.29], [1.76, 4.4], [1.44, 4.4], [1.44, 3.08], [1.35, 3.08]], .095), M.fieldSilver);
  sectional(bowl, [[1.45, -.09], [2.005, -.09], [2.04, -.055], [2.04, .055], [2.005, .09], [1.45, .09]], M.fieldRed, 2.97);
  band(bowl, 1.45, 2.055, .045, 3.075, M.fieldRed);
  band(bowl, 1.82, 2.016, .014, 2.866, M.silverShade);
  band(bowl, 1.43, 1.78, .1, 4.38, M.silverEdge);
  // Internal adjustment threads remain generic and hidden by the intact shell.
  for (let i = 0; i < 8; i++) sectional(bowl, [[1.459, -.033], [1.495, 0], [1.459, .033]], M.silverShade, 3.32 + i * .105);
  bolts(bowl, 1.72, 4.45, 24, .039);
  bolts(bowl, 1.88, 3.12, 24, .047);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8, na = a > Math.PI ? a - TAU : a;
    const cut = na >= CUT_START && na <= CUT_END;
    // Short visible tie / fastening details; no unsupported hydraulic claim.
    cyl(bowl, .09, .36, M.fieldSilver, Math.sin(a) * 1.73, 3.27, Math.cos(a) * 1.73, 'y', cut, .105, 16);
    cyl(bowl, .07, .06, M.steel, Math.sin(a) * 1.73, 3.48, Math.cos(a) * 1.73, 'y', cut, .07, 6);
  }

  const hopper = part('cone-hopper', '双段给料罩与侧检修门', '现场设备上部为黑色双段筒状给料罩，带卷边接缝、侧检修门、铰链搭扣和偏置进料连接。外轮廓参考 IMG_7484；内部导料路径与壁厚仅为示意，检修门和前侧罩壳在剖视时移除，便于观察下方破碎腔。', [.79, 5.51, .82], [-.96, 4.11, -.72]);
  // Lower removable barrel and a slightly wider, taller upper cover reproduce
  // the recognisable dark two-stage silhouette in the actual workshop.
  sectional(hopper, [[1.49, 4.43], [1.6, 4.43], [1.6, 5.48], [1.49, 5.48]], M.hood);
  sectional(hopper, [[1.57, 5.48], [1.7, 5.48], [1.7, 6.72], [1.57, 6.72]], M.hood);
  band(hopper, 1.46, 1.68, .075, 4.46, M.hoodEdge);
  sectional(hopper, [[1.49, -.055], [1.69, -.055], [1.735, -.025], [1.735, .025], [1.7, .065], [1.62, .065], [1.62, .02], [1.49, .02]], M.hoodEdge, 5.49);
  band(hopper, 1.55, 1.705, .018, 5.557, M.rubber);
  band(hopper, 1.56, 1.73, .065, 6.73, M.hoodEdge);
  // The upper cover is deliberately sectionable as a separate solid piece.
  sectional(hopper, [[.04, 6.73], [1.7, 6.73], [1.64, 6.79], [.04, 6.82]], M.hood);
  bolts(hopper, 1.62, 4.51, 24, .034);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU, na = a > Math.PI ? a - TAU : a;
    const cut = na >= CUT_START && na <= CUT_END;
    const seam = box(hopper, .014, 1.15, .014, M.hoodEdge, Math.sin(a) * 1.704, 6.1, Math.cos(a) * 1.704, cut);
    seam.rotation.y = a;
    // Layered toggle catches: welded foot, hinge pin, lever and top keeper.
    radialBox(hopper, [.115, .26, .029], a, 1.625, 5.31, M.hoodEdge, cut);
    radialBox(hopper, [.07, .19, .05], a, 1.667, 5.35, M.silverShade, cut);
    radialBox(hopper, [.14, .055, .055], a, 1.675, 5.47, M.hoodEdge, cut);
    const pin = cyl(hopper, .022, .15, M.steel, Math.sin(a) * 1.68, 5.27, Math.cos(a) * 1.68, 'y', cut, .022, 12);
    pin.quaternion.setFromUnitVectors(V(0, 1, 0), V(Math.cos(a), 0, -Math.sin(a)));
    const eye = torus(hopper, .044, .009, M.silverShade, Math.sin(a) * 1.695, 5.43, Math.cos(a) * 1.695, 'z');
    eye.rotation.y = a; if (cut) eye.userData.cutaway = true;
  }
  for (const a of [.63, 3.54]) {
    const door = new THREE.Group(); door.position.set(Math.sin(a) * 1.607, 4.97, Math.cos(a) * 1.607); door.rotation.y = a;
    if (a >= CUT_START && a <= CUT_END) door.userData.cutaway = true;
    hopper.add(door);
    roundedPlate(door, .75, .82, .025, M.hoodEdge, 0, 0, 0);
    roundedPlate(door, .69, .76, .018, M.rubber, 0, 0, .025);
    roundedPlate(door, .65, .71, .04, M.hood, 0, 0, .052);
    for (const y of [-.24, .24]) {
      box(door, .13, .11, .05, M.silverShade, -.34, y, .077);
      cyl(door, .025, .145, M.steel, -.35, y, .109);
      for (const dy of [-.05, .05]) cyl(door, .035, .035, M.hoodEdge, -.35, y + dy, .109);
      for (const x of [-.385, -.295]) cyl(door, .014, .014, M.steel, x, y, .112, 'z', false, .014, 6);
    }
    box(door, .085, .27, .05, M.hoodEdge, .29, -.02, .096);
    const toggle = box(door, .21, .045, .055, M.steel, .25, .03, .135); toggle.rotation.z = -.18;
    cyl(door, .024, .022, M.dark, .335, .02, .171, 'z', false, .024, 12);
    pipe(door, [[.18, -.17, .11], [.12, -.12, .22], [.1, .06, .22], [.15, .11, .11]], .017, M.hoodEdge);
  }
  // A short offset feed connection expresses the visible side entry, without
  // reconstructing the unseen route of the site's complete conveyor chute.
  const feedConnection = new THREE.Group(); feedConnection.position.set(1.5, 6.12, -.54); feedConnection.rotation.z = .36; hopper.add(feedConnection);
  for (const y of [-.37, .37]) box(feedConnection, 1.16, .055, .86, M.hood, .53, y, 0);
  for (const z of [-.43, .43]) box(feedConnection, 1.16, .79, .055, M.hood, .53, 0, z);
  for (const y of [-.45, .45]) box(feedConnection, .09, .09, 1.04, M.hoodEdge, 1.09, y, 0);
  for (const z of [-.48, .48]) box(feedConnection, .09, .83, .09, M.hoodEdge, 1.09, 0, z);
  for (const y of [-.43, .43]) for (const z of [-.4, .4]) cyl(feedConnection, .03, .11, M.steel, 1.12, y, z, 'x', false, .03, 6);

  const concave = part('cone-concave', '定锥衬板与破碎腔', '耐磨定锥衬板固定在上部支承内，与动锥围成环形破碎腔。矿石由上向下运动，受到周期性挤压；底部较窄的间隙形成排料口。阶梯状衬板沿用教学模型参考，现场内部并未拍摄，实际齿形和腔型需按设备图纸确定。', [-.89, 3.56, -.57], [-5.06, 3.23, 2.07]);
  // The inner face opens toward the feed; narrow lower throat faces mantle.
  sectional(concave, [[1.28, 2.79], [1.46, 2.79], [1.44, 4.36], [1.17, 4.36], [1.17, 4.19], [1.21, 4.19], [1.21, 3.96], [1.23, 3.96], [1.23, 3.7], [1.245, 3.7], [1.245, 3.43], [1.26, 3.43], [1.26, 3.12], [1.28, 3.12]], M.bronze);
  for (let i = 0; i < 7; i++) band(concave, 1.185 + (6 - i) * .015, 1.39, .027, 2.97 + i * .195, M.brass);

  const mantle = part('cone-mantle', '动锥、破碎壁与锁紧帽', '偏心机构使动锥轴线作小角度旋摆，使破碎腔两侧交替靠近和远离定锥。矿石在靠近侧被挤压，随后向下排出。动画刻意放慢旋摆，动锥不作为螺杆绕自身轴线旋转。', [.4, 3.49, .45], [3.87, 3.59, -3.51]);
  const PIVOT_Y = 2.16;
  const headPivot = movingAssembly(mantle, PIVOT_Y);
  sectional(headPivot, [[.38, 2.7 - PIVOT_Y], [1.16, 2.7 - PIVOT_Y], [1.19, 2.81 - PIVOT_Y], [.26, 4.19 - PIVOT_Y], [.2, 4.19 - PIVOT_Y], [.24, 3.88 - PIVOT_Y], [.42, 3.42 - PIVOT_Y], [.73, 2.97 - PIVOT_Y], [.38, 2.97 - PIVOT_Y]], M.liner);
  // Replaceable outer manganese-steel mantle has a contrasting warm finish.
  sectional(headPivot, [[1.153, 2.82 - PIVOT_Y], [1.215, 2.81 - PIVOT_Y], [.29, 4.2 - PIVOT_Y], [.25, 4.19 - PIVOT_Y]], M.brass);
  cyl(headPivot, .25, .15, M.dark, 0, 4.22 - PIVOT_Y, 0, 'y', false, .29, 12);
  cyl(headPivot, .105, .035, M.steel, 0, 4.31 - PIVOT_Y, 0, 'y', false, .105, 6);
  band(headPivot, .23, .34, .11, 3.79 - PIVOT_Y, M.steel);
  band(headPivot, .5, .86, .12, 2.74 - PIVOT_Y, M.steel);

  const shaft = part('cone-shaft', '主轴与球面支承', '主轴和球面支承为动锥总成提供承载与摆动约束。示意展示中心轴、支承面和轴颈关系，不据此判定现场设备采用固定主轴或运动主轴结构；型号结构需由总装图核实。', [.18, 2.78, .16], [-3.95, 1.08, 2.07]);
  const shaftPivot = movingAssembly(shaft, PIVOT_Y);
  cyl(shaftPivot, .175, 2.35, M.steel, 0, 2.67 - PIVOT_Y, 0);
  cyl(shaftPivot, .213, .73, M.cut, 0, 2.61 - PIVOT_Y, 0);
  cyl(shaftPivot, .235, .13, M.dark, 0, 2.31 - PIVOT_Y, 0);
  cyl(shaftPivot, .218, .115, M.dark, 0, 3.09 - PIVOT_Y, 0);
  // A truncated spherical bearing expresses the support without obscuring it.
  const seat = mesh(shaft, new THREE.SphereGeometry(.61, 48, 16, 0, TAU, .13, .5), M.bronze, 0, 1.68, 0);
  seat.scale.y = .72;
  band(shaft, .25, .59, .17, 2.025, M.steel);
  band(shaft, .29, .65, .13, 1.92, M.deep);

  const eccentric = part('cone-eccentric', '偏心套与下部轴承', '下部偏心套由大锥齿轮驱动，偏心轴线把连续回转转换成动锥的周期性旋摆。剖面以偏置内孔和金属衬套表达这一运动关系，固定支承与旋转套分开显示。', [.44, 1.59, .3], [-3.76, -.23, 2.38]);
  const eccentricRotor = new THREE.Group(); eccentricRotor.position.y = 1.5; eccentric.add(eccentricRotor);
  band(eccentricRotor, .3, .49, .88, 0, M.bronze);
  band(eccentricRotor, .3, .54, .12, -.39, M.brass);
  const offsetBushing = new THREE.Group(); offsetBushing.position.set(.054, 0, 0); eccentricRotor.add(offsetBushing);
  band(offsetBushing, .188, .291, .84, 0, M.steel);
  // Quiet vertical witness strip makes eccentric rotation visible in a cut.
  box(eccentricRotor, .024, .48, .03, M.brass, 0, .04, -.497);
  band(eccentric, .49, .6, .1, 1.85, M.dark);
  band(eccentric, .49, .63, .1, 1.13, M.dark);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    cyl(eccentric, .034, .09, M.steel, Math.sin(a) * .566, 1.81, Math.cos(a) * .566, 'y', false, .034, 10);
  }

  const gear = part('cone-drive', '下部电机与锥齿轮传动', '现场照片可见下方电机与传动区域，模型补入银灰电机和风罩轮廓。内部采用电机经横轴、小锥齿轮驱动偏心套的通用关系；传动布置、齿数和减速比未按现场总装图校准。', [2.8, 1.35, .16], [4.21, .21, -2.64]);
  const bevelRotor = new THREE.Group(); bevelRotor.position.y = 1.055; gear.add(bevelRotor);
  // Lower large bevel wheel and upper sloping tooth crown.
  band(bevelRotor, .28, .88, .16, 0, M.steel, false);
  sectional(bevelRotor, [[.48, .08], [.94, .08], [.72, .28], [.48, .28]], M.brass, 0, false);
  const bevelTeeth = new THREE.Group(); bevelRotor.add(bevelTeeth);
  for (let i = 0; i < 52; i++) {
    const a = i / 52 * TAU;
    const tooth = box(bevelTeeth, .054, .089, .17, M.brass, Math.sin(a) * .85, .185, Math.cos(a) * .85);
    tooth.rotation.set(-.39 * Math.cos(a), a, .39 * Math.sin(a));
  }
  bolts(bevelRotor, .47, -.11, 14, .037, false);
  const pinionRotor = new THREE.Group(); pinionRotor.position.set(.96, 1.24, 0); gear.add(pinionRotor);
  cyl(pinionRotor, .225, .25, M.bronze, 0, 0, 0, 'x', false, .135, 32);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU;
    const tooth = box(pinionRotor, .19, .046, .073, M.brass, 0, Math.sin(a) * .198, Math.cos(a) * .198);
    tooth.rotation.x = -a;
  }
  const driveShaft = new THREE.Group(); driveShaft.position.set(1.83, 1.24, 0); gear.add(driveShaft);
  cyl(driveShaft, .105, 1.86, M.steel, 0, 0, 0, 'x');
  cyl(driveShaft, .2, .14, M.dark, .81, 0, 0, 'x');
  cyl(driveShaft, .22, .065, M.brass, .9, 0, 0, 'x');
  box(driveShaft, .34, .035, .055, M.brass, .22, .103, 0);
  for (const x of [1.62, 2.28]) {
    box(gear, .38, .15, .55, M.silverShade, x, .72, 0);
    box(gear, .27, .32, .38, M.fieldSilver, x, .95, 0);
    cyl(gear, .25, .31, M.fieldSilver, x, 1.24, 0, 'x');
    cyl(gear, .156, .34, M.dark, x, 1.24, 0, 'x');
    for (const z of [-.21, .21]) cyl(gear, .035, .055, M.steel, x, .825, z, 'y', false, .035, 6);
  }
  box(gear, 2.85, .15, 1.02, M.silverShade, 2.75, .49, 0);
  for (const x of [1.62, 2.5]) box(gear, .16, .2, .54, M.dark, x, .64, 0);
  // Removable short drive cover and flange ahead of the lower motor.
  const cover = cyl(gear, .315, .58, M.silverShade, 2.49, 1.24, 0, 'x', true);
  cover.name = '横轴护罩';
  cyl(gear, .338, .065, M.fieldSilver, 2.72, 1.24, 0, 'x', true);

  // Site-visible lower motor: finned housing, a pale fan guard and mounting
  // feet. Its size and alignment are illustrative rather than surveyed.
  cyl(gear, .105, .28, M.steel, 2.86, 1.24, 0, 'x');
  cyl(gear, .41, .9, M.fieldSilver, 3.38, 1.24, 0, 'x');
  for (const x of [2.96, 3.8]) cyl(gear, .465, .09, M.silverEdge, x, 1.24, 0, 'x');
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * TAU;
    const fin = box(gear, .73, .064, .026, M.silverShade, 3.38, 1.24 + Math.sin(a) * .428, Math.cos(a) * .428);
    fin.rotation.x = Math.PI / 2 - a;
  }
  cyl(gear, .43, .19, M.silverShade, 3.92, 1.24, 0, 'x');
  cyl(gear, .37, .025, M.dark, 4.025, 1.24, 0, 'x');
  torus(gear, .389, .034, M.fieldSilver, 4.05, 1.24, 0, 'x');
  for (let i = -14; i <= 14; i++) {
    const d = i * .024, chord = Math.sqrt(.354 * .354 - d * d) * 2;
    const bow = .024 * (1 - d * d / (.354 * .354));
    const horizontal = box(gear, .012, .007, 1, M.silverEdge, 4.051 + bow, 1.24 + d, 0);
    horizontal.scale.z = chord;
    const vertical = box(gear, .012, 1, .007, M.silverEdge, 4.061 + bow, 1.24, d);
    vertical.scale.y = chord;
  }
  cyl(gear, .11, .025, M.silverShade, 4.077, 1.24, 0, 'x');
  for (const x of [3.07, 3.67]) {
    box(gear, .19, .3, .56, M.silverShade, x, .72, 0);
    box(gear, .34, .08, .91, M.fieldSilver, x, .59, 0);
    for (const z of [-.36, .36]) cyl(gear, .036, .055, M.steel, x, .66, z, 'y', false, .036, 6);
  }
  box(gear, .36, .21, .32, M.fieldSilver, 3.3, 1.76, .1);
  pipe(gear, [[3.3, 1.76, .27], [3.26, 1.56, .44], [3.12, .9, .53], [2.8, .64, .52]], .021, M.rubber);

  const lubrication = part('cone-lubrication', '润滑油路与密封', '压力润滑油进入轴承和偏心套接触面，带走摩擦热后回流。密封限制粉尘进入。细铜管用于说明供油与回油关系，实际油站、监测点和管路布置待现场资料确认。', [-.6, 1.4, .66], [4.29, 2.59, -3.45]);
  pipe(lubrication, [[-.13, .87, .3], [-.31, 1.12, .34], [-.56, 1.42, .4], [-.61, 1.98, .46]], .033, M.brass);
  pipe(lubrication, [[-.35, .74, .4], [-.68, .65, .55], [-1.23, .72, .81], [-1.57, .86, .81]], .05, M.bronze);
  cyl(lubrication, .095, .11, M.brass, -.61, 1.94, .46, 'y', false, .095, 6);
  cyl(lubrication, .09, .12, M.steel, -1.55, .86, .81, 'x', false, .09, 6);
  band(lubrication, .67, .85, .07, 2.26, M.rubber);
  band(lubrication, .74, .89, .035, 2.33, M.steel);

  // Instance repeated hardware per public part and per moving subassembly.
  // Never combine across a cutaway boundary or across different motions.
  function instanceRepeated(root) {
    const batches = new Map();
    for (const child of [...root.children]) {
      if (child.isGroup) instanceRepeated(child);
      if (!child.isMesh || child.isInstancedMesh) continue;
      const materialKey = Array.isArray(child.material) ? child.material.map(m => m.uuid).join(':') : child.material.uuid;
      const key = `${child.geometry.uuid}:${materialKey}:${!!child.userData.cutaway}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(child);
    }
    for (const siblings of batches.values()) {
      if (siblings.length < 2) continue;
      const first = siblings[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, siblings.length);
      batch.castShadow = true; batch.receiveShadow = true;
      batch.userData = { ...first.userData }; batch.name = '紧固件与重复构件';
      siblings.forEach((child, index) => { child.updateMatrix(); batch.setMatrixAt(index, child.matrix); root.remove(child); });
      batch.computeBoundingBox(); batch.computeBoundingSphere(); root.add(batch);
    }
  }
  parts.forEach(p => instanceRepeated(p.root));
  let elapsed = 0;
  function update(delta) {
    elapsed += Math.min(Math.max(delta, 0), .08);
    const phase = elapsed * .95;
    // A rotating tilt vector describes gyration. There is no axial spin of
    // the mantle, and the fixed concave/bowl never moves with the rotor.
    headPivot.rotation.set(Math.sin(phase) * .027, 0, Math.cos(phase) * .027);
    shaftPivot.rotation.copy(headPivot.rotation);
    bevelRotor.rotation.y = -phase;
    eccentricRotor.rotation.y = -phase;
    pinionRotor.rotation.x = phase * 52 / 14;
    driveShaft.rotation.x = pinionRotor.rotation.x;
  }
  group.userData.partIds = parts.map(p => p.id);
  group.userData.description = 'CC300 圆锥破碎机 · 银灰机体、红色环带与黑色给料罩依据现场照片；内部沿用通用原理示意，非测绘或制造图';
  // Presentation chapters only: the unseen internals are generic teaching
  // geometry and these stages must not be read as maintenance instructions.
  const explosionSteps = [
    { title: '给料外壳', description: '黑色给料罩位于红环支承上方，本阶段展开两层外壳，展示给料口与破碎腔的上下关系。', parts: ['cone-hopper', 'cone-bowl'] },
    { title: '动定锥配合', description: '定锥与动锥向两侧展开，便于对照两者围成破碎腔、交替靠近与分离的关系。', parts: ['cone-concave', 'cone-mantle'] },
    { title: '承载与偏心', description: '通用原理示意中，主轴及球面支承约束动锥，偏心套使其产生周期性旋摆。', parts: ['cone-shaft', 'cone-eccentric'] },
    { title: '动力与油路', description: '通用原理示意中，电机与锥齿轮提供动力，润滑油路服务于轴承和偏心接触面。', parts: ['cone-drive', 'cone-lubrication'] },
  ];
  return { group, parts, update, explosionSteps };
}
