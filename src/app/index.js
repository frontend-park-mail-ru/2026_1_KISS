import { RegisterPage } from '../pages/sign/RegisterPage.js';

const rootElement = document.getElementById('root');
const pageElement = document.createElement('main');

rootElement.appendChild(pageElement);

const registerPage = new RegisterPage(rootElement);
registerPage.render();

window.app = { registerPage };
