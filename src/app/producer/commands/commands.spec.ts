// Зачем: команда — общий путь кнопки и теста. Отклонённый переход не должен доходить до воркера или фабрики.
// Что делает: гоняет Pause, Resume и ApplySettings на подставном контексте без Angular и без таймера.

import { GeneratorSettings } from '../../settings/generator-settings';
import { ProducerSession, SessionFactory } from '../session-factory/session-factory';
import { ApplySettingsCommand, CommandContext, PauseCommand, ResumeCommand } from './commands';

class CountingFactory extends SessionFactory {
  created = 0;

  override create(settings: GeneratorSettings): ProducerSession {
    this.created += 1;
    return super.create(settings);
  }
}

function context(transitionResult: boolean): {
  context: CommandContext;
  installed: ProducerSession[];
  pauses: number[];
  resumes: number[];
  transitions: number;
} {
  const installed: ProducerSession[] = [];
  const pauses: number[] = [];
  const resumes: number[] = [];
  let transitions = 0;
  const commandContext: CommandContext = {
    transition: () => {
      transitions += 1;
      return transitionResult;
    },
    session: () => ({
      runId: 7,
      seed: 1,
      instruments: ['ALFA'],
      updatesPerBatch: 100,
      batchIntervalMs: 500,
    }),
    installSession: (session) => {
      installed.push(session);
    },
    pauseWorker: (runId) => {
      pauses.push(runId);
    },
    resumeWorker: (runId) => {
      resumes.push(runId);
    },
  };
  return {
    context: commandContext,
    installed,
    pauses,
    resumes,
    get transitions() {
      return transitions;
    },
  };
}

describe('commands', () => {
  it('does not pause or resume when the transition is rejected', () => {
    const paused = context(false);
    expect(new PauseCommand().execute(paused.context)).toBe(false);
    expect(paused.pauses).toEqual([]);

    const resumed = context(false);
    expect(new ResumeCommand().execute(resumed.context)).toBe(false);
    expect(resumed.resumes).toEqual([]);
  });

  it('pauses and resumes the current run when the transition is allowed', () => {
    const paused = context(true);
    expect(new PauseCommand().execute(paused.context)).toBe(true);
    expect(paused.pauses).toEqual([7]);

    const resumed = context(true);
    expect(new ResumeCommand().execute(resumed.context)).toBe(true);
    expect(resumed.resumes).toEqual([7]);
  });

  it('does not create a session when settings are invalid', () => {
    const factory = new CountingFactory();
    const harness = context(true);
    const errors = new ApplySettingsCommand(
      { instrumentCount: 0, updatesPerBatch: 1.5, batchIntervalMs: 10 },
      factory,
    ).execute(harness.context);

    expect(errors).toHaveLength(3);
    expect(factory.created).toBe(0);
    expect(harness.installed).toEqual([]);
    expect(harness.transitions).toBe(0);
  });

  it('creates a clean session only after Apply is accepted', () => {
    const factory = new CountingFactory(() => 5);
    const harness = context(true);
    const errors = new ApplySettingsCommand(
      { instrumentCount: 2, updatesPerBatch: 10, batchIntervalMs: 50 },
      factory,
    ).execute(harness.context);

    expect(errors).toEqual([]);
    expect(factory.created).toBe(1);
    expect(harness.installed).toHaveLength(1);
    expect(harness.installed[0]?.instruments).toEqual(['ALFA', 'BETA']);
    expect(harness.installed[0]?.seed).toBe(5);
    expect(harness.installed[0]?.updatesPerBatch).toBe(10);
    expect(harness.installed[0]?.batchIntervalMs).toBe(50);
  });

  it('does not create a session when Apply is not a legal transition', () => {
    const factory = new CountingFactory();
    const harness = context(false);
    const errors = new ApplySettingsCommand(
      { instrumentCount: 2, updatesPerBatch: 10, batchIntervalMs: 50 },
      factory,
    ).execute(harness.context);

    expect(errors).toEqual(['Запуск не изменён: переход состояния недопустим.']);
    expect(factory.created).toBe(0);
    expect(harness.installed).toEqual([]);
  });
});
