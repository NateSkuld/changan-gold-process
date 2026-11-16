import * as THREE from 'three';

export const EXPLOSION_COLORS = [0xd6b378, 0x76b6ab, 0x83b7d8, 0xd79972];
export const clampProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

// Steps describe visual relationships, not a maintenance procedure.
export function explosionPlan(model) {
  const moving = model.parts.filter(part => part.explode.lengthSq() > 1e-8);
  const remaining = new Set(model.parts.map(part => part.id));
  const steps = [];
  for (const step of model.explosionSteps || []) {
    const ids = step.parts.filter(id => remaining.delete(id));
    if (ids.length) steps.push({...step, parts:ids});
  }
  if (remaining.size) {
    const parts = moving.filter(part => remaining.has(part.id));
    const size = Math.max(1, Math.ceil(parts.length / 4));
    for (let i = 0; i < parts.length; i += size) {
      const batch = parts.slice(i, i + size);
      steps.push({title:batch[0].name, description:batch.map(p => p.name).join('、') + '：观察它们与主体的装配位置。', parts:batch.map(p => p.id)});
    }
  }
  return steps;
}

export function stepAmount(progress, index, count) {
  const t = clampProgress(clampProgress(progress) * count - index);
  return t * t * (3 - 2 * t);
}

export function applyExplosionPose(model, steps, progress) {
  for (const part of model.parts) {
    const index = steps.findIndex(step => step.parts.includes(part.id));
    const amount = index < 0 ? 0 : stepAmount(progress, index, steps.length);
    part.root.position.copy(part.base).addScaledVector(part.explode, amount);
  }
}

export function explosionEnvelope(model) {
  model.group.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  for (const part of model.parts) {
    const box = new THREE.Box3().setFromObject(part.root);
    const origin = part.root.position.clone();
    const base = (part.base || origin).clone();
    const end = base.clone().add(part.explode);
    if (part.root.parent) {
      origin.applyMatrix4(part.root.parent.matrixWorld);
      base.applyMatrix4(part.root.parent.matrixWorld);
      end.applyMatrix4(part.root.parent.matrixWorld);
    }
    bounds.union(box.clone().translate(base.sub(origin)));
    bounds.union(box.translate(end.sub(origin)));
  }
  return bounds;
}

// Faint dashed routes connect original mount points to separated components.
// They live outside part roots, are not pickable, and never become label obstacles.
export function createExplosionGuides(model, steps) {
  const group = new THREE.Group();
  group.name = '装配位置引导';
  const geometry = new THREE.ConeGeometry(.055, .2, 8);
  const entries = [];
  for (const part of model.parts) {
    if (part.explode.lengthSq() < 1e-8) continue;
    const index = Math.max(0, steps.findIndex(step => step.parts.includes(part.id)));
    const color = EXPLOSION_COLORS[index % EXPLOSION_COLORS.length];
    const positions = new Float32Array(6);
    const path = new THREE.BufferGeometry();
    path.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    path.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1));
    const material = new THREE.LineDashedMaterial({color, dashSize:.14, gapSize:.12, transparent:true, opacity:.38, depthWrite:false});
    const line = new THREE.Line(path, material);
    const head = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color, transparent:true, opacity:.65, depthWrite:false}));
    head.userData.labelObstacle = false;
    line.raycast = head.raycast = () => {};
    group.add(line, head);
    entries.push({part, index, line, head, positions, lastLength:-1});
  }
  model.group.add(group);
  const up = new THREE.Vector3(0, 1, 0), end = new THREE.Vector3(), direction = new THREE.Vector3();
  return {
    group,
    update(activeIndex, enabled = true) {
      group.visible = enabled;
      if (!enabled) return;
      for (const item of entries) {
        const {part, index, line, head, positions} = item;
        direction.copy(part.root.position).sub(part.base);
        const length = direction.length();
        line.visible = head.visible = length > .22;
        if (!line.visible) continue;
        line.material.opacity = index === activeIndex ? .55 : .2;
        head.material.opacity = index === activeIndex ? .8 : .3;
        if (Math.abs(length - item.lastLength) < 1e-6) continue;
        item.lastLength = length;
        end.copy(part.anchor).add(direction);
        part.anchor.toArray(positions, 0); end.toArray(positions, 3);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.attributes.lineDistance.array[1] = length;
        line.geometry.attributes.lineDistance.needsUpdate = true;
        line.geometry.computeBoundingSphere();
        head.position.copy(part.anchor).addScaledVector(direction, .7);
        head.quaternion.setFromUnitVectors(up, direction.normalize());
      }
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      for (const {line, head} of entries) {
        line.geometry.dispose(); line.material.dispose(); head.material.dispose();
      }
    }
  };
}
