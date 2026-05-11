import { LandingPage } from '../pages/landing/LandingPage.js';
import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { AdminPage } from '../pages/admin/AdminPage.js';
import { Router } from '../shared/router/Router.js';
import { HttpClient } from '../shared/http_client/HttpClient.js';
import { Heartbeat } from '../shared/heartbeat/Heartbeat.js';
import { nn } from '../shared/utils/notNull.js';

const GUEST_ONLY_PATHS = new Set<string>(['/', '/sign', '/login', '/register']);

const rootElement = nn(document.getElementById('root'));
const httpClient = new HttpClient();

const router = new Router(rootElement);
router.addRoute('/', LandingPage);
router.addRoute('/sign', RegisterPage);
router.addRoute('/login', RegisterPage);
router.addRoute('/register', RegisterPage);
router.addRoute('/files', FilesPage);
router.addRoute('/notebooks/:id', BlocksPage);
router.addRoute('/profile', ProfilePage);
router.addRoute('/admin', AdminPage);

/**
 * Определяет defaultPath роутера на основе текущей сессии: для авторизованного
 * пользователя — '/files', для гостя — '/' (landing). Используется для редиректа
 * при заходе на корень сайта или ненайденный путь.
 * @returns промис с дефолтным путём
 */
async function getDefaultPath(): Promise<string> {
    try {
        const response = await httpClient.get('/auth/me');
        if (response.ok) return '/files';
        return '/';
    } catch (_e) {
        return '/';
    }
}

/**
 * Точка входа SPA: проверяет авторизацию, для авторизованных запускает
 * heartbeat-сервис и редиректит с гостевых страниц (/, /sign, /login,
 * /register) на /files, затем стартует роутер.
 */
async function bootstrap(): Promise<void> {
    const defaultPath = await getDefaultPath();

    if (defaultPath === '/files') {
        Heartbeat.getInstance().start();

        if (GUEST_ONLY_PATHS.has(window.location.pathname)) {
            history.replaceState(null, '', '/files');
        }
    }

    router.setDefault(defaultPath);
    router.start();
}

void bootstrap();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js');
    });
}
