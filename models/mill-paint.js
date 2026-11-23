import * as THREE from 'three';

// A small seamless finish shared by all three painted drums. Grime stays
// in the paint's UV coordinates as the drum rotates; no external texture.
let finish;
export function drumPaintFinish() {
  if (finish) return finish;
  const w = 384, h = 256, data = new Uint8Array(w * h * 4);
  let seed = 23;
  function random() { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }
  const marks = new Float32Array(w * h);
  for (let i = 0; i < 320; i++) {
    const u = Math.floor(random()*w), v = Math.floor(random()*h);
    const length = 1 + Math.floor(random()**3*17), depth = 6 + random()*34;
    for (let j = 0; j < length; j++) {
      const k = ((v + j) % h) * w + u;
      marks[k] = Math.max(marks[k], depth * (1 - j/length));
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, wave = Math.sin(x/w*Math.PI*18 + Math.sin(y/h*Math.PI*4));
    const tone = 246 + wave*2 + random()*6 - marks[k];
    data.set([tone, tone, tone, 255], k*4);
  }
  finish = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  finish.name = '筒体漆面细擦痕'; finish.colorSpace = THREE.SRGBColorSpace;
  finish.wrapS = finish.wrapT = THREE.RepeatWrapping;
  finish.magFilter = THREE.LinearFilter; finish.minFilter = THREE.LinearMipmapLinearFilter;
  finish.generateMipmaps = true; finish.needsUpdate = true;
  return finish;
}
