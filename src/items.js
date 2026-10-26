import * as THREE from 'three';
import { PHYS } from './config.js';

export class Items {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.bananas = [];
    this.boxes = [];
    this.boxGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
    this.boxMat = new THREE.MeshLambertMaterial({ color: 0xffd23b, emissive: 0x6a4d00 });
    this.bananaGeo = new THREE.TorusGeometry(0.38, 0.17, 8, 12, Math.PI * 1.4);
    this.bananaMat = new THREE.MeshLambertMaterial({ color: 0xf4e04d });
    this.buildBoxes();
  }

  buildBoxes() {
    const world = this.world;
    const rows = world.def.boxRows;
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows + 0.015;
      const p = world.pointAtT(t);
      const n = world.normalAtT(t);
      const count = r % 2 === 1 ? 4 : 3;
      const spread = world.def.width * 0.3;
      for (let c = 0; c < count; c++) {
        const off = count === 3 ? (c - 1) * spread * 0.8 : (c - 1.5) * spread * 0.62;
        const pos = p.clone().addScaledVector(n, off);
        const baseY = world.heightAt(pos.x, pos.z);
        const mesh = new THREE.Mesh(this.boxGeo, this.boxMat);
        mesh.position.set(pos.x, baseY + 1.1, pos.z);
        this.scene.add(mesh);
        this.boxes.push({ pos, mesh, active: true, respawn: 0, phase: Math.random() * 6.28, baseY });
      }
    }
  }

  spawnBanana(pos, owner) {
    const m = new THREE.Mesh(this.bananaGeo, this.bananaMat);
    m.position.set(pos.x, this.world.heightAt(pos.x, pos.z) + 0.3, pos.z);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = true;
    this.scene.add(m);
    this.bananas.push({ pos: pos.clone(), mesh: m, age: 0, owner });
  }

  pickItem(race, k) {
    const rank = race.rankOf(k);
    const r = Math.random();
    if (rank === 1) return r < 0.6 ? 'boost' : r < 0.85 ? 'banana' : 'shield';
    if (rank <= 3) return r < 0.45 ? 'boost' : r < 0.75 ? 'banana' : 'shield';
    return r < 0.35 ? 'boost' : r < 0.75 ? 'banana' : 'shield';
  }

  update(dt, race) {
    const t = performance.now() * 0.001;
    for (const b of this.boxes) {
      if (!b.active) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.active = true;
          b.mesh.visible = true;
        }
        continue;
      }
      b.mesh.rotation.y += 2.2 * dt;
      b.mesh.position.y = b.baseY + 1.1 + Math.sin(t * 2.4 + b.phase) * 0.15;
    }

    for (const k of race.karts) {
      if (k.finished || k.item) continue;
      for (const b of this.boxes) {
        if (b.active && b.pos.distanceToSquared(k.pos) < 3.1 * 3.1) {
          k.item = this.pickItem(race, k);
          b.active = false;
          b.mesh.visible = false;
          b.respawn = 6;
          race.audio.item();
          break;
        }
      }
    }

    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const bn = this.bananas[i];
      bn.age += dt;
      bn.mesh.rotation.z += 3 * dt;
      if (bn.age > PHYS.bananaLife) {
        this.scene.remove(bn.mesh);
        this.bananas.splice(i, 1);
        continue;
      }
      for (const k of race.karts) {
        if (k === bn.owner || k.finished) continue;
        if (k.pos.distanceTo(bn.pos) < 1.5) {
          if (k.shieldTimer > 0) {
            k.shieldTimer = 0;
            race.audio.shieldPop();
          } else {
            k.slipTimer = PHYS.slipTime;
            k.vel.multiplyScalar(0.45);
            race.audio.slip();
          }
          this.scene.remove(bn.mesh);
          this.bananas.splice(i, 1);
          break;
        }
      }
    }

    for (const pad of this.world.boostPads) {
      pad.cooldown = Math.max(0, pad.cooldown - dt);
      if (pad.cooldown > 0) continue;
      for (const k of race.karts) {
        if (k.finished) continue;
        if (k.pos.distanceTo(pad.pos) < 3.0) {
          k.boostTimer = Math.max(k.boostTimer, 1.0);
          pad.cooldown = 2.0;
          if (k.isPlayer) race.audio.boost();
          break;
        }
      }
    }
  }

  clear() {
    for (const b of this.boxes) this.scene.remove(b.mesh);
    for (const bn of this.bananas) this.scene.remove(bn.mesh);
    this.boxes = [];
    this.bananas = [];
  }
}
