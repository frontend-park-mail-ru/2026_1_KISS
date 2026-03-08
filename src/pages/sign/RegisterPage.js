import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { Register } from '../../widgets/register-form/Register.js';

export class RegisterPage {
    #root;
    #header;
    #register;

    constructor(root) {
        this.#root = root;
        this.#header = null;
        this.#register = null;
    }

    render() {
        // Очищаем корневой элемент
        this.#root.innerHTML = '';

        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        const mainElement = this.#createMainContainer();
        this.#root.appendChild(mainElement);

        return this;
    }

    #createMainContainer() {
        const main = document.createElement('main');
        main.className = 'sign-page__main';

        const container = document.createElement('div');
        container.className = 'sign-page__container';

        main.appendChild(container);

        this.#register = new Register(container);
        this.#register.render();

        return main;
    }

    // Метод для обновления страницы (если понадобится)
    update() {
        // Логика обновления
    }

    // Метод для очистки
    destroy() {
        this.#root.innerHTML = '';
        this.#header = null;
        this.#register = null;
    }
}
