// Зачем: оболочка должна вести на обе страницы и не подменять их заглушкой генератора Angular.
// Что делает: создаёт корневой компонент с маршрутизатором и проверяет ссылки Dashboard и Settings.

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('links to the dashboard and the settings page', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((link) =>
      (link as HTMLAnchorElement).getAttribute('href'),
    );

    expect(links).toContain('/dashboard');
    expect(links).toContain('/settings');
  });
});
