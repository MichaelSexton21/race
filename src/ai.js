import * as THREE from 'three';

export function aiInput(kart, world, race, dt, opts = {}) {
  const N = world.N;
  const idx = kart.trackIdx;
  const sp = Math.abs(kart.speed());
  const look = 8 + Math.floor(sp * 0.35);
  const ti = (idx + look) % N;
  const target = world.pts[ti];
  const tx = target.x + world.normals[ti].x * kart.lane;
  const tz = target.z + world.normals[ti].z * kart.lane;
  const desired = Math.atan2(tx - kart.pos.x, tz - kart.pos.z);
  let diff = desired - kart.heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const steer = Math.max(-1, Math.min(1, diff * 2.2));

  const d1 = world.dirAtIdx((idx + look) % N);
  const d2 = world.dirAtIdx((idx + look + 14) % N);
  const curv = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
  const base = kart.skillTop * (1 - Math.min(1, curv * 2.2) * 0.45);

  const player = race.player;
  const gap = race.progressOf(player) - race.progressOf(kart);
  const rubber = Math.max(0.86, Math.min(1.18, 1 + gap * 0.25));
  const ts = base * rubber;
  const vsp = kart.speed();
  const throttle = vsp < ts ? 1 : -0.6;

  if (!opts.noItems) aiUseItem(kart, race, dt);
  return { throttle, steer, drift: Math.abs(diff) > 0.7 && vsp > 20 };
}

function aiUseItem(k, race, dt) {
  if (!k.item || k.finished) return;
  const prog = (k) => race.progressOf(k);
  if (k.item === 'boost') {
    if (Math.random() < dt * 1.4 && prog(k) >= prog(race.player) - 0.04) k.useItem(race);
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
