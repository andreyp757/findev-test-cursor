// Зачем: при уничтожении сервиса worker.terminate() должен вызваться один раз, даже если destroy придёт повторно.
// Что делает: подставляет фальшивый Worker и проверяет однократный terminate и молчание после него.

import { ProducerSession } from '../session-factory/session-factory';
import { WorkerCommand, WorkerEvent } from '../../worker/worker-protocol';
import { WorkerClient, WorkerLike } from './worker-client';

function session(runId: number): ProducerSession {
  return {
    runId,
    seed: 1,
    instruments: ['ALFA'],
    updatesPerBatch: 1,
    batchIntervalMs: 50,
  };
}

describe('WorkerClient', () => {
  it('terminates the worker once and ignores commands afterwards', () => {
    const messages: WorkerCommand[] = [];
    let terminated = 0;
    const worker: WorkerLike = {
      postMessage: (message) => {
        messages.push(message);
      },
      terminate: () => {
        terminated += 1;
      },
      onmessage: null,
      onerror: null,
    };
    const client = new WorkerClient(() => worker);
    const session: ProducerSession = {
      runId: 3,
      seed: 1,
      instruments: ['ALFA'],
      updatesPerBatch: 1,
      batchIntervalMs: 50,
    };

    client.start(session);
    client.terminate();
    client.terminate();
    client.pause(3);

    expect(terminated).toBe(1);
    expect(messages).toEqual([
      {
        type: 'start',
        runId: 3,
        seed: 1,
        instruments: ['ALFA'],
        updatesPerBatch: 1,
        batchIntervalMs: 50,
      },
    ]);
  });

  it('forwards a worker message to subscribers', () => {
    const worker: WorkerLike = {
      postMessage: () => undefined,
      terminate: () => undefined,
      onmessage: null,
      onerror: null,
    };
    const client = new WorkerClient(() => worker);
    const received: WorkerEvent[] = [];
    client.events$.subscribe((event) => received.push(event));
    worker.onmessage?.({ data: { type: 'started', runId: 4 } } as MessageEvent<WorkerEvent>);

    expect(received).toEqual([{ type: 'started', runId: 4 }]);
  });

  it('reports a constructor failure when start is called', () => {
    const client = new WorkerClient(() => {
      throw new Error('blocked');
    });
    const received: WorkerEvent[] = [];
    client.events$.subscribe((event) => received.push(event));
    client.start(session(9));

    expect(received).toEqual([
      {
        type: 'failed',
        runId: 9,
        stage: 'startup',
        message: 'Не удалось запустить Web Worker генератора: blocked.',
      },
    ]);
  });

  it('reports a worker error after generation started as a runtime failure', () => {
    const worker: WorkerLike = {
      postMessage: () => undefined,
      terminate: () => undefined,
      onmessage: null,
      onerror: null,
    };
    const client = new WorkerClient(() => worker);
    const received: WorkerEvent[] = [];
    client.events$.subscribe((event) => received.push(event));
    client.start(session(4));
    worker.onmessage?.({ data: { type: 'started', runId: 4 } } as MessageEvent<WorkerEvent>);
    worker.onerror?.({ message: 'panic' } as ErrorEvent);

    expect(received.at(-1)).toEqual({
      type: 'failed',
      runId: 4,
      stage: 'runtime',
      message: 'Генератор остановился: panic.',
    });
  });

  it('replaces a worker that died on load and starts the next run on the new one', () => {
    const posted: WorkerCommand[][] = [];
    const terminated: number[] = [];
    const workers: WorkerLike[] = [];
    const client = new WorkerClient(() => {
      const mine: WorkerCommand[] = [];
      const index = workers.length;
      posted.push(mine);
      terminated.push(0);
      const worker: WorkerLike = {
        postMessage: (message) => {
          mine.push(message);
        },
        terminate: () => {
          terminated[index] += 1;
        },
        onmessage: null,
        onerror: null,
      };
      workers.push(worker);
      return worker;
    });
    const received: WorkerEvent[] = [];
    client.events$.subscribe((event) => received.push(event));

    client.start(session(1));
    workers[0].onerror?.({ message: 'load failed' } as ErrorEvent);
    client.start(session(2));

    expect(workers).toHaveLength(2);
    expect(terminated[0]).toBe(1);
    expect(received[0]).toEqual({
      type: 'failed',
      runId: 1,
      stage: 'startup',
      message: 'Не удалось запустить Web Worker генератора: load failed.',
    });
    expect(posted[1]).toEqual([
      {
        type: 'start',
        runId: 2,
        seed: 1,
        instruments: ['ALFA'],
        updatesPerBatch: 1,
        batchIntervalMs: 50,
      },
    ]);
  });

  it('ignores an error that arrives after terminate', () => {
    const worker: WorkerLike = {
      postMessage: () => undefined,
      terminate: () => undefined,
      onmessage: null,
      onerror: null,
    };
    const client = new WorkerClient(() => worker);
    client.terminate();

    expect(() => {
      worker.onerror?.({ message: 'gone' } as ErrorEvent);
    }).not.toThrow();
  });
});
