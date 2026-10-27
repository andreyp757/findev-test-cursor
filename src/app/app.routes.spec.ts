// Зачем: старт приложения зафиксирован на /dashboard, и это не должно зависеть от шаблона.
// Что делает: сверяет таблицу маршрутов с двумя страницами и редиректом.

import { DashboardPage } from './pages/dashboard/dashboard-page';
import { SettingsPage } from './pages/settings/settings-page';
import { routes } from './app.routes';

describe('routes', () => {
  it('opens the dashboard first and keeps settings on their own path', () => {
    expect(routes).toEqual([
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      { path: 'settings', component: SettingsPage },
      { path: '**', redirectTo: 'dashboard' },
    ]);
  });
});
