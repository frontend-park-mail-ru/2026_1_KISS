import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { nn } from '../../shared/utils/notNull.js';
import { OAuthButton } from '../oauth-button/OAuthButton.js';
import type { OAuthProviderName } from '../oauth-button/OAuthButton.icons.js';
import { OAuthModalTemplate } from './OAuthModal.template.js';

const PROVIDERS: OAuthProviderName[] = ['google', 'yandex', 'vkid'];

/**
 * Модалка выбора OAuth-провайдера. Монтируется в document.body, чтобы стопроцентно
 * перекрывать остальной интерфейс (z-index + position:fixed). Внутри держит три
 * OAuthButton — клик по любой запускает редирект на бэкенд-эндпоинт через её
 * собственный handler. Сама модалка закрывается по клику-вне, кнопке-крестику
 * и клавише Escape; обе подписки чистятся в unmount().
 */
export class OAuthModal extends BaseComponent {
    #buttons: OAuthButton[] = [];
    #onEscape: ((e: KeyboardEvent) => void) | null = null;
    #onClose: (() => void) | null;

    /**
     * Создаёт элемент модалки и монтирует её в document.body. Список провайдеров
     * добавляется в OAuthButton'ах сразу же, чтобы первый показ был без задержки.
     * @param onClose - колбэк, вызываемый при закрытии модалки (чтобы владелец
     * мог обнулить ссылку и позволить открыть модалку повторно)
     */
    public constructor(onClose?: () => void) {
        super(null, document.body);
        this.#onClose = onClose ?? null;
        const temp = document.createElement('div');
        temp.innerHTML = OAuthModalTemplate();
        this._element = temp.firstElementChild as HTMLElement;
    }

    /**
     * Вставляет overlay в DOM, инстанцирует кнопки провайдеров и навешивает
     * обработчики закрытия (крестик, клик по overlay вне карточки, Escape).
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();

        const container = nn(this._element.querySelector<HTMLElement>('#oauth-modal-providers'));
        this.#buttons = PROVIDERS.map((p) => new OAuthButton(container, p));
        this.#buttons.forEach((b) => {
            b.mount();
        });

        this._addListener(nn(this._element.querySelector('.oauth-modal__close')), 'click', () => {
            this.unmount();
        });

        this._addListener(this._element, 'click', (e: Event) => {
            if (e.target === this._element) {
                this.unmount();
            }
        });

        const onEsc = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') this.unmount();
        };
        this.#onEscape = onEsc;
        document.addEventListener('keydown', onEsc);
    }

    /**
     * Снимает кнопки, отписывается от Escape и удаляет overlay из document.body.
     */
    public unmount(): void {
        if (!this._isMounted) return;
        this.#buttons.forEach((b) => {
            b.unmount();
        });
        this.#buttons = [];
        if (this.#onEscape !== null) {
            document.removeEventListener('keydown', this.#onEscape);
            this.#onEscape = null;
        }
        super.unmount();
        if (this.#onClose !== null) {
            this.#onClose();
        }
    }
}
