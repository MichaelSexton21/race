import * as THREE from 'three';

export function aiInput(kart, world, race, dt, opts = {}) {
  const N = world.N;
  const idx = kart.trackIdx;
  const vsp = kart.speed();
  const sp = Math.abs(vsp);

  if (kart.offRoad) {
    const c = world.pts[idx];
    const toC = Math.atan2(c.x - kart.pos.x, c.z - kart.pos.z);
    let dc = toC - kart.heading;
    dc = Math.atan2(Math.sin(dc), Math.cos(dc));
    if (!opts.noItems) aiUseItem(kart, race, dt);
    return { throttle: 1, steer: Math.max(-1, Math.min(1, dc * 3)), drift: false };
  }

  const look = Math.floor(6 + sp * 0.45);
  const ti = (idx + look) % N;
  const target = world.pts[ti];
  const nrm = world.normals[ti];
  const tx = target.x + nrm.x * kart.lane;
  const tz = target.z + nrm.z * kart.lane;
  const desired = Math.atan2(tx - kart.pos.x, tz - kart.pos.z);
  let diff = desired - kart.heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  let avoid = 0;
  const fx = Math.sin(kart.heading), fz = Math.cos(kart.heading);
  for (const o of race.karts) {
    if (o === kart) continue;
    const rx = o.pos.x - kart.pos.x, rz = o.pos.z - kart.pos.z;
    const dist = Math.hypot(rx, rz) || 1;
    if (dist < 10 && rx * fx + rz * fz > 0) {
      const lat = rx * fz - rz * fx;
      const strength = 1 - dist / 10;
      avoid -= THREE.MathUtils.clamp(lat * 1.4, -1.2, 1.2) * strength;
    }
  }
  const steer = THREE.MathUtils.clamp(diff * (2.4 - sp * 0.015) + avoid, -1, 1);

  let maxCurv = 0;
  for (const s of [look, look + 14, look + 28, look + 46]) {
    const a = world.dirAtIdx((idx + s) % N).angleTo(world.dirAtIdx((idx + s + 14) % N));
    if (a > maxCurv) maxCurv = a;
  }
  const base = kart.skillTop * (1 - Math.min(1, maxCurv * 1.2) * 0.32);

  const player = race.player;
  const gap = race.progressOf(player) - race.progressOf(kart);
  const rubber = Math.max(0.9, Math.min(1.4, 1 + gap * 0.55));
  const ts = base * rubber;
  const throttle = vsp < ts ? 1 : vsp < ts + 4 ? 0 : -0.6;

  if (!opts.noItems) aiUseItem(kart, race, dt);
  return { throttle, steer, drift: vsp > 14 && maxCurv > 0.2 };
}

function aiUseItem(k, race, dt) {
  if (!k.item || k.finished) return;
  const prog = (k) => race.progressOf(k);
  if (k.item === 'boost') {
    if (Math.random() < dt * 2.2 && prog(k) >= prog(race.player) - 0.06) k.useItem(race);
  } else if (k.item === 'banana') {
    let rear = Infinity;
    for (const o of race.karts) {
      if (o === k || o.finished) continue;
      rear = Math.min(rear, prog(k) - prog(o));
    }
    if (rear < 0.035 && Math.random() < dt * 2.5) k.useItem(race);
  } else if (k.item === 'shield') {
    const playerBehind = prog(k) - prog(race.player);
    if ((playerBehind > 0 && playerBehind < 0.06) || Math.random() < dt * 0.4) k.useItem(race);
  }
}
