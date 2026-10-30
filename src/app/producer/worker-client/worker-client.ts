// Зачем: фасаду нужен один способ говорить с воркером, а страница не должна создавать Worker сама.
// Что делает: держит один Worker на приложение. Если он умер при загрузке или необработанной ошибке, следующий start поднимает новый. При уничтожении сервиса завершает текущий воркер ровно один раз.

import { Observable, Subject } from 'rxjs';
import { ProducerSession } from '../session-factory/session-factory';
import { WorkerCommand, WorkerEvent } from '../../worker/worker-protocol';

export interface WorkerLike {
  postMessage(message: WorkerCommand): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

function spawnMarketWorker(): WorkerLike {
  return new Worker(new URL('../../worker/market.worker', import.meta.url), {
    type: 'module',
  });
}

export class WorkerClient {
  private worker: WorkerLike | null = null;
  private readonly incoming = new Subject<WorkerEvent>();
  private readonly spawn: () => WorkerLike;
  private spawnError: string | null = null;
  private terminated = false;
  private lastRunId = 0;
  private generationStarted = false;

  readonly events$: Observable<WorkerEvent> = this.incoming.asObservable();

  constructor(spawn: () => WorkerLike = spawnMarketWorker) {
    this.spawn = spawn;
    this.worker = this.openWorker();
  }

  start(session: ProducerSession): void {
    this.lastRunId = session.runId;
    this.generationStarted = false;
    if (this.worker === null) {
      this.worker = this.openWorker();
    }
    if (this.worker === null) {
      this.emit({
        type: 'failed',
        runId: session.runId,
        stage: 'startup',
        message: `Не удалось запустить Web Worker генератора: ${this.spawnError ?? 'неизвестная ошибка'}.`,
      });
      return;
    }
    this.post({
      type: 'start',
      runId: session.runId,
      seed: session.seed,
      instruments: [...session.instruments],
      updatesPerBatch: session.updatesPerBatch,
      batchIntervalMs: session.batchIntervalMs,
    });
  }

  pause(runId: number): void {
    this.post({ type: 'pause', runId });
  }

  resume(runId: number): void {
    this.post({ type: 'resume', runId });
  }

  terminate(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.worker?.terminate();
    this.incoming.complete();
  }

  private openWorker(): WorkerLike | null {
    if (this.terminated) {
      return null;
    }
    try {
      const worker = this.spawn();
      this.bind(worker);
      this.spawnError = null;
      return worker;
    } catch (error) {
      this.spawnError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  private bind(worker: WorkerLike): void {
    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      if (this.worker !== worker) {
        return;
      }
      if (event.data.type === 'started' && event.data.runId === this.lastRunId) {
        this.generationStarted = true;
      }
      this.emit(event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      if (this.terminated || this.worker !== worker) {
        return;
      }
      const detail = event.message ? `: ${event.message}` : '';
      const stage = this.generationStarted ? 'runtime' : 'startup';
      const message =
        stage === 'startup'
          ? `Не удалось запустить Web Worker генератора${detail}.`
          : `Генератор остановился${detail}.`;
      this.emit({
        type: 'failed',
        runId: this.lastRunId,
        stage,
        message,
      });
      // Мёртвый воркер больше не ответит на Apply. Следующий start поднимет новый.
      this.dropWorker(worker);
    };
  }

  private dropWorker(worker: WorkerLike): void {
    if (this.worker !== worker) {
      return;
    }
    this.worker = null;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }

  private post(message: WorkerCommand): void {
    if (this.terminated || this.worker === null) {
      return;
    }
    this.worker.postMessage(message);
  }

  private emit(event: WorkerEvent): void {
    if (this.terminated) {
      return;
    }
    this.incoming.next(event);
  }
}
