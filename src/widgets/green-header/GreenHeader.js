export class GreenHeader {
    #parent;
    #config;
    #header;
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
        const template = Handlebars.templates['GreenHeader'];
        this.#parent.insertAdjacentHTML('afterbegin', template(this.#config));
        this.#header = this.#parent.querySelector('.green-header');
    }

    get loginBtn() {
        return this.#header.querySelector('[data-action="login"]');
    }

    get registerBtn() {
        return this.#header.querySelector('[data-action="register"]');
    }
}
