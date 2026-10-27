// Зачем: кнопки и тесты должны выполнять одни и те же три действия, без отдельной реализации «для UI».
// Что делает: Pause останавливает текущий запуск, Resume продолжает его, ApplySettings после успешной проверки рождает новую сессию.

import { GeneratorSettings, SettingsDraft } from '../../settings/generator-settings';
import { settingsFromDraft, validateSettings } from '../../settings/settings-chain';
import { ProducerSession, SessionFactory } from '../session-factory/session-factory';
import { SessionEvent } from '../state/session-machine';

export interface CommandContext {
  transition(event: SessionEvent): boolean;
  session(): ProducerSession | null;
  installSession(session: ProducerSession): void;
  pauseWorker(runId: number): void;
  resumeWorker(runId: number): void;
}

export class PauseCommand {
  execute(context: CommandContext): boolean {
    const session = context.session();
    if (session === null) {
      return false;
    }
    if (!context.transition('pause')) {
      return false;
    }
    context.pauseWorker(session.runId);
    return true;
  }
}

export class ResumeCommand {
  execute(context: CommandContext): boolean {
    const session = context.session();
    if (session === null) {
      return false;
    }
    if (!context.transition('resume')) {
      return false;
    }
    context.resumeWorker(session.runId);
    return true;
  }
}

export class ApplySettingsCommand {
  constructor(
    private readonly draft: SettingsDraft,
    private readonly sessions: SessionFactory,
  ) {}

  execute(context: CommandContext): string[] {
    const errors = validateSettings(this.draft);
    if (errors.length > 0) {
      return errors;
    }
    const settings: GeneratorSettings | null = settingsFromDraft(this.draft);
    if (settings === null) {
      return errors;
    }
    if (!context.transition('apply')) {
      return ['Запуск не изменён: переход состояния недопустим.'];
    }
    context.installSession(this.sessions.create(settings));
    return [];
  }
}
