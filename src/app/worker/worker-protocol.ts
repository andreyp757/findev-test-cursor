// Зачем: главный поток и воркер должны договориться о сообщениях в одном месте, иначе runId легко потерять по дороге.
// Что делает: описывает команды старта, паузы и продолжения и ответы: сессия поднялась, снимок или ошибка старта либо работы.

import { InstrumentSnapshot } from '../metrics/metric-reading';

export interface StartCommand {
  type: 'start';
  runId: number;
  seed: number;
  instruments: string[];
  updatesPerBatch: number;
  batchIntervalMs: number;
}

export interface PauseCommand {
  type: 'pause';
  runId: number;
}

export interface ResumeCommand {
  type: 'resume';
  runId: number;
}

export type WorkerCommand = StartCommand | PauseCommand | ResumeCommand;

export interface StartedEvent {
  type: 'started';
  runId: number;
}

export type FailureStage = 'startup' | 'runtime';

export interface FailedEvent {
  type: 'failed';
  runId: number;
  stage: FailureStage;
  message: string;
}

export interface SnapshotEvent {
  type: 'snapshot';
  runId: number;
  rows: InstrumentSnapshot[];
}

export type WorkerEvent = StartedEvent | FailedEvent | SnapshotEvent;
