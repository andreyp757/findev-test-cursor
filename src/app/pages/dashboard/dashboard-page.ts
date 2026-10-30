// Зачем: дашборд показывает таблицу и паузу, но не должен знать, откуда берётся снимок.
// Что делает: подписывается на снимок и статус фасада, рисует пять метрик и вызывает Pause или Resume.

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { formatMetric } from '../../format/format-metric';
import { MetricReading } from '../../metrics/metric-reading';
import { ProducerFacade, ProducerStatus } from '../../producer/facade/producer-facade';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly producer = inject(ProducerFacade);

  protected readonly snapshot$ = this.producer.snapshot$;
  protected readonly status$ = this.producer.status$;

  protected format(reading: MetricReading): string {
    return formatMetric(reading);
  }

  protected statusText(status: ProducerStatus): string {
    switch (status.phase) {
      case 'idle':
        return 'Ожидание запуска';
      case 'starting':
        return 'Запуск генератора…';
      case 'running':
        return 'Генерация идёт';
      case 'paused':
        return 'Пауза';
      case 'failed':
        return status.failure === 'runtime' ? 'Ошибка генерации' : 'Ошибка инициализации';
    }
  }

  protected toggle(status: ProducerStatus): void {
    if (status.phase === 'paused') {
      this.producer.resume();
      return;
    }
    this.producer.pause();
  }
}
