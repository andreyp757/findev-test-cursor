// Зачем: жизненный цикл сессии нельзя размазывать по if в кнопках, иначе Pause из паузы или Apply случайно заденут суммы.
// Что делает: хранит фазу idle, starting, running, paused или failed и таблицу допустимых переходов. Недопустимый переход возвращает false и фазу не меняет.

export type SessionPhase = 'idle' | 'starting' | 'running' | 'paused' | 'failed';

export type SessionEvent = 'apply' | 'ready' | 'pause' | 'resume' | 'fail';

const TRANSITIONS: Record<SessionPhase, Partial<Record<SessionEvent, SessionPhase>>> = {
  idle: { apply: 'starting' },
  starting: { ready: 'running', fail: 'failed', apply: 'starting' },
  running: { pause: 'paused', fail: 'failed', apply: 'starting' },
  paused: { resume: 'running', fail: 'failed', apply: 'starting' },
  failed: { apply: 'starting' },
};

export class SessionMachine {
  phase: SessionPhase = 'idle';

  transition(event: SessionEvent): boolean {
    const next = TRANSITIONS[this.phase][event];
    if (next === undefined) {
      return false;
    }
    this.phase = next;
    return true;
  }
}
