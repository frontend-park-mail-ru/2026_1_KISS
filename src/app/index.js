/**
 * @module app/index
 *
 * Точка входа приложения KISS Colab.
 * Создаёт роутер, регистрирует маршруты и запускает навигацию.
 */

import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { Router } from '../shared/router/Router.js';
import { HttpClient } from '../shared/http_client/HttpClient.js';

const rootElement = document.getElementById('root');
const httpClient = new HttpClient();

const router = new Router(rootElement);
router.addRoute('/sign', RegisterPage);
router.addRoute('/files', FilesPage);
router.addRoute('/notebooks/:id', BlocksPage);
router.addRoute('/profile', ProfilePage);

async function getDefaultPath() {
    try {
        const response = await httpClient.get('/auth/me');
        return response.ok ? '/files' : '/sign';
    } catch (_e) {
        return '/sign';
    }
}

async function bootstrap() {
    const defaultPath = await getDefaultPath();

    if (defaultPath === '/files' && window.location.pathname === '/sign') {
        // Keep history clean on startup redirect from auth page.
        history.replaceState(null, '', '/files');
    }

    router.setDefault(defaultPath);
    router.start();
}

bootstrap();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
    });
}
