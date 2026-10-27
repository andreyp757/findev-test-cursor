// Зачем: фасаду нужен один способ говорить с воркером, а страница не должна создавать Worker сама.
// Что делает: поднимает единственный Worker, передаёт команды сессии и завершает его ровно один раз.

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
  private readonly worker: WorkerLike;
  private readonly incoming = new Subject<WorkerEvent>();
  private terminated = false;
  private lastRunId = 0;

  readonly events$: Observable<WorkerEvent> = this.incoming.asObservable();

  constructor(spawn: () => WorkerLike = spawnMarketWorker) {
    this.worker = spawn();
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      this.incoming.next(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      const detail = event.message ? `: ${event.message}` : '';
      this.incoming.next({
        type: 'failed',
        runId: this.lastRunId,
        message: `Не удалось запустить Web Worker генератора${detail}.`,
      });
    };
  }

  start(session: ProducerSession): void {
    this.lastRunId = session.runId;
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
    this.worker.terminate();
    this.incoming.complete();
  }

  private post(message: WorkerCommand): void {
    if (this.terminated) {
      return;
    }
    this.worker.postMessage(message);
  }
}
