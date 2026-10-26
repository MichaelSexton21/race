import { LAPS, KARTS_TOTAL, ITEM_INFO, AI_ROSTER, PLAYER } from './config.js';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export class UI {
  constructor() {
    this.el = {
      menu: document.getElementById('menu'),
      hud: document.getElementById('hud'),
      countdown: document.getElementById('countdown'),
      banner: document.getElementById('banner'),
      results: document.getElementById('results'),
      cards: document.getElementById('track-cards'),
      pos: document.getElementById('hud-pos'),
      lap: document.getElementById('hud-lap'),
      time: document.getElementById('hud-time'),
      item: document.getElementById('item-label'),
      itemSlot: document.getElementById('item-slot'),
      speed: document.getElementById('hud-speed'),
      minimap: document.getElementById('minimap'),
      resultsTitle: document.getElementById('results-title'),
      resultsTable: document.getElementById('results-table'),
      touch: document.getElementById('touch-controls'),
    };
    this.selected = 0;
    this.mapBase = null;
    this.mapTransform = null;
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }

  showMenu(tracks, onStart) {
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.results.classList.add('hidden');
    this.el.countdown.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.cards.innerHTML = '';
    this.cardCount = tracks.length;
    tracks.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'card' + (i === this.selected ? ' selected' : '');
      const cv = document.createElement('canvas');
      cv.width = 220;
      cv.height = 150;
      this.drawTrackPreview(cv, t);
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = t.name;
      const diff = document.createElement('div');
      diff.className = 'card-diff diff-' + t.id;
      diff.textContent = t.difficulty;
      const tag = document.createElement('div');
      tag.className = 'card-tag';
      tag.textContent = t.tagline;
      card.append(cv, name, diff, tag);
      card.addEventListener('click', () => this.selectCard(i));
      this.el.cards.appendChild(card);
    });
    this.selectCard(Math.min(this.selected, this.cardCount - 1));
    document.getElementById('start-btn').onclick = () => onStart(this.selected);
  }

  selectCard(i) {
    this.selected = i;
    const cards = this.el.cards.children;
    for (let j = 0; j < cards.length; j++) cards[j].classList.toggle('selected', i === j);
  }

  moveSelection(d) {
    this.selectCard((this.selected + d + this.cardCount) % this.cardCount);
  }

  drawTrackPreview(cv, t) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const pts = t.points.map((p) => [p[0], p[1]]);
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const [x, y] of pts) {
      minx = Math.min(minx, x); maxx = Math.max(maxx, x);
      miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    }
    const s = Math.min(cv.width / (maxx - minx + 30), cv.height / (maxy - miny + 30));
    const ox = (cv.width - (maxx - minx) * s) / 2;
    const oy = (cv.height - (maxy - miny) * s) / 2;
    const map = (x, y) => [ox + (x - minx) * s, cv.height - oy - (y - miny) * s];
    ctx.beginPath();
    const all = [...pts, ...pts.slice(0, 2)];
    all.forEach(([x, y], i) => {
      const [mx, my] = map(x, y);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.strokeStyle = '#' + t.accent.toString(16).padStart(6, '0');
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const [sx, sy] = map(pts[0][0], pts[0][1]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 4, sy - 4, 8, 8);
  }

  beginRace(race) {
    this.el.menu.classList.add('hidden');
    this.el.results.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.el.touch.classList.toggle('hidden', !this.isTouch);
    const world = race.world;
    const b = world.boundsInfo;
    const size = this.el.minimap;
    const s = Math.min((size.width - 20) / b.w, (size.height - 20) / b.h);
    const ox = (size.width - b.w * s) / 2 - b.minx * s;
    const oy = (size.height - b.h * s) / 2 + b.maxz * s;
    this.mapTransform = { s, ox, oy };
    const base = document.createElement('canvas');
    base.width = size.width;
    base.height = size.height;
    const ctx = base.getContext('2d');
    ctx.fillStyle = 'rgba(10, 18, 28, 0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, size.width, size.height, 10);
    ctx.fill();
    ctx.beginPath();
    world.pts.forEach((p, i) => {
      const x = p.x * s + ox;
      const y = -p.z * s + oy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    this.mapBase = base;
    this.resetHud();
  }

  resetHud() {
    this.el.pos.innerHTML = `1<span>/${KARTS_TOTAL}</span>`;
    this.el.lap.textContent = `LAP 1/${LAPS}`;
    this.el.time.textContent = '0:00.0';
    this.el.item.textContent = '—';
    this.el.item.style.color = '#8899aa';
    this.el.itemSlot.classList.remove('has-item');
    this.el.speed.innerHTML = `0<span>km/h</span>`;
  }

  updateHud(race) {
    const p = race.player;
    const rank = race.rankOf(p);
    this.el.pos.innerHTML = `${rank}<span>/${KARTS_TOTAL}</span>`;
    this.el.lap.textContent = `LAP ${Math.min(p.lap + 1, LAPS)}/${LAPS}`;
    this.el.time.textContent = fmtTime(race.raceT);
    if (p.item) {
      const info = ITEM_INFO[p.item];
      this.el.item.textContent = info.label;
      this.el.item.style.color = info.color;
      this.el.itemSlot.classList.add('has-item');
    } else {
      this.el.item.textContent = '—';
      this.el.item.style.color = '#8899aa';
      this.el.itemSlot.classList.remove('has-item');
    }
    this.el.speed.innerHTML = `${Math.round(Math.abs(p.speed()) * 3.6)}<span>km/h</span>`;

    if (this.mapBase && this.mapTransform) {
      const ctx = this.el.minimap.getContext('2d');
      ctx.clearRect(0, 0, this.el.minimap.width, this.el.minimap.height);
      ctx.drawImage(this.mapBase, 0, 0);
      const { s, ox, oy } = this.mapTransform;
      for (const k of race.karts) {
        const x = k.pos.x * s + ox;
        const y = -k.pos.z * s + oy;
        ctx.beginPath();
        ctx.arc(x, y, k.isPlayer ? 5 : 3.4, 0, Math.PI * 2);
        ctx.fillStyle = k.isPlayer ? '#ffcc00' : '#' + k.color.toString(16).padStart(6, '0');
        ctx.fill();
        if (k.isPlayer) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }

  countdown(label) {
    this.el.countdown.classList.remove('hidden');
    this.el.countdown.textContent = label;
    this.el.countdown.classList.remove('pop');
    void this.el.countdown.offsetWidth;
    this.el.countdown.classList.add('pop');
  }

  hideCountdown() {
    this.el.countdown.classList.add('hidden');
  }

  lapBanner(text) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('hidden');
    this.el.banner.classList.remove('slide');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('slide');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => this.el.banner.classList.add('hidden'), 1600);
  }

  showResults(standings, playerRank, race) {
    this.el.countdown.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.results.classList.remove('hidden');
    this.el.resultsTitle.textContent =
      playerRank === 1 ? 'VICTORY!' : `FINISHED ${ORDINALS[playerRank - 1].toUpperCase()}`;
    const table = this.el.resultsTable;
    table.innerHTML = '<tr><th>POS</th><th>DRIVER</th><th>TIME</th></tr>';
    standings.forEach((k, i) => {
      const tr = document.createElement('tr');
      if (k.isPlayer) tr.className = 'me';
      const time = k.finished
        ? fmtTime(k.finishTime)
        : `${Math.min(99, Math.floor((race.progressOf(k) / LAPS) * 100))}%`;
      tr.innerHTML = `<td class="pos ${i < 3 ? 'p' + (i + 1) : ''}">${i + 1}</td><td>${k.isPlayer ? 'You' : k.name}</td><td>${time}</td>`;
      table.appendChild(tr);
    });
  }
}
