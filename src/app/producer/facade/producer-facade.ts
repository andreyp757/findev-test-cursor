// Зачем: страницам нужен один вход в продюсер. Они не должны знать про Worker, Wasm, runId и память модуля.
// Что делает: отдаёт снимок и статус через Observable и выполняет ровно три команды — Pause, Resume и ApplySettings.

import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { blankSnapshot } from '../../metrics/instrument-book';
import { InstrumentSnapshot } from '../../metrics/metric-reading';
import {
  DEFAULT_SETTINGS,
  GeneratorSettings,
  SettingsDraft,
} from '../../settings/generator-settings';
import {
  ApplySettingsCommand,
  CommandContext,
  PauseCommand,
  ResumeCommand,
} from '../commands/commands';
import { RunGuard } from '../run-guard/run-guard';
import { ProducerSession, SessionFactory } from '../session-factory/session-factory';
import { SessionMachine, SessionPhase } from '../state/session-machine';
import { WorkerClient } from '../worker-client/worker-client';
import { FailureStage, WorkerEvent } from '../../worker/worker-protocol';

export interface ProducerStatus {
  phase: SessionPhase;
  error: string | null;
  failure: FailureStage | null;
}

@Injectable({ providedIn: 'root' })
export class ProducerFacade implements OnDestroy {
  private readonly worker = inject(WorkerClient);
  private readonly sessions = new SessionFactory();
  private readonly machine = new SessionMachine();
  private session: ProducerSession | null = null;
  private readonly guard = new RunGuard(() => this.session?.runId ?? null);
  private readonly subscription: Subscription;
  private readonly context: CommandContext;
  private applied: GeneratorSettings = DEFAULT_SETTINGS;

  private readonly snapshotSubject = new BehaviorSubject<readonly InstrumentSnapshot[]>([]);
  private readonly statusSubject = new BehaviorSubject<ProducerStatus>({
    phase: 'idle',
    error: null,
    failure: null,
  });
  private readonly appliedSubject = new BehaviorSubject<GeneratorSettings>(DEFAULT_SETTINGS);

  readonly snapshot$: Observable<readonly InstrumentSnapshot[]> =
    this.snapshotSubject.asObservable();
  readonly status$: Observable<ProducerStatus> = this.statusSubject.asObservable();
  readonly appliedSettings$: Observable<GeneratorSettings> = this.appliedSubject.asObservable();

  constructor() {
    this.context = {
      transition: (event) => this.machine.transition(event),
      session: () => this.session,
      installSession: (session) => this.installSession(session),
      pauseWorker: (runId) => this.worker.pause(runId),
      resumeWorker: (runId) => this.worker.resume(runId),
    };
    this.subscription = this.worker.events$.subscribe((event) => this.onWorkerEvent(event));
    this.apply(DEFAULT_SETTINGS);
  }

  currentSettings(): GeneratorSettings {
    return { ...this.applied };
  }

  pause(): void {
    if (new PauseCommand().execute(this.context)) {
      this.publishStatus(null);
    }
  }

  resume(): void {
    if (new ResumeCommand().execute(this.context)) {
      this.publishStatus(null);
    }
  }

  apply(draft: SettingsDraft): string[] {
    return new ApplySettingsCommand(draft, this.sessions).execute(this.context);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.worker.terminate();
  }

  private installSession(session: ProducerSession): void {
    this.session = session;
    this.applied = {
      instrumentCount: session.instruments.length,
      updatesPerBatch: session.updatesPerBatch,
      batchIntervalMs: session.batchIntervalMs,
    };
    this.appliedSubject.next(this.applied);
    // Новый запуск обнуляет суммы: на экран сразу уходит пустой снимок.
    this.snapshotSubject.next(blankSnapshot(session.instruments));
    this.publishStatus(null);
    this.worker.start(session);
  }

  private onWorkerEvent(event: WorkerEvent): void {
    const accepted = this.guard.accept(event);
    if (accepted === null) {
      return;
    }
    if (accepted.type === 'snapshot') {
      this.snapshotSubject.next(accepted.rows);
      return;
    }
    if (accepted.type === 'started') {
      if (this.machine.transition('ready')) {
        this.publishStatus(null);
      }
      return;
    }
    if (this.machine.transition('fail')) {
      this.publishStatus(accepted.message, accepted.stage);
    }
  }

  private publishStatus(error: string | null, failure: FailureStage | null = null): void {
    this.statusSubject.next({ phase: this.machine.phase, error, failure });
  }
}
