// Зачем: правка поля не должна вызывать Apply, а нажатие кнопки должно показать все возвращённые ошибки.
// Что делает: вводит черновик в форму и проверяет, что фасад вызывается только из submit.

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { DEFAULT_SETTINGS } from '../../settings/generator-settings';
import { ProducerFacade } from '../../producer/facade/producer-facade';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  it('keeps typed values local until Apply and then renders every error', async () => {
    const apply = vi.fn(() => [
      'Число инструментов: Допустимый диапазон 1–50.',
      'Событий в пачке: Ожидается целое число.',
    ]);
    const facade = {
      appliedSettings$: new BehaviorSubject(DEFAULT_SETTINGS),
      currentSettings: () => DEFAULT_SETTINGS,
      apply,
    };
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: ProducerFacade, useValue: facade }],
    });
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const count = fixture.nativeElement.querySelector('#instrument-count') as HTMLInputElement;
    count.value = '0';
    count.dispatchEvent(new Event('input'));
    expect(apply).not.toHaveBeenCalled();

    const batch = fixture.nativeElement.querySelector('#updates-per-batch') as HTMLInputElement;
    batch.value = '1.5';
    batch.dispatchEvent(new Event('input'));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith({
      instrumentCount: 0,
      updatesPerBatch: '1.5',
      batchIntervalMs: 500,
    });
    const items = [...fixture.nativeElement.querySelectorAll('.errors li')].map(
      (item) => (item as HTMLElement).textContent,
    );
    expect(items).toEqual([
      'Число инструментов: Допустимый диапазон 1–50.',
      'Событий в пачке: Ожидается целое число.',
    ]);
    expect(count.value).toBe('0');
    expect(batch.value).toBe('1.5');
  });

  it('puts the applied numbers back into the fields after Apply succeeds', async () => {
    const apply = vi.fn(() => []);
    const facade = {
      appliedSettings$: new BehaviorSubject({
        instrumentCount: 8,
        updatesPerBatch: 100,
        batchIntervalMs: 50,
      }),
      currentSettings: () => ({
        instrumentCount: 8,
        updatesPerBatch: 100,
        batchIntervalMs: 50,
      }),
      apply,
    };
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: ProducerFacade, useValue: facade }],
    });
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const count = fixture.nativeElement.querySelector('#instrument-count') as HTMLInputElement;
    const batch = fixture.nativeElement.querySelector('#updates-per-batch') as HTMLInputElement;
    count.value = '8';
    count.dispatchEvent(new Event('input'));
    batch.value = '0100';
    batch.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(count.value).toBe('8');
    expect(batch.value).toBe('100');
    expect((fixture.nativeElement.querySelector('#batch-interval') as HTMLInputElement).value).toBe(
      '50',
    );
  });
});
