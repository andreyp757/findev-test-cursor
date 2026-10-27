// Зачем: снимок уходит не чаще кадра, но обе сделки пачки уже должны сидеть в суммах к моменту отправки.
// Что делает: вызывает кадр вручную и проверяет, что два markDirty дают одну публикацию уже с полной суммой.

import { SnapshotGate } from './snapshot-gate';

describe('SnapshotGate', () => {
  it('publishes once per frame after every marked update is already included', () => {
    const frames: Array<() => void> = [];
    let volume = 0;
    let published = -1;
    const gate = new SnapshotGate(
      (fn) => {
        frames.push(fn);
      },
      () => {
        published = volume;
      },
    );

    volume += 10;
    gate.markDirty();
    volume += 30;
    gate.markDirty();

    expect(frames).toHaveLength(1);
    expect(published).toBe(-1);
    frames[0]();
    expect(published).toBe(40);
  });

  it('does not publish a frame that was reset before it flushed', () => {
    const frames: Array<() => void> = [];
    let published = 0;
    const gate = new SnapshotGate(
      (fn) => {
        frames.push(fn);
      },
      () => {
        published += 1;
      },
    );

    gate.markDirty();
    gate.reset();
    frames[0]();
    expect(published).toBe(0);
  });
});
