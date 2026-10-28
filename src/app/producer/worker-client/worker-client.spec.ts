// Зачем: при уничтожении сервиса worker.terminate() должен вызваться один раз, даже если destroy придёт повторно.
// Что делает: подставляет фальшивый Worker и проверяет однократный terminate и молчание после него.

import { ProducerSession } from '../session-factory/session-factory';
import { WorkerCommand, WorkerEvent } from '../../worker/worker-protocol';
import { WorkerClient, WorkerLike } from './worker-client';

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
