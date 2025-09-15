export class Debounce {
  private holdMs: number;
  private t0: number;
  private armed: boolean;

  constructor(holdMs = 80) {
    this.holdMs = holdMs;
    this.t0 = 0;
    this.armed = false;
  }

  on(state: boolean, now: number): boolean {
    if (!state) {
      this.armed = false;
      return false;
    }
    if (!this.armed) {
      this.armed = true;
      this.t0 = now;
    }
    return now - this.t0 >= this.holdMs;
  }
}
