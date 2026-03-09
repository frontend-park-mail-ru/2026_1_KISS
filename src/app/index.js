import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { Router } from '../shared/router/Router.js';

const rootElement = document.getElementById('root');

const router = new Router(rootElement);
router.addRoute('/sign', RegisterPage);
router.addRoute('/files', FilesPage);
router.setDefault('/sign');
router.start();
