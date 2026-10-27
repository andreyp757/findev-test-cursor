// Зачем: главный поток не должен получать сырой поток на тысячи событий в секунду, но каждая сделка уже обязана быть в суммах.
// Что делает: помечает снимок грязным сразу, а публикует его не чаще одного раза за переданный кадр.

export class SnapshotGate {
  private scheduled = false;
  private dirty = false;

  constructor(
    private readonly requestFrame: (fn: () => void) => void,
    private readonly publish: () => void,
  ) {}

  markDirty(): void {
    this.dirty = true;
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    this.requestFrame(() => this.flush());
  }

  reset(): void {
    this.dirty = false;
  }

  private flush(): void {
    this.scheduled = false;
    if (!this.dirty) {
      return;
    }
    this.dirty = false;
    this.publish();
  }
}
