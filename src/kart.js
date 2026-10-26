import * as THREE from 'three';
import { PHYS } from './config.js';

export class Kart {
  constructor(name, color, isPlayer) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.trackIdx = 0;
    this.prevT = null;
    this.lap = 0;
    this.nextCp = 0;
    this.item = null;
    this.boostTimer = 0;
    this.slipTimer = 0;
    this.shieldTimer = 0;
    this.offRoad = false;
    this.onIce = false;
    this.finished = false;
    this.finishTime = 0;
    this.skillTop = 0;
    this.lane = 0;
    this.frontPivots = [];
    this.wheelMeshes = [];
    this.buildMesh();
  }

  forward(out) {
    const f = out || new THREE.Vector3();
    f.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    return f;
  }
  speed() {
    return this.vel.dot(this.forward());
  }

  buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x22242a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 1.8), bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.55), bodyMat);
    nose.position.set(0, 0.4, 1.05);
    nose.castShadow = true;
    g.add(nose);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.75), darkMat);
    seat.position.set(0, 0.62, -0.28);
    g.add(seat);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }));
    helmet.position.set(0, 0.95, -0.28);
    helmet.castShadow = true;
    g.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), darkMat);
    visor.position.set(0, 0.97, 0.0);
    g.add(visor);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.32), darkMat);
    spoiler.position.set(0, 0.92, -0.88);
    g.add(spoiler);
    for (const s of [1, -1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), darkMat);
      strut.position.set(s * 0.35, 0.76, -0.88);
      g.add(strut);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.28, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    for (const [x, z, front] of [[-0.62, 0.72, true], [0.62, 0.72, true], [-0.62, -0.72, false], [0.62, -0.72, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.33, z);
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.castShadow = true;
      pivot.add(wheel);
      g.add(pivot);
      this.wheelMeshes.push(wheel);
      if (front) this.frontPivots.push(pivot);
    }

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa028, transparent: true, opacity: 0.9 })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(0, 0.45, -1.15);
    flame.visible = false;
    g.add(flame);
    this.flame = flame;

    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 12),
      new THREE.MeshLambertMaterial({ color: 0x66ccff, transparent: true, opacity: 0.22 })
    );
    shield.position.y = 0.6;
    shield.visible = false;
    g.add(shield);
    this.shieldMesh = shield;

    this.mesh = g;
  }

  useItem(race) {
    if (!this.item || this.finished) return false;
    const it = this.item;
    this.item = null;
    if (it === 'boost') {
      this.boostTimer = PHYS.boostTime;
      race.audio.boost();
      return true;
    }
    if (it === 'shield') {
      this.shieldTimer = PHYS.shieldTime;
      race.audio.shieldPop();
      return true;
    }
    if (it === 'banana') {
      const f = this.forward();
      const p = this.pos.clone().addScaledVector(f, -2.4);
      race.items.spawnBanana(p, this);
      return true;
    }
    return false;
  }

  update(dt, input, world) {
    const P = PHYS;
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.slipTimer = Math.max(0, this.slipTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.shieldMesh.visible = this.shieldTimer > 0;

    const f = this.forward();
    const sp = this.vel.dot(f);

    const idx = world.nearestIndex(this.pos, this.trackIdx);
    this.trackIdx = idx;
    this.offRoad = this.pos.distanceTo(world.pts[idx]) > world.def.width / 2 + 0.7;
    this.onIce = world.icePatches.some((p) => this.pos.distanceTo(p.pos) < p.radius);

    const drifting = input.drift && Math.abs(sp) > 9 && Math.abs(input.steer) > 0.15 && !this.offRoad;
    let steer = input.steer;
    if (this.slipTimer > 0) steer = Math.sin(performance.now() * 0.022) * 1.6;
    const grip = this.onIce ? 0.4 : 1;
    const spF = Math.min(1, Math.abs(sp) / 10);
    const turn = steer * P.turnRate * grip * (drifting ? P.driftTurn : 1) * spF * (sp >= 0 ? 1 : -1);
    this.heading += turn * dt;

    const boosting = this.boostTimer > 0;
    let acc = 0;
    if (input.throttle > 0) acc = boosting ? P.boostAccel : P.accel;
    else if (input.throttle < 0) acc = sp > 2 ? -P.brake : -P.reverseAccel;
    const f2 = this.forward();
    this.vel.addScaledVector(f2, acc * dt);

    let vf = this.vel.dot(f2);
    const lat = new THREE.Vector3().copy(this.vel).addScaledVector(f2, -vf);
    const drag = this.offRoad ? P.offRoadDrag : P.drag;
    vf *= Math.max(0, 1 - drag * dt);
    const latGrip = drifting ? P.driftGrip : this.onIce ? P.iceGrip : this.slipTimer > 0 ? 1.5 : P.grip;
    lat.multiplyScalar(Math.max(0, 1 - latGrip * dt));
    const cap = boosting ? P.boostSpeed : this.offRoad ? P.offRoadMax : P.topSpeed;
    if (vf > cap) vf = cap + (vf - cap) * Math.exp(-2.0 * dt);
    vf = Math.max(vf, P.reverseMax);
    this.vel.copy(f2).multiplyScalar(vf).add(lat);
    this.pos.addScaledVector(this.vel, dt);

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const wspin = (sp * dt) / 0.33;
    for (const w of this.wheelMeshes) w.rotation.x += wspin;
    for (const p of this.frontPivots) p.rotation.y += (steer * 0.42 - p.rotation.y) * Math.min(1, 10 * dt);
    this.flame.visible = boosting;
    if (boosting) this.flame.scale.set(0.8 + Math.random() * 0.6, 1, 0.8 + Math.random() * 0.6);
  }
}
