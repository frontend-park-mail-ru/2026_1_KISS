import { LandingPage } from '../pages/landing/LandingPage.js';
import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { ForgotPasswordPage } from '../pages/forgot-password/ForgotPasswordPage.js';
import { ResetPasswordPage } from '../pages/reset-password/ResetPasswordPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { DiskPage } from '../pages/disk/DiskPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { AdminPage } from '../pages/admin/AdminPage.js';
import { SharedFilePage } from '../pages/shared-file/SharedFilePage.js';
import { UsernameSetupPage } from '../pages/username-setup/UsernameSetupPage.js';
import { Router } from '../shared/router/Router.js';
import { HttpClient } from '../shared/http_client/HttpClient.js';
import { Heartbeat } from '../shared/heartbeat/Heartbeat.js';
import { nn } from '../shared/utils/notNull.js';
import type { ApiEnvelope, UserDTO } from '../shared/api/types.js';

const rootElement = nn(document.getElementById('root'));
const httpClient = new HttpClient();

const router = new Router(rootElement);
router.addRoute('/', LandingPage, { guard: 'guestOnly' });
router.addRoute('/sign', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/login', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/register', RegisterPage, { guard: 'guestOnly' });
router.addRoute('/forgot-password', ForgotPasswordPage, { guard: 'guestOnly' });
router.addRoute('/reset-password', ResetPasswordPage, { guard: 'guestOnly' });
router.addRoute('/files', FilesPage, { guard: 'authOnly' });
router.addRoute('/disk', DiskPage, { guard: 'authOnly' });
router.addRoute('/notebooks/:id', BlocksPage, { guard: 'authOnly' });
router.addRoute('/profile', ProfilePage, { guard: 'authOnly' });
router.addRoute('/admin', AdminPage, { guard: 'authOnly' });
router.addRoute('/username-setup', UsernameSetupPage, { guard: 'authOnly' });
router.addRoute('/shared/files/:token', SharedFilePage);

/**
 * Опрашивает /auth/me и обновляет snapshot авторизации внутри HttpClient.
 * После возврата getAuthSnapshot() гарантированно вернёт 'authed' или 'guest'
 * (никогда 'unknown'), что позволяет роутеру синхронно проверять guard'ы.
 * @returns DTO пользователя при успешной сессии, иначе null
 */
async function probeAuth(): Promise<UserDTO | null> {
    try {
        const response = await httpClient.get('/auth/me', { noCache: true });
        if (!response.ok) return null;
        const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;
        return result.data ?? null;
    } catch (_e) {
        httpClient.setAuthSnapshot('guest');
        return null;
    }
}

/**
 * Точка входа SPA: уточняет статус сессии (HttpClient обновляет snapshot
 * автоматически по ответу /auth/me), запускает heartbeat для авторизованных
 * и стартует роутер. Редиректы между гостевой и приватной зоной выполняются
 * декларативно через route guard'ы. Обязательный выбор имени (username_pending)
 * тоже отдан guard'у роутера — здесь только проставляется признак в HttpClient
 * до старта роутера, чтобы первая же навигация увела на /username-setup.
 */
async function bootstrap(): Promise<void> {
    const user = await probeAuth();
    const isAuthed = httpClient.getAuthSnapshot() === 'authed';

    httpClient.setUsernamePending(isAuthed && user?.username_pending === true);

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
