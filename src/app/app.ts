// Зачем: оболочка только переключает страницы. Она не создаёт сессию и не знает про воркер.
// Что делает: показывает навигацию Dashboard / Settings и выводит активный маршрут.

import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
