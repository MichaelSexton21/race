export class Input {
  constructor() {
    this.keys = new Set();
    this.itemPressed = false;
    this.actions = new Set();
    this.touch = { gas: 0, brake: 0, left: 0, right: 0, drift: 0 };
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'Space') this.itemPressed = true;
        if (e.code === 'KeyR') this.actions.add('restart');
        if (e.code === 'Escape') this.actions.add('menu');
        if (e.code === 'ArrowLeft') this.actions.add('left');
        if (e.code === 'ArrowRight') this.actions.add('right');
        if (e.code === 'Enter' || e.code === 'Space') this.actions.add('select');
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    const itemSlot = document.getElementById('item-slot');
    if (itemSlot) {
      itemSlot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.itemPressed = true;
      });
      if (this.isTouch) itemSlot.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if (this.isTouch) this.bindTouch();
  }

  bindTouch() {
    const hold = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch {}
        this.touch[key]++;
      });
      const release = (e) => {
        try { el.releasePointerCapture(e.pointerId); } catch {}
        if (this.touch[key] > 0) this.touch[key]--;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold('tc-gas', 'gas');
    hold('tc-brake', 'brake');
    hold('tc-left', 'left');
    hold('tc-right', 'right');
    hold('tc-drift', 'drift');
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  get throttle() {
    return (this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touch.gas > 0 ? 1 : 0) +
      (this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touch.brake > 0 ? -1 : 0);
  }
  get steer() {
    return (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left > 0 ? 1 : 0) +
      (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right > 0 ? -1 : 0);
  }
  get drift() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touch.drift > 0;
  }
  consumeItem() {
    const v = this.itemPressed;
    this.itemPressed = false;
    return v;
  }
  consumeAction(a) {
    if (this.actions.has(a)) {
      this.actions.delete(a);
      return true;
    }
    return false;
  }
}
