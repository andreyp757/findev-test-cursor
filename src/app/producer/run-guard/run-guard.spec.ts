// Зачем: защищающий прокси — прямой пункт про сообщение прошлого запуска. Его нельзя проверять только глазами.
// Что делает: пропускает сообщение с текущим runId и возвращает null для любого другого, не читая полезную нагрузку.

import { RunGuard } from './run-guard';

describe('RunGuard', () => {
  it('drops a whole message whose run id is not the current session', () => {
    const guard = new RunGuard(() => 2);
    const foreign = { runId: 1, rows: [{ symbol: 'NOPE' }], message: 'старый запуск' };

    expect(guard.accept(foreign)).toBeNull();
    expect(guard.accept({ runId: 2, rows: [{ symbol: 'ALFA' }] })).toEqual({
      runId: 2,
      rows: [{ symbol: 'ALFA' }],
    });
    expect(new RunGuard(() => null).accept(foreign)).toBeNull();
  });
});
