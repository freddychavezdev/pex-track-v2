import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import PexTrackTheme from './theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: PexTrackTheme, options: { darkModeSelector: '.app-dark' } } }),
    provideRouter(routes),
    provideAppInitializer(() => inject(AuthService).initialize())
  ]
};
