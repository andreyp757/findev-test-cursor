// Зачем: три числа генератора — это модель настроек, а не поля конкретной формы.
// Что делает: задаёт применённые настройки и черновик, который ещё может содержать нечисло.

export interface GeneratorSettings {
  instrumentCount: number;
  updatesPerBatch: number;
  batchIntervalMs: number;
}

export interface SettingsDraft {
  instrumentCount: unknown;
  updatesPerBatch: unknown;
  batchIntervalMs: unknown;
}

export const DEFAULT_SETTINGS: GeneratorSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};
