// Зачем: браузеру нужна одна точка входа, которая поднимает Angular и не содержит рыночной логики.
// Что делает: запускает корневой компонент с конфигурацией маршрутов и единственного продюсера.

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
