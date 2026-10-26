export class Input {
  constructor() {
    this.keys = new Set();
    this.itemPressed = false;
    this.actions = new Set();
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'Space') this.itemPressed = true;
        if (e.code === 'KeyR') this.actions.add('restart');
        if (e.code === 'Escape') this.actions.add('menu');
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
  get throttle() {
    return (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0) +
      (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? -1 : 0);
  }
  get steer() {
    return (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0) +
      (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? -1 : 0);
  }
  get drift() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
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
