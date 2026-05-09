export class FeedbackModal {
    #iframe: HTMLIFrameElement;
    #ready = false;
    #pendingOpen = false;
    #onMessage: (e: MessageEvent<{ type?: string } | undefined>) => void;

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

    public open(): void {
        this.#iframe.classList.add('feedback-modal-iframe--visible');
        document.body.style.overflow = 'hidden';
        if (this.#ready) {
            this.#send({ type: 'feedback:open' });
        } else {
            this.#pendingOpen = true;
        }
    }

    public close(): void {
        this.#iframe.classList.remove('feedback-modal-iframe--visible');
        document.body.style.overflow = '';
    }

    public destroy(): void {
        window.removeEventListener('message', this.#onMessage);
        this.#iframe.remove();
    }

    #send(msg: { type: string }): void {
        this.#iframe.contentWindow?.postMessage(msg, window.location.origin);
    }
}
