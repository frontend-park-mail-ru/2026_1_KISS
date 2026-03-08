import { Register } from '../widgets/register-form/Register.js';

const rootElement = document.getElementById('root');
const pageElement = document.createElement('main');

rootElement.appendChild(pageElement);

const register = new Register(pageElement);
register.render();
