/** Minimum clear distance between label rectangles, and from obstacles. */
export const LABEL_GAP = 8;
const PADDING = LABEL_GAP / 2;
const MAX_VISIBLE_LABELS = 64;
const MAX_OBSTACLE_SEEDS = 8;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function validRect(rect) {
  return rect && ['left', 'top', 'right', 'bottom'].every(key => finite(rect[key]))
    && finite(rect.right - rect.left) && finite(rect.bottom - rect.top)
    && rect.right > rect.left && rect.bottom > rect.top;
}

function paddedRect(x, y, width, height) {
  return { left: x - width / 2 - PADDING, top: y - height / 2 - PADDING,
    right: x + width / 2 + PADDING, bottom: y + height / 2 + PADDING };
}

/** Project a 3D box through a column-major view-projection matrix.
 * Near/far clipping keeps boxes crossing the camera plane finite. Only the
 * eight box corners and twelve edges are inspected, never geometry vertices.
 * The returned rectangle is clipped to the viewport; offscreen boxes return null.
 */
export function projectBoundsToScreen(box, matrix, width, height) {
  if (!box?.min || !box?.max || !matrix || matrix.length !== 16
    || ![width, height, ...matrix].every(finite) || width <= 0 || height <= 0) return null;
  const lo = box.min, hi = box.max;
  if (!['x', 'y', 'z'].every(axis => finite(lo[axis]) && finite(hi[axis]) && lo[axis] <= hi[axis])) return null;
  const points = [];
  for (const z of [lo.z, hi.z]) for (const y of [lo.y, hi.y]) for (const x of [lo.x, hi.x]) {
    points.push([matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
      matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
      matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
      matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]]);
  }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  function include(point) {
    if (point[3] <= 0) return;
    const x = (point[0] / point[3] * .5 + .5) * width;
    const y = (.5 - point[1] / point[3] * .5) * height;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  // Clip each edge against z + w >= 0 and w - z >= 0.
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) {
    if (i & bit) continue;
    const a = points[i], b = points[i | bit];
    let start = 0, end = 1;
    for (const sign of [1, -1]) {
      const da = a[3] + sign * a[2], db = b[3] + sign * b[2];
      if (da < 0 && db < 0) { end = -1; break; }
      if (da < 0) start = Math.max(start, da / (da - db));
      if (db < 0) end = Math.min(end, da / (da - db));
    }
    if (start > end) continue;
    for (const t of [start, end]) include(a.map((value, axis) => value + (b[axis] - value) * t));
  }
  const rect = { left: Math.max(0, left), top: Math.max(0, top),
    right: Math.min(width, right), bottom: Math.min(height, bottom) };
  return validRect(rect) ? rect : null;
}

/**
 * Place screen-space labels without DOM reads or retained state.
 *
 * items: { id, x, y, width, height, priority?, compact? }[]
 * bounds / obstacles: { left, top, right, bottom } in the same pixel space.
 * Returns { id, x, y, hidden }[] in the original input order. x/y are centers.
 * Higher priorities are placed first; ties preserve input order. Invalid or
 * zero-size measurements are hidden, never replaced by guessed dimensions.
 * The caller should measure hidden DOM labels offscreen, or reuse measurements.
 *
 * Each label reserves 4px on all sides, which must fit inside bounds. Obstacles
 * reserve the same padding: visible labels have >=8px separation from labels
 * and obstacles. Touching reserved edges is allowed. Invalid obstacles are
 * ignored. Unique string/number ids are required; later duplicate ids are hidden.
 *
 * Search is bounded: <=169 grid +32 obstacle +8 viewport-edge candidates per label,
 * with at most 64 labels placed. No backtracking or random placement is used.
 */
export function layoutLabels(items, bounds, obstacles = []) {
  if (!Array.isArray(items)) return [];
  const result = items.map(item => ({ id: item?.id,
    x: finite(item?.x) ? item.x : 0, y: finite(item?.y) ? item.y : 0, hidden: true }));
  if (!validRect(bounds)) return result;

  const blocked = (Array.isArray(obstacles) ? obstacles : []).filter(validRect).map(rect => ({
    left: rect.left - PADDING, top: rect.top - PADDING,
    right: rect.right + PADDING, bottom: rect.bottom + PADDING,
  })).filter(validRect);
  const seenIds = new Set();
  const ordered = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item || !['string', 'number'].includes(typeof item.id) || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    if (typeof item.id === 'number' && !finite(item.id)) continue;
    if (![item.x, item.y, item.width, item.height].every(finite) || item.width <= 0 || item.height <= 0) continue;
    if (item.width + LABEL_GAP > bounds.right - bounds.left
      || item.height + LABEL_GAP > bounds.bottom - bounds.top) continue;
    ordered.push({ item, index, priority: finite(item.priority) ? item.priority : 0 });
  }
  ordered.sort((a, b) => b.priority - a.priority || a.index - b.index);
  const occupied = [];

  for (const { item, index } of ordered) {
    if (occupied.length >= MAX_VISIBLE_LABELS) break;
    const halfW = item.width / 2 + PADDING, halfH = item.height / 2 + PADDING;
    const minX = bounds.left + halfW, maxX = bounds.right - halfW;
    const minY = bounds.top + halfH, maxY = bounds.bottom - halfH;
    const originX = clamp(item.x, minX, maxX), originY = clamp(item.y, minY, maxY);
    const candidates = [], seenCandidates = new Set();
    function candidate(x, y) {
      if (!finite(x) || !finite(y)) return;
      x = clamp(x, minX, maxX); y = clamp(y, minY, maxY);
      const key = `${x}:${y}`;
      if (seenCandidates.has(key)) return;
      seenCandidates.add(key);
      candidates.push({ x, y, distance: Math.hypot(x - originX, y - originY), order: candidates.length });
    }
    candidate(originX, originY);
    // Model silhouettes can leave only a narrow perimeter. Search that space
    // explicitly before resorting to hiding a label; never relax obstacles.
    for (const x of [minX, maxX]) { candidate(x, originY); candidate(x, minY); candidate(x, maxY); }
    candidate(originX, minY); candidate(originX, maxY);
    const initialRect = paddedRect(originX, originY, item.width, item.height);
    // Exact obstacle-edge candidates avoid unnecessary jumps on a coarse grid.
    let obstacleSeeds = 0;
    for (const obstacle of blocked) {
      if (!intersects(initialRect, obstacle)) continue;
      candidate(obstacle.left - halfW, originY);
      candidate(obstacle.right + halfW, originY);
      candidate(originX, obstacle.top - halfH);
      candidate(originX, obstacle.bottom + halfH);
      if (++obstacleSeeds >= MAX_OBSTACLE_SEEDS) break;
    }
    const stepX = item.width + LABEL_GAP, stepY = item.height + LABEL_GAP;
    const rings = item.compact ? 6 : 5;
    for (let ring = 1; ring <= rings; ring++) {
      for (let offset = -ring; offset <= ring; offset++) {
        candidate(originX + offset * stepX, originY - ring * stepY);
        candidate(originX + offset * stepX, originY + ring * stepY);
      }
      for (let offset = -ring + 1; offset < ring; offset++) {
        candidate(originX - ring * stepX, originY + offset * stepY);
        candidate(originX + ring * stepX, originY + offset * stepY);
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.order - b.order);
    for (const point of candidates) {
      const rect = paddedRect(point.x, point.y, item.width, item.height);
      if (!validRect(rect) || rect.left < bounds.left || rect.right > bounds.right
        || rect.top < bounds.top || rect.bottom > bounds.bottom) continue;
      if (blocked.some(obstacle => intersects(rect, obstacle))
        || occupied.some(other => intersects(rect, other))) continue;
      occupied.push(rect);
      result[index] = { id: item.id, x: point.x, y: point.y, hidden: false };
      break;
    }
  }
  return result;
}
