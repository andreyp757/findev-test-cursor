// Зачем: Apply, пауза и чужой runId — поведение, которое легко сломать по частям и не заметить в кнопке.
// Что делает: гоняет фасад через фальшивый воркер, без Wasm и без ожидания таймера.

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { InstrumentSnapshot } from '../../metrics/metric-reading';
import { DEFAULT_SETTINGS } from '../../settings/generator-settings';
import { ProducerSession } from '../session-factory/session-factory';
import { WorkerClient } from '../worker-client/worker-client';
import { WorkerCommand, WorkerEvent } from '../../worker/worker-protocol';
import { ProducerFacade, ProducerStatus } from './producer-facade';

class FakeWorkerClient {
  readonly events$ = new Subject<WorkerEvent>();
  readonly commands: WorkerCommand[] = [];
  terminateCalls = 0;
  private closed = false;

  start(session: ProducerSession): void {
    this.commands.push({
      type: 'start',
      runId: session.runId,
      seed: session.seed,
      instruments: [...session.instruments],
      updatesPerBatch: session.updatesPerBatch,
      batchIntervalMs: session.batchIntervalMs,
    });
    this.events$.next({ type: 'started', runId: session.runId });
  }

  pause(runId: number): void {
    this.commands.push({ type: 'pause', runId });
  }

  resume(runId: number): void {
    this.commands.push({ type: 'resume', runId });
  }

  terminate(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.terminateCalls += 1;
    this.events$.complete();
  }
}

function isStart(command: WorkerCommand): command is Extract<WorkerCommand, { type: 'start' }> {
  return command.type === 'start';
}

function row(symbol: string, volume: number): InstrumentSnapshot {
  return {
    symbol,
    last: { kind: 'price', cents: 10_200 },
    spread: { kind: 'price', cents: 4 },
    volume: { kind: 'quantity', value: volume },
    vwap: { kind: 'vwap', notionalCents: 10_200 * volume, volume },
    imbalance: { kind: 'ratio', value: 0.2 },
  };
}

describe('ProducerFacade', () => {
  let fake: FakeWorkerClient;

  beforeEach(() => {
    fake = new FakeWorkerClient();
    TestBed.configureTestingModule({
      providers: [{ provide: WorkerClient, useValue: fake }],
    });
  });

  afterEach(() => {
    TestBed.inject(ProducerFacade).ngOnDestroy();
  });

  it('starts one default run and does not reset it when Apply is invalid', () => {
    const facade = TestBed.inject(ProducerFacade);
    const snapshots: InstrumentSnapshot[][] = [];
    const statuses: ProducerStatus[] = [];
    facade.snapshot$.subscribe((rows) => snapshots.push([...rows]));
    facade.status$.subscribe((status) => statuses.push(status));

    expect(fake.commands.filter(isStart)).toHaveLength(1);
    expect(snapshots.at(-1)?.map((item) => item.symbol)).toEqual([
      'ALFA',
      'BETA',
      'GAMA',
      'DLTA',
      'EPSI',
    ]);
    expect(statuses.at(-1)?.phase).toBe('running');

    const before = snapshots.length;
    const errors = facade.apply({
      instrumentCount: 0,
      updatesPerBatch: 1.5,
      batchIntervalMs: 10,
    });

    expect(errors).toHaveLength(3);
    expect(fake.commands.filter(isStart)).toHaveLength(1);
    expect(snapshots).toHaveLength(before);
    expect(statuses.at(-1)?.phase).toBe('running');
  });

  it('resets totals on Apply and drops a snapshot from the previous run', () => {
    const facade = TestBed.inject(ProducerFacade);
    const snapshots: InstrumentSnapshot[][] = [];
    facade.snapshot$.subscribe((rows) => snapshots.push([...rows]));
    const first = fake.commands.filter(isStart)[0];

    fake.events$.next({
      type: 'snapshot',
      runId: first.runId,
      rows: ['ALFA', 'BETA', 'GAMA', 'DLTA', 'EPSI'].map((symbol) => row(symbol, 40)),
    });
    expect(snapshots.at(-1)?.[0].volume).toEqual({ kind: 'quantity', value: 40 });

    const errors = facade.apply({
      instrumentCount: 2,
      updatesPerBatch: 100,
      batchIntervalMs: 500,
    });
    expect(errors).toEqual([]);
    expect(snapshots.at(-1)?.map((item) => item.symbol)).toEqual(['ALFA', 'BETA']);
    expect(snapshots.at(-1)?.[0]).toEqual({
      symbol: 'ALFA',
      last: { kind: 'unavailable' },
      spread: { kind: 'unavailable' },
      volume: { kind: 'quantity', value: 0 },
      vwap: { kind: 'unavailable' },
      imbalance: { kind: 'unavailable' },
    });

    fake.events$.next({
      type: 'snapshot',
      runId: first.runId,
      rows: [row('NOPE', 999)],
    });
    expect(snapshots.at(-1)?.map((item) => item.symbol)).toEqual(['ALFA', 'BETA']);
    expect(snapshots.at(-1)?.[0].volume).toEqual({ kind: 'quantity', value: 0 });

    const second = fake.commands.filter(isStart)[1];
    fake.events$.next({
      type: 'snapshot',
      runId: second.runId,
      rows: [row('ALFA', 3), row('BETA', 4)],
    });
    expect(snapshots.at(-1)?.[0].volume).toEqual({ kind: 'quantity', value: 3 });
    expect(snapshots.at(-1)?.[1].volume).toEqual({ kind: 'quantity', value: 4 });
    expect(fake.terminateCalls).toBe(0);
  });

  it('keeps the snapshot across pause and resume', () => {
    const facade = TestBed.inject(ProducerFacade);
    const snapshots: InstrumentSnapshot[][] = [];
    facade.snapshot$.subscribe((rows) => snapshots.push([...rows]));
    const runId = fake.commands.filter(isStart)[0].runId;
    fake.events$.next({
      type: 'snapshot',
      runId,
      rows: ['ALFA', 'BETA', 'GAMA', 'DLTA', 'EPSI'].map((symbol) => row(symbol, 40)),
    });

    facade.pause();
    facade.pause();
    expect(fake.commands.filter((command) => command.type === 'pause')).toEqual([
      { type: 'pause', runId },
    ]);
    expect(snapshots.at(-1)?.[0].volume).toEqual({ kind: 'quantity', value: 40 });

    facade.resume();
    expect(fake.commands.at(-1)).toEqual({ type: 'resume', runId });
    expect(snapshots.at(-1)?.[0].volume).toEqual({ kind: 'quantity', value: 40 });

    facade.resume();
    expect(fake.commands.filter((command) => command.type === 'resume')).toHaveLength(1);
  });

  it('Apply from pause starts a new run instead of only resuming', () => {
    const facade = TestBed.inject(ProducerFacade);
    const statuses: ProducerStatus[] = [];
    const snapshots: InstrumentSnapshot[][] = [];
    facade.status$.subscribe((status) => statuses.push(status));
    facade.snapshot$.subscribe((rows) => snapshots.push([...rows]));
    facade.pause();

    const errors = facade.apply({
      instrumentCount: 3,
      updatesPerBatch: 10,
      batchIntervalMs: 50,
    });

    expect(errors).toEqual([]);
    expect(statuses.at(-1)).toEqual({ phase: 'running', error: null });
    expect(fake.commands.filter(isStart).at(-1)?.instruments).toEqual(['ALFA', 'BETA', 'GAMA']);
    expect(
      snapshots.at(-1)?.every((item) => item.volume.kind === 'quantity' && item.volume.value === 0),
    ).toBe(true);
    expect(fake.commands.at(-1)?.type).toBe('start');
  });

  it('ignores a failure from the previous run and shows one from the current run', () => {
    const facade = TestBed.inject(ProducerFacade);
    const first = fake.commands.filter(isStart)[0];
    facade.apply(DEFAULT_SETTINGS);
    const second = fake.commands.filter(isStart)[1];
    const statuses: ProducerStatus[] = [];
    facade.status$.subscribe((status) => statuses.push(status));

    fake.events$.next({ type: 'failed', runId: first.runId, message: 'старый запуск' });
    expect(statuses.at(-1)).toEqual({ phase: 'running', error: null });

    fake.events$.next({
      type: 'failed',
      runId: second.runId,
      message: 'Не удалось инициализировать генератор Wasm: нет модуля',
    });
    expect(statuses.at(-1)).toEqual({
      phase: 'failed',
      error: 'Не удалось инициализировать генератор Wasm: нет модуля',
    });
  });

  it('asks the worker to terminate once when the facade is destroyed twice', () => {
    const facade = TestBed.inject(ProducerFacade);
    facade.ngOnDestroy();
    facade.ngOnDestroy();
    expect(fake.terminateCalls).toBe(1);
  });
});
