// Зачем: после Apply сообщение старого запуска ещё может прийти из воркера и не имеет права затереть новый снимок.
// Что делает: пропускает сообщение только когда его runId совпадает с текущей сессией. Чужой идентификатор отбрасывает целиком.

export class RunGuard {
  constructor(private readonly currentRunId: () => number | null) {}

  accept<T extends { runId: number }>(message: T): T | null {
    // Чужой runId отбрасывается целиком.
    if (message.runId !== this.currentRunId()) {
      return null;
    }
    return message;
  }
}
