import * as THREE from 'three';
import { PLANT_EDGES, PLANT_NODES } from './plant-flow.js';

const edgeKey = edge => `${edge.from}>${edge.to}`;
const sourceEdges = new Map(PLANT_EDGES.map(edge => [edgeKey(edge), edge]));
const sourceNodes = new Map(PLANT_NODES.map(node => [node.id, node]));
const GOLD = 0xf0c77b, CYAN = 0x76d7e5, GREEN = 0x73b6a4;
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const noRaycast = () => {};

// Requested routes must match confirmed source evidence and a route already
// drawn in this view. Neither copies nor a tour can promote provisional edges.
export function selectTourLinks(links, requested = []) {
  const available = new Map(links.map(link => [edgeKey(link.edge), link]));
  const seen = new Set(), selected = [], rejected = [];
  for (const request of requested) {
    const key = edgeKey(request), source = sourceEdges.get(key), link = available.get(key);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!source || source.uncertain || request.uncertain || !link || link.edge.uncertain || link.edge.kind !== source.kind || (request.kind && request.kind !== source.kind)) rejected.push(key);
    else selected.push(link);
  }
  return { selected, rejected };
}

export function tourMediumForEdge(edge) {
  if (edgeKey(edge) === 'filter-press>concentrate-storage') return 'cake';
  if (edge.kind === 'water') return 'water';
  if (['hopper', 'crusher', 'screen', 'cone'].includes(sourceNodes.get(edge.from)?.type)) return 'ore';
  return 'slurry';
}

// The overlay owns its materials and geometry. Equipment meshes, their shared
// materials, picking IDs, and original camera/label bounds remain untouched.
export function createTourHighlight() {
  const group = new THREE.Group();
  group.name = '全流程演示 · 当前设备与物料';
  group.visible = false;
  group.userData.labelObstacle = false;
  let nodeObjects = new Map(), primaryNodeId = null, focusedBounds = null;
  let selected = [], halos = [], materialSwaps = [], visibilitySwaps = [];
  let progress = 0, time = 0, totalLength = 0, disposed = false;
  const up = new THREE.Vector3(0, 1, 0);

  function ignore(mesh) {
    mesh.userData.labelObstacle = false;
    mesh.raycast = noRaycast;
    return mesh;
  }
  function rememberMaterial(object, active) {
    if (!object.material) return;
    const original = object.material;
    const clones = (Array.isArray(original) ? original : [original]).map(material => {
      const copy = material.clone();
      copy.transparent = true;
      copy.opacity = Math.min(material.opacity, active ? .3 : .12);
      copy.depthWrite = false;
      return copy;
    });
    const replacement = Array.isArray(original) ? clones : clones[0];
    object.material = replacement;
    materialSwaps.push({ object, original, replacement, clones });
  }
  function clear() {
    for (const { object, original, replacement, clones } of materialSwaps) {
      if (object.material === replacement) object.material = original;
      clones.forEach(material => material.dispose());
    }
    for (const { object, visible } of visibilitySwaps) object.visible = visible;
    const geometries = new Set(), materials = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    group.clear(); group.visible = false;
    materialSwaps = []; visibilitySwaps = []; selected = []; halos = [];
    primaryNodeId = null; focusedBounds = null; nodeObjects = new Map(); totalLength = 0; progress = 0;
    group.userData = { labelObstacle: false, activeNodeIds: [], selectedEdgeKeys: [], rejectedEdgeKeys: [], primaryNodeId: null };
  }

  function setFocus({ nodeIds = [], primaryNodeId: primary = nodeIds[0], edges = [] } = {}, context = {}) {
    if (disposed) return { activeNodeIds: [], selectedEdgeKeys: [], rejectedEdgeKeys: [] };
    clear();
    nodeObjects = context.nodeObjects || new Map();
    const activeNodeIds = [...new Set([...nodeIds, primary].filter(id => id && nodeObjects.has(id)))];
    const activeNodeSet = new Set(activeNodeIds);
    primaryNodeId = activeNodeIds.includes(primary) ? primary : activeNodeIds[0] || null;
    const validation = selectTourLinks(context.links || [], edges);
    const selectedKeys = new Set(validation.selected.map(link => edgeKey(link.edge)));
    focusedBounds = new THREE.Box3();
    for (const id of activeNodeIds) {
      const holder = nodeObjects.get(id);
      holder.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(holder), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      focusedBounds.union(box);
      const primary = id === primaryNodeId;
      const ring = ignore(new THREE.Mesh(new THREE.RingGeometry(.94, 1, 72), new THREE.MeshBasicMaterial({ color: primary ? GOLD : GREEN, transparent: true, opacity: primary ? .85 : .4, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })));
      ring.name = primary ? '当前设备光环' : '关联设备光环';
      ring.userData.nodeId = id;
      ring.rotation.x = -Math.PI / 2;
      ring.scale.set(Math.max(1.5, size.x / 2 + .32), Math.max(1.5, size.z / 2 + .32), 1);
      ring.position.set(center.x, Math.max(-.07, box.min.y + .08), center.z);
      group.add(ring); halos.push({ ring, primary });
      if (primary) {
        const outer = ignore(new THREE.Mesh(new THREE.RingGeometry(.985, 1, 72), ring.material.clone()));
        outer.name = '当前设备外环'; outer.userData.nodeId = id;
        outer.position.copy(ring.position); outer.rotation.copy(ring.rotation); outer.scale.copy(ring.scale).multiplyScalar(1.12);
        group.add(outer); halos.push({ ring: outer, primary, outer: true });
      }
    }
    // A tour shot isolates the current operation. Cropped neighboring models
    // disappear while their faint routes retain orientation; normal overview
    // visibility is restored exactly when the shot ends or the view changes.
    for (const [id, holder] of nodeObjects) {
      if (activeNodeSet.has(id)) continue;
      visibilitySwaps.push({ object: holder, visible: holder.visible }); holder.visible = false;
    }
    for (const link of context.links || []) {
      for (const object of link.contextObjects || (link.line ? [link.line] : [])) object.traverse(child => rememberMaterial(child, selectedKeys.has(edgeKey(link.edge))));
    }
    for (const object of context.motionLayers || []) {
      visibilitySwaps.push({ object, visible: object.visible }); object.visible = false;
    }
    for (const link of validation.selected) {
      const length = link.curve.getLength();
      if (length < 1e-5) continue;
      const medium = tourMediumForEdge(link.edge), color = medium === 'water' ? CYAN : GOLD;
      const points = link.curve.getPoints(72);
      for (const point of points) focusedBounds.expandByPoint(point);
      const path = ignore(new THREE.Mesh(new THREE.TubeGeometry(link.curve, 72, medium === 'ore' || medium === 'cake' ? .035 : .062, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: medium === 'ore' || medium === 'cake' ? .46 : .63, depthWrite: false, toneMapped: false })));
      path.name = '当前物料路径'; path.userData.edgeKey = edgeKey(link.edge); path.userData.medium = medium;
      group.add(path);
      const arrowCount = Math.max(1, Math.min(5, Math.ceil(length / 5)));
      for (let i = 0; i < arrowCount; i++) {
        const at = (i + .65) / (arrowCount + .3);
        const arrow = ignore(new THREE.Mesh(new THREE.ConeGeometry(.14, .48, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .88, depthWrite: false, toneMapped: false })));
        arrow.name = '演示方向箭头'; arrow.userData.edgeKey = edgeKey(link.edge);
        arrow.position.copy(link.curve.getPointAt(at)); arrow.quaternion.setFromUnitVectors(up, link.curve.getTangentAt(at).normalize());
        group.add(arrow);
      }
      const geometry = medium === 'cake' ? new THREE.BoxGeometry(.44, .25, .32) : medium === 'ore' ? new THREE.OctahedronGeometry(.23, 0) : new THREE.SphereGeometry(.18, 12, 8);
      const marker = ignore(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: medium === 'cake' ? 0xdec58f : color, toneMapped: false })));
      marker.name = medium === 'ore' ? '原矿颗粒' : medium === 'cake' ? '精矿滤饼块' : medium === 'water' ? '回水流动标记' : '矿浆流动标记';
      marker.userData.edgeKey = edgeKey(link.edge); marker.userData.medium = medium;
      group.add(marker);
      selected.push({ link, length, start: totalLength, marker }); totalLength += length;
    }
    if (focusedBounds.isEmpty()) focusedBounds = null;
    group.visible = activeNodeIds.length > 0 || selected.length > 0;
    group.userData = { labelObstacle: false, activeNodeIds, primaryNodeId, selectedEdgeKeys: selected.map(entry => edgeKey(entry.link.edge)), rejectedEdgeKeys: validation.rejected };
    setProgress(0); update(time);
    return info();
  }
  function routeAt(value) {
    if (!selected.length) return null;
    const distance = clamp(value) * totalLength;
    const entry = selected.find(item => distance < item.start + item.length) || selected.at(-1);
    return { entry, at: clamp((distance - entry.start) / entry.length) };
  }
  function position(value = progress) {
    const route = routeAt(value);
    if (route) return route.entry.link.curve.getPointAt(route.at);
    const primary = nodeObjects.get(primaryNodeId);
    return primary ? new THREE.Box3().setFromObject(primary).getCenter(new THREE.Vector3()) : focusedBounds?.getCenter(new THREE.Vector3()) || null;
  }
  function setProgress(value) {
    progress = clamp(value);
    const route = routeAt(progress);
    for (const entry of selected) {
      entry.marker.visible = entry === route?.entry;
      if (!entry.marker.visible) continue;
      entry.marker.position.copy(entry.link.curve.getPointAt(route.at));
      entry.marker.quaternion.setFromUnitVectors(up, entry.link.curve.getTangentAt(route.at).normalize());
    }
  }
  function update(nextTime) {
    time = Number.isFinite(nextTime) ? nextTime : time;
    for (const { ring, primary, outer } of halos) ring.material.opacity = primary ? (outer ? .3 : .7) + Math.sin(time * 2.2) * .1 : .3;
    // Route markers depend solely on explicit stage progress, never wall time.
  }
  function info() {
    return { ...group.userData, activeNodeIds: [...group.userData.activeNodeIds], selectedEdgeKeys: [...group.userData.selectedEdgeKeys], rejectedEdgeKeys: [...group.userData.rejectedEdgeKeys] };
  }
  function bounds() { return focusedBounds?.clone().expandByScalar(.6) || null; }
  function dispose() { if (disposed) return; clear(); group.removeFromParent(); disposed = true; }
  clear();
  return { group, setFocus, clear, setProgress, position, bounds, update, dispose, get info() { return info(); } };
}
