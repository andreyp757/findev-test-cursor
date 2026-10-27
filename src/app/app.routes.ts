// Зачем: у приложения два адреса, и пустой путь должен открывать дашборд, а не пустой экран.
// Что делает: объявляет маршруты /dashboard и /settings и перенаправляет старт и неизвестный адрес на дашборд.

import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard-page';
import { SettingsPage } from './pages/settings/settings-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPage },
  { path: 'settings', component: SettingsPage },
  { path: '**', redirectTo: 'dashboard' },
];
