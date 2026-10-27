// Зачем: сессия должна рождаться в одном методе, иначе страница при переходе маршрута соберёт второй запуск.
// Что делает: выдаёт новый runId, имена инструментов, seed и параметры пачки. Суммы здесь не копируются — их создают заново в воркере.

import { GeneratorSettings } from '../../settings/generator-settings';

export interface ProducerSession {
  runId: number;
  seed: number;
  instruments: readonly string[];
  updatesPerBatch: number;
  batchIntervalMs: number;
}

const INSTRUMENT_NAMES: readonly string[] = [
  'ALFA',
  'BETA',
  'GAMA',
  'DLTA',
  'EPSI',
  'ZETA',
  'ETAX',
  'THET',
  'IOTA',
  'KAPA',
  'LAMD',
  'MUON',
  'NUCL',
  'XIIX',
  'OMIC',
  'RHOX',
  'SIGM',
  'TAUX',
  'UPSI',
  'PHIX',
  'CHIX',
  'PSIY',
  'OMEG',
  'ARKT',
  'BORA',
  'CERN',
  'DRFT',
  'ECHO',
  'FLUX',
  'GLYF',
  'HELM',
  'IONX',
  'JOLT',
  'KITE',
  'LYRA',
  'MESA',
  'NOVA',
  'ORBX',
  'PULS',
  'QUAR',
  'RIFT',
  'SOLX',
  'TERN',
  'UMBR',
  'VORT',
  'WATT',
  'XENX',
  'YARD',
  'ZEPH',
  'AURX',
];

export function instrumentNames(count: number): string[] {
  return INSTRUMENT_NAMES.slice(0, count);
}

function createSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const seed = buffer[0];
  return seed === 0 ? 1 : seed;
}

export class SessionFactory {
  private nextRunId = 0;

  constructor(private readonly nextSeed: () => number = createSeed) {}

  create(settings: GeneratorSettings): ProducerSession {
    this.nextRunId += 1;
    return {
      runId: this.nextRunId,
      seed: this.nextSeed(),
      instruments: instrumentNames(settings.instrumentCount),
      updatesPerBatch: settings.updatesPerBatch,
      batchIntervalMs: settings.batchIntervalMs,
    };
  }
}
