/*
import DOMPurify from 'dompurify';
const dirty = '<script>alert("XSS")</script><img src="cat.jpg" onerror="alert(1)">Привет';
const clean = DOMPurify.sanitize(dirty);
console.log(clean);
*/
import { Input, TYPE_INPUT_CONFIG } from './components/Input/Input.js';

const rootElement = document.getElementById('root');
const pageElement = document.createElement('main');

rootElement.appendChild(pageElement);

const inputField = new Input(pageElement, TYPE_INPUT_CONFIG.EMAIL);
inputField.render();

// function createLoginForm() {
//     const form = document.createElement('form');
//     form.className = 'login-form';
//     form.innerHTML = `
//         <h2 class="form-title">Вход в систему</h2>
//         <div id="login-input"></div>
//         <div id="email-input"></div>
//         <div id="password-input"></div>
//         <button type="submit" class="submit-btn">Войти</button>
//     `;
//
//     document.getElementById('root').appendChild(form);
//
//     // Создаём поля ввода с предустановками
//     const loginInput = new Input('#login-input', {
//         ...Input.presets.login,
//         label: 'Логин',
//         hint: 'Только буквы, цифры и _',
//         onInput: (value, isValid) => {
//             console.log('Логин:', value, 'Валидный:', isValid);
//         }
//     });
//
//     const emailInput = new Input('#email-input', {
//         ...Input.presets.email,
//         label: 'Email',
//         onBlur: (value, isValid) => {
//             if (!isValid && value) {
//                 console.log('Неверный формат email');
//             }
//         }
//     });
//
//     const passwordInput = new Input('#password-input', {
//         ...Input.presets.password,
//         label: 'Пароль',
//         minlength: 8,
//         hint: 'Минимум 8 символов'
//     });
//
//     // Валидация при отправке
//     form.addEventListener('submit', (e) => {
//         e.preventDefault();
//
//         const isLoginValid = loginInput.validate();
//         const isEmailValid = emailInput.validate();
//         const isPasswordValid = passwordInput.validate();
//
//         if (isLoginValid && isEmailValid && isPasswordValid) {
//             console.log('Форма отправлена:', {
//                 login: loginInput.getValue(),
//                 email: emailInput.getValue(),
//                 password: passwordInput.getValue()
//             });
//
//             // Здесь отправка на сервер
//         }
//     });
//
//     return { loginInput, emailInput, passwordInput };
// }
//
//
// createLoginForm(pageElement);
