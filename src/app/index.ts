import { LandingPage } from '../pages/landing/LandingPage.js';
import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { ProfilePage } from '../pages/profile/ProfilePage.js';
import { AdminPage } from '../pages/admin/AdminPage.js';
import { Router } from '../shared/router/Router.js';
import { HttpClient } from '../shared/http_client/HttpClient.js';
import { Heartbeat } from '../shared/heartbeat/Heartbeat.js';

const rootElement = document.getElementById('root')!;
const httpClient = new HttpClient();

const router = new Router(rootElement);
router.addRoute('/', LandingPage);
router.addRoute('/sign', RegisterPage);
router.addRoute('/files', FilesPage);
router.addRoute('/notebooks/:id', BlocksPage);
router.addRoute('/profile', ProfilePage);
router.addRoute('/admin', AdminPage);

async function getDefaultPath(): Promise<string> {
    try {
        const response = await httpClient.get('/auth/me');
        return response.ok ? '/files' : '/';
    } catch (_e) {
        return '/';
    }
}

async function bootstrap(): Promise<void> {
    const defaultPath = await getDefaultPath();

    if (defaultPath === '/files') {
        Heartbeat.getInstance().start();

        if (window.location.pathname === '/sign' || window.location.pathname === '/') {
            history.replaceState(null, '', '/files');
        }
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
