// Зачем: Resume не должен догонять паузу, и это нужно доказать без настоящего setTimeout.
// Что делает: крутит насос пачек на ручном планировщике и проверяет, что после паузы ставится один тик.

import { BatchPump } from './batch-pump';

describe('BatchPump', () => {
  it('schedules one future batch on resume and ignores a tick that fires after pause', () => {
    const pending = new Map<number, () => void>();
    let nextId = 1;
    let batches = 0;
    const pump = new BatchPump<number>(
      (fn) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, () => {
          pending.delete(id);
          fn();
        });
        return id;
      },
      (id) => {
        pending.delete(id);
      },
      () => 500,
      () => {
        batches += 1;
      },
    );

    pump.start();
    expect(pending.size).toBe(1);
    const late = [...pending.values()][0];
    pump.pause();
    expect(pending.size).toBe(0);
    late();
    expect(batches).toBe(0);

    pump.resume();
    expect(pending.size).toBe(1);
    [...pending.values()][0]();
    expect(batches).toBe(1);
    expect(pending.size).toBe(1);
  });
});
