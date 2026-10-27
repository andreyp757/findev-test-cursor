// Зачем: пауза должна перестать запрашивать пачки, а Resume не имеет права догонять время простоя очередью сделок.
// Что делает: планирует один следующий тик через переданный таймер. Pause снимает тик, Resume ставит ровно один новый.

export class BatchPump<TTimer> {
  private timer: TTimer | null = null;
  private running = false;

  constructor(
    private readonly schedule: (fn: () => void, ms: number) => TTimer,
    private readonly cancel: (id: TTimer) => void,
    private readonly intervalMs: () => number,
    private readonly onBatch: () => void,
  ) {}

  start(): void {
    this.running = true;
    this.arm();
  }

  pause(): void {
    this.running = false;
    this.disarm();
  }

  resume(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    // Не догоняем паузу: один следующий тик, без пропущенных пачек.
    this.arm();
  }

  private arm(): void {
    this.disarm();
    this.timer = this.schedule(() => this.handleTick(), this.intervalMs());
  }

  private disarm(): void {
    if (this.timer === null) {
      return;
    }
    this.cancel(this.timer);
    this.timer = null;
  }

  private handleTick(): void {
    this.timer = null;
    if (!this.running) {
      return;
    }
    this.onBatch();
    if (this.running) {
      this.arm();
    }
  }
}
