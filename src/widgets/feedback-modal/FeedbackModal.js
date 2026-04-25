export class FeedbackModal {
    #iframe;
    #ready = false;
    #pendingOpen = false;
    #onMessage;

    constructor() {
        this.#iframe = document.createElement('iframe');
        this.#iframe.src = '/feedback';
        this.#iframe.className = 'feedback-modal-iframe';
        this.#iframe.setAttribute('allowtransparency', 'true');
        document.body.appendChild(this.#iframe);

        this.#onMessage = (e) => {
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

    open() {
        this.#iframe.classList.add('feedback-modal-iframe--visible');
        document.body.style.overflow = 'hidden';
        if (this.#ready) {
            this.#send({ type: 'feedback:open' });
        } else {
            this.#pendingOpen = true;
        }
    }

    close() {
        this.#iframe.classList.remove('feedback-modal-iframe--visible');
        document.body.style.overflow = '';
    }

    destroy() {
        window.removeEventListener('message', this.#onMessage);
        this.#iframe.remove();
    }

    #send(msg) {
        this.#iframe.contentWindow?.postMessage(msg, window.location.origin);
    }
}
