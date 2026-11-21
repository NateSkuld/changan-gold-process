import * as THREE from 'three';

// One moulded panel in local coordinates. The same closed mesh is repeated
// round the drum, so the lift bars, seams and cut edges survive explosion.
// Profile and panel count are illustrative, read from IMG_7682/IMG_7683.
export function rubberPanelGeometry({ pitch, length, endSide = 0 }) {
  // t is a fraction of a panel pitch; h is an inward projection. Rounded
  // shoulders and a broad crown catch grazing light like the photographed bars.
  const profile = [[-.489, .003], [-.45, .008], [-.38, .008], [-.33, .018],
    [-.28, .067], [-.23, .115], [-.17, .131], [-.10, .132], [-.055, .12],
    [.005, .074], [.058, .025], [.10, .012], [.22, .008], [.39, .005], [.489, .002]];
  const along = [0, .016, .044, .50, .956, .984, 1];
  const positions = [], indices = [];
  function vertex(u, v, front) {
    const [t, h] = profile[v];
    const a = t * pitch, f = along[u];
    const bevel = u === 0 || u === along.length - 1 ? .80 : (u === 1 || u === along.length - 2 ? .97 : 1);
    let x, r;
    if (endSide) {
      r = .375 + f * .714;
      // The photographed fan of plates tapers into an open annular collar.
      const face = 2.095 + (1 - f) * .115;
      x = endSide * (front ? face - h * (.57 + .4 * f) * bevel : face + .047);
    } else {
      x = length * (f - .5);
      r = front ? 1.083 - h * bevel : 1.143;
    }
    return [x, Math.sin(a) * r, Math.cos(a) * r];
  }
  const cols = profile.length, rows = along.length, layer = rows * cols;
  for (const front of [true, false])
    for (let u = 0; u < rows; u++)
      for (let v = 0; v < cols; v++) positions.push(...vertex(u, v, front));
  const flip = endSide <= 0;
  function quad(a, b, c, d, reverse = flip) {
    if (reverse) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  }
  for (let u = 0; u < rows - 1; u++) for (let v = 0; v < cols - 1; v++) {
    const a = u * cols + v, b = a + cols, c = b + 1, d = a + 1;
    quad(a, b, c, d);
    quad(a + layer, b + layer, c + layer, d + layer, !flip);
  }
  function edge(a, b) {
    // Duplicate edge vertices to keep the seam crisp where two plates meet.
    const k = positions.length / 3;
    for (const i of [b, a, a + layer, b + layer]) positions.push(...positions.slice(i * 3, i * 3 + 3));
    quad(k, k + 1, k + 2, k + 3);
  }
  for (let u = 0; u < rows - 1; u++) {
    edge(u * cols, (u + 1) * cols);
    edge((u + 2) * cols - 1, (u + 1) * cols - 1);
  }
  for (let v = 0; v < cols - 1; v++) {
    edge(v + 1, v);
    edge((rows - 1) * cols + v, (rows - 1) * cols + v + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
