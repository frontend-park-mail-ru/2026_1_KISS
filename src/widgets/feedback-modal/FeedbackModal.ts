/**
 * Модалка обратной связи на iframe-обёртке (содержимое — отдельная страница
 * /feedback с собственным bootstrap'ом). Общается с iframe'ом через postMessage:
 *
 * - От iframe приходит 'feedback:ready' когда страница готова, и 'feedback:close'
 *   когда пользователь нажал крестик внутри iframe.
 * - Мы шлём 'feedback:open' в iframe чтобы он запустил свой open-флоу
 *   (если ready ещё не пришло — откладываем через #pendingOpen).
 *
 * Сделано через iframe чтобы изолировать форму с прикреплением файлов от
 * остального состояния SPA (особенно при заходе с notebook'а где idle-сессия).
 */
export class FeedbackModal {
    #iframe: HTMLIFrameElement;
    #ready = false;
    #pendingOpen = false;
    #onMessage: (e: MessageEvent<{ type?: string } | undefined>) => void;

    /**
     * Создаёт iframe, маунтит в body, регистрирует postMessage-обработчик.
     */
    public constructor() {
        this.#iframe = document.createElement('iframe');
        this.#iframe.src = '/feedback';
        this.#iframe.className = 'feedback-modal-iframe';
        this.#iframe.setAttribute('allowtransparency', 'true');
        document.body.appendChild(this.#iframe);

        this.#onMessage = (e: MessageEvent<{ type?: string } | undefined>): void => {
            if (e.data?.type === 'feedback:close') {
                this.close();
            } else if (e.data?.type === 'feedback:ready') {
                this.#ready = true;
                if (this.#pendingOpen) {
                    this.#pendingOpen = false;
                    this.#send({ type: 'feedback:open' });
                }
            }
        };
        window.addEventListener('message', this.#onMessage);
    }

    /**
     * Открывает модалку: показывает iframe, блокирует скролл body. Если iframe
     * ещё не сообщил ready — откладывает команду до получения ready.
     */
    public open(): void {
        this.#iframe.classList.add('feedback-modal-iframe--visible');
        document.body.style.overflow = 'hidden';
        if (this.#ready) {
            this.#send({ type: 'feedback:open' });
        } else {
            this.#pendingOpen = true;
        }
    }

    /**
     * Закрывает модалку: скрывает iframe, разблокирует скролл body. Безопасно
     * вызывать когда модалка уже закрыта.
     */
    public close(): void {
        this.#iframe.classList.remove('feedback-modal-iframe--visible');
        document.body.style.overflow = '';
    }

    /**
     * Снимает обработчик postMessage и удаляет iframe. Должен вызываться при
     * уничтожении компонента (например при logout) — иначе утечка iframe + listener.
     */
    public destroy(): void {
        window.removeEventListener('message', this.#onMessage);
        this.#iframe.remove();
    }

    /**
     * Шлёт сообщение в iframe через postMessage с проверкой origin.
     * @param msg - объект с type-полем
     */
    #send(msg: { type: string }): void {
        this.#iframe.contentWindow?.postMessage(msg, window.location.origin);
    }
}
