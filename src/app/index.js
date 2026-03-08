import { Register } from '../widgets/register-form/Register.js';
import { GreenHeader } from '../widgets/green-header/GreenHeader.js';

const rootElement = document.getElementById('root');
const pageElement = document.createElement('main');

rootElement.appendChild(pageElement);

const header = new GreenHeader(rootElement);
header.render();

const register = new Register(pageElement);
register.render();
