// Зачем: недопустимый переход не должен менять фазу, иначе пауза из паузы или resume на ходу сотрут смысл автомата.
// Что делает: проходит таблицу разрешённых переходов и проверяет, что запрещённые оставляют фазу на месте.

import { SessionEvent, SessionMachine, SessionPhase } from './session-machine';

const PATH: Record<SessionPhase, SessionEvent[]> = {
  idle: [],
  starting: ['apply'],
  running: ['apply', 'ready'],
  paused: ['apply', 'ready', 'pause'],
  failed: ['apply', 'fail'],
};

function machineAt(phase: SessionPhase): SessionMachine {
  const machine = new SessionMachine();
  for (const event of PATH[phase]) {
    expect(machine.transition(event)).toBe(true);
  }
  expect(machine.phase).toBe(phase);
  return machine;
}

describe('SessionMachine', () => {
  it('follows the legal lifecycle', () => {
    const legal: Array<[SessionPhase, SessionEvent, SessionPhase]> = [
      ['idle', 'apply', 'starting'],
      ['starting', 'ready', 'running'],
      ['starting', 'fail', 'failed'],
      ['starting', 'apply', 'starting'],
      ['running', 'pause', 'paused'],
      ['running', 'fail', 'failed'],
      ['running', 'apply', 'starting'],
      ['paused', 'resume', 'running'],
      ['paused', 'fail', 'failed'],
      ['paused', 'apply', 'starting'],
      ['failed', 'apply', 'starting'],
    ];

    for (const [from, event, to] of legal) {
      const machine = machineAt(from);
      expect(machine.transition(event)).toBe(true);
      expect(machine.phase).toBe(to);
    }
  });

  it('keeps the phase when the transition is illegal', () => {
    const illegal: Array<[SessionPhase, SessionEvent]> = [
      ['idle', 'pause'],
      ['idle', 'resume'],
      ['idle', 'ready'],
      ['idle', 'fail'],
      ['starting', 'pause'],
      ['starting', 'resume'],
      ['running', 'resume'],
      ['running', 'ready'],
      ['paused', 'pause'],
      ['failed', 'pause'],
      ['failed', 'resume'],
      ['failed', 'ready'],
      ['failed', 'fail'],
    ];

    for (const [from, event] of illegal) {
      const machine = machineAt(from);
      expect(machine.transition(event)).toBe(false);
      expect(machine.phase).toBe(from);
    }
  });
});
