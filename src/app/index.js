import { RegisterPage } from '../pages/sign/RegisterPage.js';
import { FilesPage } from '../pages/files/FilesPage.js';
import { BlocksPage } from '../pages/blocks/BlocksPage.js';
import { Router } from '../shared/router/Router.js';

const rootElement = document.getElementById('root');

const router = new Router(rootElement);
router.addRoute('/sign', RegisterPage);
router.addRoute('/files', FilesPage);
router.addRoute('/notebooks/:id', BlocksPage);
router.setDefault('/sign');
router.start();
