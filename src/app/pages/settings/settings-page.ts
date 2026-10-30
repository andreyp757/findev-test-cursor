// Зачем: черновик формы не должен менять запуск, пока человек явно не нажмёт Apply.
// Что делает: держит три строки полей, по Apply вызывает фасад и показывает все ошибки цепочки сразу.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ProducerFacade } from '../../producer/facade/producer-facade';
import { parseDraftNumber } from '../../settings/parse-draft';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly producer = inject(ProducerFacade);

  protected readonly appliedSettings$ = this.producer.appliedSettings$;
  protected instrumentCount: string;
  protected updatesPerBatch: string;
  protected batchIntervalMs: string;
  protected errors: readonly string[] = [];

  constructor() {
    const applied = this.producer.currentSettings();
    this.instrumentCount = String(applied.instrumentCount);
    this.updatesPerBatch = String(applied.updatesPerBatch);
    this.batchIntervalMs = String(applied.batchIntervalMs);
  }

  protected onInstrumentCount(event: Event): void {
    this.instrumentCount = this.valueOf(event);
  }

  protected onUpdatesPerBatch(event: Event): void {
    this.updatesPerBatch = this.valueOf(event);
  }

  protected onBatchInterval(event: Event): void {
    this.batchIntervalMs = this.valueOf(event);
  }

  protected onApply(event: Event): void {
    event.preventDefault();
    this.errors = this.producer.apply({
      instrumentCount: parseDraftNumber(this.instrumentCount),
      updatesPerBatch: parseDraftNumber(this.updatesPerBatch),
      batchIntervalMs: parseDraftNumber(this.batchIntervalMs),
    });
    if (this.errors.length === 0) {
      const applied = this.producer.currentSettings();
      this.instrumentCount = String(applied.instrumentCount);
      this.updatesPerBatch = String(applied.updatesPerBatch);
      this.batchIntervalMs = String(applied.batchIntervalMs);
    }
  }

  private valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
