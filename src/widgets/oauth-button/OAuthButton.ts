import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { OAuthButtonTemplate } from './OAuthButton.template.js';
import type { OAuthProviderName } from './OAuthButton.icons.js';

/**
 * Кнопка OAuth-входа. На клик выполняет browser-redirect на бэкенд-эндпоинт
 * `/api/v1/auth/oauth/<provider>/start`; дальше state/PKCE/redirect к провайдеру
 * полностью контролирует backend, фронт ничего не отправляет через HttpClient
 * (нужен top-level navigation, чтобы провайдер получил cookies).
 */
export class OAuthButton extends BaseComponent {
    #provider: OAuthProviderName;

    /**
     * Создаёт кнопку и рендерит шаблон в detached-контейнер. Маунт обязан
     * сделать вызывающий код через mount().
     * @param parent - родительский элемент, в который кнопка будет смонтирована
     * @param provider - имя провайдера: 'google' | 'yandex' | 'vkid'
     */
    public constructor(parent: HTMLElement, provider: OAuthProviderName) {
        super(null, parent);
        this.#provider = provider;
        this.#render();
    }

    /**
     * Создаёт корневой `<button>` из шаблона и сохраняет в `_element`.
     */
    #render(): void {
        const temp = document.createElement('div');
        temp.innerHTML = OAuthButtonTemplate(this.#provider);
        this._element = temp.firstElementChild as HTMLElement;
    }

    /**
     * Вставляет кнопку в DOM и навешивает обработчик клика.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this._addListener(this._element, 'click', (event: Event) => {
            event.preventDefault();
            this.#startOAuthFlow();
        });
    }

    /**
     * Делает top-level browser-redirect на бэкенд-эндпоинт запуска OAuth-флоу.
     * Не использует fetch — нужно, чтобы куки oauth_state и редирект на провайдера
     * корректно обрабатывались браузером.
     */
    #startOAuthFlow(): void {
        window.location.href = `/api/v1/auth/oauth/${this.#provider}/start`;
    }
}
