// Зачем: фабрика — единственное место, где появляются runId и имена. Их легко захардкодить и сломать Apply.
// Что делает: проверяет имена ALFA/BETA, уникальность пятидесяти тикеров, новый runId и переданный seed.

import { DEFAULT_SETTINGS } from '../../settings/generator-settings';
import { SessionFactory, instrumentNames } from './session-factory';

describe('SessionFactory', () => {
  it('builds the instrument list from the count instead of inventing one', () => {
    expect(instrumentNames(2)).toEqual(['ALFA', 'BETA']);
    expect(instrumentNames(5)).toHaveLength(5);
    const all = instrumentNames(50);
    expect(all).toHaveLength(50);
    expect(new Set(all).size).toBe(50);
  });

  it('gives every session a new run id and the requested batch settings', () => {
    const factory = new SessionFactory(() => 99);
    const first = factory.create(DEFAULT_SETTINGS);
    const second = factory.create({ ...DEFAULT_SETTINGS, instrumentCount: 2 });

    expect(first.runId).toBe(1);
    expect(second.runId).toBe(2);
    expect(first.seed).toBe(99);
    expect(second.seed).toBe(99);
    expect(first.instruments).toEqual(['ALFA', 'BETA', 'GAMA', 'DLTA', 'EPSI']);
    expect(second.instruments).toEqual(['ALFA', 'BETA']);
    expect(second.updatesPerBatch).toBe(100);
    expect(second.batchIntervalMs).toBe(500);
  });
});
