// Зачем: Wasm и свёртка метрик должны идти вне главного потока, иначе интерфейс замирает на верхней скорости пачек.
// Что делает: держит один генератор на сессию, учитывает каждое событие сразу и отправляет снимок не чаще одного кадра. При замене сессии освобождает прошлый генератор.

import init, { MarketGenerator } from '../../../public/market-wasm/market_producer.js';
import { InstrumentBook } from '../metrics/instrument-book';
import { readMarketUpdates } from '../wasm/wasm-adapter';
import { BatchPump } from './batch-pump';
import { SnapshotGate } from './snapshot-gate';
import { StartCommand, WorkerCommand, WorkerEvent } from './worker-protocol';

interface SessionState {
  runId: number;
  generator: MarketGenerator;
  book: InstrumentBook;
  instruments: readonly string[];
  updatesPerBatch: number;
  batchIntervalMs: number;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null;
  postMessage(message: WorkerEvent): void;
};

let memory: WebAssembly.Memory | null = null;
let loading: Promise<WebAssembly.Memory> | null = null;
let session: SessionState | null = null;
let acceptedRunId = 0;

function post(message: WorkerEvent): void {
  scope.postMessage(message);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadWasm(): Promise<WebAssembly.Memory> {
  if (memory) {
    return Promise.resolve(memory);
  }
  if (!loading) {
    loading = init({ module_or_path: '/market-wasm/market_producer_bg.wasm' })
      .then((loaded) => {
        memory = loaded.memory;
        return loaded.memory;
      })
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

function releaseGenerator(): void {
  const current = session;
  session = null;
  try {
    current?.generator.free();
  } catch {
    // После паники Wasm объект уже непригоден. Ссылку мы отпустили до free.
  }
}

const requestFrame =
  typeof requestAnimationFrame === 'function'
    ? (fn: () => void) => {
        requestAnimationFrame(fn);
      }
    : (fn: () => void) => {
        setTimeout(fn, 16);
      };

const gate = new SnapshotGate(requestFrame, () => {
  if (session === null) {
    return;
  }
  post({ type: 'snapshot', runId: session.runId, rows: session.book.snapshot() });
});

const pump = new BatchPump<number>(
  (fn, ms) => setTimeout(fn, ms),
  (id) => {
    clearTimeout(id);
  },
  () => session?.batchIntervalMs ?? 500,
  () => {
    produceBatch();
  },
);

function produceBatch(): void {
  const current = session;
  const wasmMemory = memory;
  if (current === null || wasmMemory === null) {
    return;
  }
  try {
    const pointer = current.generator.fillBatch(current.updatesPerBatch);
    const updates = readMarketUpdates(
      wasmMemory,
      pointer,
      current.updatesPerBatch,
      current.instruments,
    );
    // Суммы обновляются сразу, снимок уходит не чаще одного кадра.
    for (const update of updates) {
      current.book.apply(update);
    }
    gate.markDirty();
  } catch (error) {
    pump.pause();
    releaseGenerator();
    post({
      type: 'failed',
      runId: current.runId,
      stage: 'runtime',
      message: `Генератор остановился: ${messageOf(error)}`,
    });
  }
}

async function startSession(command: StartCommand): Promise<void> {
  acceptedRunId = command.runId;
  try {
    pump.pause();
    releaseGenerator();
    gate.reset();
    await loadWasm();
    // Старое сообщение инициализации не имеет права поднять генератор поверх нового запуска.
    if (acceptedRunId !== command.runId) {
      return;
    }
    const generator = new MarketGenerator(command.seed, [...command.instruments]);
    let book: InstrumentBook;
    try {
      book = new InstrumentBook(command.instruments);
    } catch (error) {
      try {
        generator.free();
      } catch {
        // Конструктор книги упал, а объект Wasm уже непригоден.
      }
      throw error;
    }
    session = {
      runId: command.runId,
      generator,
      book,
      instruments: command.instruments,
      updatesPerBatch: command.updatesPerBatch,
      batchIntervalMs: command.batchIntervalMs,
    };
    post({ type: 'started', runId: command.runId });
    pump.start();
  } catch (error) {
    if (acceptedRunId !== command.runId) {
      return;
    }
    pump.pause();
    post({
      type: 'failed',
      runId: command.runId,
      stage: 'startup',
      message: `Не удалось инициализировать генератор Wasm: ${messageOf(error)}`,
    });
  }
}

function pauseSession(runId: number): void {
  if (session?.runId !== runId) {
    return;
  }
  pump.pause();
}

function resumeSession(runId: number): void {
  if (session?.runId !== runId) {
    return;
  }
  pump.resume();
}

scope.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  if (command.type === 'start') {
    void startSession(command);
    return;
  }
  if (command.type === 'pause') {
    pauseSession(command.runId);
    return;
  }
  resumeSession(command.runId);
};
