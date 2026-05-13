import { LandingPage } from '../pages/landing/LandingPage.js';
import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { DiskPage } from '../pages/disk/DiskPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { AdminPage } from '../pages/admin/AdminPage.js';
import { Router } from '../shared/router/Router.js';
import { HttpClient } from '../shared/http_client/HttpClient.js';
import { Heartbeat } from '../shared/heartbeat/Heartbeat.js';
import { nn } from '../shared/utils/notNull.js';

const rootElement = nn(document.getElementById('root'));
const httpClient = new HttpClient();

const router = new Router(rootElement);
router.addRoute('/', LandingPage, { guard: 'guestOnly' });
router.addRoute('/sign', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/login', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/register', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/files', FilesPage, { guard: 'authOnly' });
router.addRoute('/disk', DiskPage, { guard: 'authOnly' });
router.addRoute('/notebooks/:id', BlocksPage, { guard: 'authOnly' });
router.addRoute('/profile', ProfilePage, { guard: 'authOnly' });
router.addRoute('/admin', AdminPage, { guard: 'authOnly' });

/**
 * Опрашивает /auth/me и обновляет snapshot авторизации внутри HttpClient.
 * После возврата getAuthSnapshot() гарантированно вернёт 'authed' или 'guest'
 * (никогда 'unknown'), что позволяет роутеру синхронно проверять guard'ы.
 */
async function probeAuth(): Promise<void> {
    try {
        await httpClient.get('/auth/me', { noCache: true });
    } catch (_e) {
        httpClient.setAuthSnapshot('guest');
    }
}

/**
 * Точка входа SPA: уточняет статус сессии (HttpClient обновляет snapshot
 * автоматически по ответу /auth/me), запускает heartbeat для авторизованных
 * и стартует роутер. Редиректы между гостевой и приватной зоной выполняются
 * декларативно через route guard'ы — отдельной логики в bootstrap'е больше нет.
 */
async function bootstrap(): Promise<void> {
    await probeAuth();
    const isAuthed = httpClient.getAuthSnapshot() === 'authed';

    if (isAuthed) {
        Heartbeat.getInstance().start();
    }

    router.setDefault(isAuthed ? '/files' : '/');
    router.start();
}

void bootstrap();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js');
    });
}
