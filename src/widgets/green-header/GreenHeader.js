export class GreenHeader {
    #parent;
    #config;
    constructor(parent) {
        this.#parent = parent;

        this.#config = {
            logo: '/images/NewLogoTransparentWhite.svg',
            buttons: [
                { text: 'Войти', class: 'just-text', action: 'login' },
                { text: 'Регистрация', class: 'just-text', action: 'register' }
            ]
        };
    }

    render() {
        console.log(Handlebars.templates);
        const template = Handlebars.templates['GreenHeader.hbs'];
        this.#parent.insertAdjacentHTML('afterbegin', template(this.#config));
        this.#attachEvents();
    }

    #attachEvents() {
        const header = this.#parent.querySelector('.green-header');

        const loginBtn = header.querySelector('[data-action="login"]');
        const registerBtn = header.querySelector('[data-action="register"]');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('Переход на страницу входа');
                window.location.href = '/login';
            });
        }

        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                console.log('Переход на страницу регистрации');
                window.location.href = '/register';
            });
        }
    }
}
