import * as THREE from 'three';
import { LAPS, KARTS_TOTAL, AI_ROSTER, PLAYER, PHYS } from './config.js';
import { TrackWorld } from './track.js';
import { Kart } from './kart.js';
import { Items } from './items.js';
import { aiInput } from './ai.js';

const CP_TS = [0.25, 0.5, 0.75];

function crossed(a, b, v) {
  if (a === b) return false;
  if (a < b) return v > a && v <= b;
  return v > a || v <= b;
}

export class Race {
  constructor(scene, trackDef, input, audio, ui) {
    this.scene = scene;
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.trackDef = trackDef;
    this.world = new TrackWorld(trackDef);
    scene.add(this.world.group);
    this.items = new Items(this.world, scene);
    this.karts = [];
    this.state = 'countdown';
    this.countT = 3.6;
    this.goFlash = 0;
    this.lastLabel = '';
    this.raceT = 0;
    this.resultsShown = false;

    const w = trackDef.width;
    const casters = [
      { name: PLAYER.name, color: PLAYER.color, isPlayer: true, row: 2, side: 1 },
      ...AI_ROSTER.map((r, i) => ({ name: r.name, color: r.color, isPlayer: false, row: Math.floor(i / 2), side: i % 2 === 0 ? 1 : -1 })),
    ];
    for (const c of casters) {
      const k = new Kart(c.name, c.color, c.isPlayer);
      k.skillTop = 30 * (0.88 + Math.random() * 0.14);
      k.lane = (Math.random() * 2 - 1) * (w / 4);
      const t = 0.985 - c.row * 0.012;
      const p = this.world.pointAtT(t);
      const n = this.world.normalAtT(t);
      const d = this.world.dirAtIdx(Math.floor(t * this.world.N) % this.world.N);
      const gx = p.x + n.x * c.side * w * 0.22;
      const gz = p.z + n.z * c.side * w * 0.22;
      k.pos.set(gx, this.world.heightAt(gx, gz) + 0.05, gz);
      k.heading = Math.atan2(d.x, d.z);
      k.trackIdx = this.world.nearestIndex(k.pos, null);
      k.prevT = this.world.cum[k.trackIdx] / this.world.length;
      k.mesh.position.copy(k.pos);
      k.mesh.rotation.y = k.heading;
      this.karts.push(k);
      scene.add(k.mesh);
      if (c.isPlayer) this.player = k;
    }
    if (KARTS_TOTAL !== this.karts.length) console.warn('cart count mismatch');
    this.ui.resetHud();
  }

  progressOf(k) {
    if (k.finished) return LAPS + Math.max(0, 2000 - k.finishTime * 10);
    const t = this.world.cum[k.trackIdx] / this.world.length;
    const lastCpT = [0, 0.25, 0.5, 0.75][(k.nextCp - 1 + 4) % 4];
    const seg = (t - lastCpT + 1) % 1;
    return k.lap + k.nextCp * 0.25 + seg;
  }

  rankOf(k) {
    let ahead = 0;
    for (const o of this.karts) {
      if (o === k) continue;
      if (o.finished && k.finished) {
        if (o.finishTime < k.finishTime) ahead++;
      } else if (o.finished && !k.finished) {
        ahead++;
      } else if (!o.finished && !k.finished) {
        if (this.progressOf(o) > this.progressOf(k)) ahead++;
      }
    }
    return ahead + 1;
  }

  lapCheck(k) {
    const t = this.world.cum[k.trackIdx] / this.world.length;
    if (k.prevT != null) {
      const delta = (t - k.prevT + 1) % 1;
      // Off-track, the nearest track index can jump backward a large amount; a
      // genuine per-frame step is always tiny. Ignore checkpoint logic on big
      // jumps so an off-road kart can't fake-cross checkpoints / finish early.
      if (delta > 0.05) {
        k.prevT = t;
        return;
      }
      const nextV = k.nextCp < 3 ? CP_TS[k.nextCp] : 0;
      if (crossed(k.prevT, t, nextV)) {
        if (k.nextCp === 3) {
          k.lap++;
          k.nextCp = 0;
          if (k.lap >= LAPS) {
            k.finished = true;
            k.finishTime = this.raceT;
            if (k.isPlayer) this.audio.finish();
          } else if (k.isPlayer) {
            this.ui.lapBanner(`LAP ${k.lap + 1}/${LAPS}`);
          }
        } else {
          k.nextCp++;
        }
      }
    }
    k.prevT = t;
  }

  separate(i, j) {
    const a = this.karts[i], b = this.karts[j];
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const min = PHYS.kartRadius * 2;
    if (d > 0.001 && d < min) {
      const nx = dx / d, nz = dz / d;
      const push = (min - d) / 2;
      a.pos.x -= nx * push;
      a.pos.z -= nz * push;
      b.pos.x += nx * push;
      b.pos.z += nz * push;
      const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
      if (rv < 0) {
        const imp = rv * 0.5;
        a.vel.x += nx * imp;
        a.vel.z += nz * imp;
        b.vel.x -= nx * imp;
        b.vel.z -= nz * imp;
      }
    }
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countT -= dt;
      const e = 3.6 - this.countT;
      const label = e < 1 ? '3' : e < 2 ? '2' : e < 3 ? '1' : 'GO';
      if (label !== this.lastLabel) {
        this.lastLabel = label;
        this.ui.countdown(label);
        this.audio.countdown(label === 'GO');
      }
      if (this.countT <= 0) {
        this.state = 'racing';
        this.goFlash = 0.9;
      }
    }
    if (this.goFlash > 0) {
      this.goFlash -= dt;
      if (this.goFlash <= 0) this.ui.hideCountdown();
    }

    for (const k of this.karts) {
      let input;
      if (k.isPlayer && !k.finished && (this.state === 'racing' || this.state === 'finished')) {
        input = { throttle: 0, steer: 0, drift: false };
        if (this.state === 'racing') {
          input = { throttle: this.input.throttle, steer: this.input.steer, drift: this.input.drift };
          if (this.input.consumeItem()) k.useItem(this);
        }
      } else {
        input = aiInput(k, this.world, this, dt, { noItems: k.finished });
      }
      if (this.state === 'racing' || this.state === 'finished') k.update(dt, input, this.world);
    }

    if (this.state !== 'countdown') {
      this.raceT += dt;
      for (let i = 0; i < this.karts.length; i++)
        for (let j = i + 1; j < this.karts.length; j++) this.separate(i, j);
      for (const k of this.karts) if (!k.finished) this.lapCheck(k);
      this.items.update(dt, this);
      this.audio.setEngine(Math.min(1, Math.abs(this.player.speed()) / 40), this.player.speed() > 1);
      if (this.player.finished && !this.resultsShown) this.finishRace();
    }
    if (this.state === 'racing') this.ui.updateHud(this);
  }

  finishRace() {
    this.resultsShown = true;
    this.state = 'finished';
    this.audio.stopEngine();
    const standings = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return this.progressOf(b) - this.progressOf(a);
    });
    this.ui.showResults(standings, this.rankOf(this.player), this);
  }

  dispose() {
    this.items.clear();
    this.world.dispose();
    this.scene.remove(this.world.group);
    for (const k of this.karts) this.scene.remove(k.mesh);
  }
}
