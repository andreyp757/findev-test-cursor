// Зачем: ошибка инициализации должна быть видна на странице, а кнопка должна идти в тот же pause(), что и тест фасада.
// Что делает: рисует дашборд на подставном фасаде и проверяет текст ошибки и вызов Pause/Resume.

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { blankSnapshot } from '../../metrics/instrument-book';
import { ProducerFacade, ProducerStatus } from '../../producer/facade/producer-facade';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('shows the initialization error instead of an empty screen', async () => {
    const status$ = new BehaviorSubject<ProducerStatus>({
      phase: 'failed',
      error: 'Не удалось инициализировать генератор Wasm: нет модуля',
    });
    const facade = {
      snapshot$: new BehaviorSubject(blankSnapshot(['ALFA'])),
      status$,
      pause: vi.fn(),
      resume: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: ProducerFacade, useValue: facade }],
    });
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Не удалось инициализировать генератор Wasm: нет модуля');
    expect(fixture.nativeElement.textContent).toContain('Ошибка инициализации');
    expect(fixture.nativeElement.textContent).toContain('ALFA');
    expect(fixture.nativeElement.textContent).toContain('н/д');
  });

  it('calls pause while running and resume while paused', async () => {
    const status$ = new BehaviorSubject<ProducerStatus>({ phase: 'running', error: null });
    const facade = {
      snapshot$: new BehaviorSubject(blankSnapshot(['ALFA'])),
      status$,
      pause: vi.fn(),
      resume: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: ProducerFacade, useValue: facade }],
    });
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Pause');
    button.click();
    expect(facade.pause).toHaveBeenCalledOnce();

    status$.next({ phase: 'paused', error: null });
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Resume');
    button.click();
    expect(facade.resume).toHaveBeenCalledOnce();
  });
});
