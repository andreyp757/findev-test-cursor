// Зачем: продюсер должен подняться вместе с приложением, а не в момент подписки страницы — иначе маршрут создаст второй Worker.
// Что делает: включает обновление экрана без Zone.js, один WorkerClient, маршруты и инициализатор, который один раз создаёт фасад.

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ProducerFacade } from './producer/facade/producer-facade';
import { WorkerClient } from './producer/worker-client/worker-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: WorkerClient, useFactory: () => new WorkerClient() },
    provideAppInitializer(() => {
      inject(ProducerFacade);
    }),
  ],
};
