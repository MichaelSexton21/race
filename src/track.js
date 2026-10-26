import * as THREE from 'three';

const N = 900;

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture(base, spot) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? spot : base;
      ctx.globalAlpha = 0.35 + Math.random() * 0.4;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
  });
}

function roadTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#34373c' : '#42464c';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(6, 0, 5, s);
    ctx.fillRect(s - 11, 0, 5, s);
    ctx.fillStyle = '#f7d94c';
    for (let y = 0; y < s; y += 40) ctx.fillRect(s / 2 - 3, y, 6, 20);
  });
}

function curbTexture() {
  return canvasTexture(256, (ctx, s) => {
    const h = s / 16;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d8352c' : '#f2f2f2';
      ctx.fillRect(0, i * h, s, h);
    }
  });
}

function checkerTexture() {
  return canvasTexture(128, (ctx, s) => {
    const n = 8, c = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#111' : '#fafafa';
        ctx.fillRect(i * c, j * c, c, c);
      }
  });
}

function padTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#ff8c1a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 75;
      ctx.beginPath();
      ctx.moveTo(s * 0.25, y + 45);
      ctx.lineTo(s * 0.5, y);
      ctx.lineTo(s * 0.75, y + 45);
      ctx.lineTo(s * 0.75, y + 68);
      ctx.lineTo(s * 0.5, y + 23);
      ctx.lineTo(s * 0.25, y + 68);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function bannerTexture(text) {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#1b2735';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffd23b';
    ctx.fillRect(0, 0, s, 14);
    ctx.fillRect(0, s - 14, s, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 130px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s / 2, s / 2 + 8);
  });
}

function ribbonGeometry(pts, normals, halfW, y) {
  const n = pts.length;
  const pos = [];
  const uv = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const na = normals[i], nb = normals[(i + 1) % n];
    const alx = a.x + na.x * halfW, alz = a.z + na.z * halfW;
    const arx = a.x - na.x * halfW, arz = a.z - na.z * halfW;
    const blx = b.x + nb.x * halfW, blz = b.z + nb.z * halfW;
    const brx = b.x - nb.x * halfW, brz = b.z - nb.z * halfW;
    const va = i / n, vb = (i + 1) / n;
    pos.push(alx, y, alz, arx, y, arz, brx, y, brz);
    pos.push(alx, y, alz, brx, y, brz, blx, y, blz);
    uv.push(0, va, 1, vb, 1, vb);
    uv.push(0, va, 1, vb, 0, vb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export class TrackWorld {
  constructor(def) {
    this.def = def;
    const p3 = def.points.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.curve = new THREE.CatmullRomCurve3(p3, true, 'catmullrom', 0.5);
    this.N = N;
    this.pts = this.curve.getSpacedPoints(N);
    this.pts.pop();
    this.segLen = new Float32Array(N);
    this.cum = new Float32Array(N);
    let acc = 0;
    for (let i = 0; i < N; i++) {
      this.segLen[i] = this.pts[i].distanceTo(this.pts[(i + 1) % N]);
      this.cum[i] = acc;
      acc += this.segLen[i];
    }
    this.length = acc;
    this.normals = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = this.pts[(i - 1 + N) % N], b = this.pts[(i + 1) % N];
      const d = new THREE.Vector3().subVectors(b, a);
      d.y = 0;
      d.normalize();
      this.normals[i] = new THREE.Vector3(d.z, 0, -d.x);
    }
    this.icePatches = [];
    this.boostPads = [];
    this.group = new THREE.Group();
    this.build();
  }

  pointAtT(t) {
    t = ((t % 1) + 1) % 1;
    const f = t * this.N;
    const i = Math.floor(f) % this.N;
    const frac = f - Math.floor(f);
    return this.pts[i].clone().lerp(this.pts[(i + 1) % this.N], frac);
  }
  normalAtT(t) {
    return this.normals[Math.floor((((t % 1) + 1) % 1) * this.N) % this.N];
  }
  dirAtIdx(i) {
    const a = this.pts[(i - 1 + this.N) % this.N], b = this.pts[(i + 1) % this.N];
    const d = new THREE.Vector3().subVectors(b, a);
    d.y = 0;
    return d.normalize();
  }
  nearestIndex(pos, hint) {
    const N = this.N;
    let best = 0, bd = Infinity;
    if (hint == null) {
      for (let i = 0; i < N; i++) {
        const d = pos.distanceToSquared(this.pts[i]);
        if (d < bd) { bd = d; best = i; }
      }
    } else {
      for (let o = -40; o <= 40; o++) {
        const i = (hint + o + N) % N;
        const d = pos.distanceToSquared(this.pts[i]);
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }
  bounds() {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (const p of this.pts) {
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
      minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z);
    }
    return { minx, minz, maxx, maxz, w: maxx - minx, h: maxz - minz };
  }

  build() {
    const def = this.def;
    const w = def.width;
    const b = this.bounds();
    this.boundsInfo = b;

    const groundSize = Math.max(b.w, b.h) + 420;
    const gtx = grassTexture(
      '#' + def.ground.toString(16).padStart(6, '0'),
      '#' + def.ground2.toString(16).padStart(6, '0')
    );
    gtx.repeat.set(groundSize / 24, groundSize / 24);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshLambertMaterial({ map: gtx })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((b.minx + b.maxx) / 2, 0, (b.minz + b.maxz) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);

    const ctx = curbTexture();
    ctx.repeat.set(1, this.length / 8);
    const curb = new THREE.Mesh(
      ribbonGeometry(this.pts, this.normals, w / 2 + 1.7, 0.02),
      new THREE.MeshLambertMaterial({ map: ctx })
    );
    curb.receiveShadow = true;
    this.group.add(curb);

    const rtx = roadTexture();
    rtx.repeat.set(1, this.length / 6);
    const road = new THREE.Mesh(
      ribbonGeometry(this.pts, this.normals, w / 2, 0.04),
      new THREE.MeshLambertMaterial({ map: rtx })
    );
    road.receiveShadow = true;
    this.group.add(road);

    const start = this.pts[0];
    const sdir = this.dirAtIdx(0);
    const checker = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 3.2),
      new THREE.MeshLambertMaterial({ map: checkerTexture() })
    );
    checker.rotation.x = -Math.PI / 2;
    checker.rotation.z = -Math.atan2(sdir.x, sdir.z);
    checker.position.set(start.x, 0.05, start.z);
    this.group.add(checker);

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 2, 3.4),
      new THREE.MeshBasicMaterial({ map: bannerTexture('START'), side: THREE.DoubleSide })
    );
    banner.position.set(start.x, 5.4, start.z);
    banner.rotation.y = Math.atan2(sdir.x, sdir.z);
    this.group.add(banner);
    const poleGeo = new THREE.CylinderGeometry(0.25, 0.25, 5.6, 8);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xd8d8e0 });
    const sleft = this.normals[0].clone().multiplyScalar((w + 2) / 2);
    for (const s of [1, -1]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(start.x + sleft.x * s, 2.8, start.z + sleft.z * s);
      pole.castShadow = true;
      this.group.add(pole);
    }

    this.buildDecorations();
    this.buildIcePatches();
    this.buildBoostPads();
    this.buildClouds(b);
  }

  buildDecorations() {
    const def = this.def;
    const b = this.boundsInfo;
    const pad = 260;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
    const leafMat = new THREE.MeshLambertMaterial({ color: def.treeColor });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8d8d95 });
    const coneGeo1 = new THREE.ConeGeometry(1.7, 2.6, 7);
    const coneGeo2 = new THREE.ConeGeometry(1.2, 2.0, 7);
    const coneGeo3 = new THREE.ConeGeometry(0.7, 1.4, 7);
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.8, 6);
    const rockGeo = new THREE.DodecahedronGeometry(1);
    let placed = 0;
    let attempts = 0;
    while (placed < def.decorCount && attempts < def.decorCount * 25) {
      attempts++;
      const p = new THREE.Vector3(
        b.minx - 40 + Math.random() * (b.w + pad),
        0,
        b.minz - 40 + Math.random() * (b.h + pad)
      );
      const idx = this.nearestIndex(p, null);
      const d = p.distanceTo(this.pts[idx]);
      if (d < def.width / 2 + 7 || d > def.width / 2 + 150) continue;
      const g = new THREE.Group();
      const isRock = Math.random() < 0.18;
      if (isRock) {
        const r = new THREE.Mesh(rockGeo, rockMat);
        const s = 0.7 + Math.random() * 1.6;
        r.scale.set(s, s * (0.6 + Math.random() * 0.5), s);
        r.position.y = s * 0.3;
        r.rotation.y = Math.random() * Math.PI;
        r.castShadow = true;
        g.add(r);
      } else if (def.decor === 'cactus') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 2.6, 8), leafMat);
        body.position.y = 1.3;
        body.castShadow = true;
        g.add(body);
        for (const s of [1, -1]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.3, 6), leafMat);
          arm.position.set(s * 0.75, 1.5 + Math.random() * 0.5, 0);
          arm.rotation.z = s * -0.9;
          arm.castShadow = true;
          g.add(arm);
        }
      } else {
        const t = new THREE.Mesh(trunkGeo, trunkMat);
        t.position.y = 0.9;
        t.castShadow = true;
        g.add(t);
        if (def.decor === 'pine') {
          const c1 = new THREE.Mesh(coneGeo1, leafMat); c1.position.y = 2.4;
          const c2 = new THREE.Mesh(coneGeo2, leafMat); c2.position.y = 3.6;
          const c3 = new THREE.Mesh(coneGeo3, leafMat); c3.position.y = 4.6;
          for (const c of [c1, c2, c3]) c.castShadow = true;
          g.add(c1, c2, c3);
        } else {
          const c1 = new THREE.Mesh(coneGeo1, leafMat); c1.position.y = 2.6;
          const c2 = new THREE.Mesh(coneGeo2, leafMat); c2.position.y = 3.9;
          c1.castShadow = c2.castShadow = true;
          g.add(c1, c2);
        }
      }
      g.position.copy(p);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(g);
      placed++;
    }
  }

  buildIcePatches() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.55 });
    for (const t of this.def.icePatches) {
      const pos = this.pointAtT(t);
      const r = Math.min(5.5, this.def.width * 0.46);
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(pos.x, 0.045, pos.z);
      this.group.add(m);
      this.icePatches.push({ pos: pos.clone(), radius: r });
    }
  }

  buildBoostPads() {
    const mat = new THREE.MeshLambertMaterial({ map: padTexture() });
    for (const t of this.def.boostPads) {
      const pos = this.pointAtT(t);
      const dir = this.dirAtIdx(Math.floor(t * this.N) % this.N);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.6), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(dir.x, dir.z);
      m.position.set(pos.x, 0.05, pos.z);
      this.group.add(m);
      this.boostPads.push({ pos: pos.clone(), cooldown: 0 });
    }
  }

  buildClouds(b) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(geo, mat);
        const r = 4 + Math.random() * 6;
        s.scale.set(r, r * 0.5, r * 0.7);
        s.position.set((j - n / 2) * r * 0.9, 0, (Math.random() - 0.5) * 6);
        g.add(s);
      }
      g.position.set(
        b.minx + Math.random() * b.w,
        45 + Math.random() * 25,
        b.minz + Math.random() * b.h
      );
      this.group.add(g);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
}
