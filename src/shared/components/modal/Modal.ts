import { BaseComponent } from '../base-component/BaseComponent.js';

interface ModalFieldOption {
    value: string;
    label: string;
}

interface ModalField {
    name: string;
    label: string;
    type?: string;
    value?: string;
    options?: ModalFieldOption[];
}

export class Modal extends BaseComponent {
    #resolve: ((value: Record<string, string> | null) => void) | null = null;

    public constructor() {
        const el = document.createElement('div');
        el.className = 'modal-overlay';
        super(el, document.body);
        this.mount();

        this._addListener(this._element, 'click', (e: unknown) => {
            if ((e as MouseEvent).target === this._element) this.close(null);
        });
        this._addListener(document, 'keydown', (e: unknown) => {
            if ((e as KeyboardEvent).key === 'Escape') this.close(null);
        });
    }

    public open(title: string, fields: ModalField[]): Promise<Record<string, string> | null> {
        return new Promise((resolve) => {
            this.#resolve = resolve;
            this._element.innerHTML = '';

            const card = document.createElement('div');
            card.className = 'modal-card';

            const header = document.createElement('h3');
            header.className = 'modal-card__title';
            header.textContent = title;
            card.appendChild(header);

            const form = document.createElement('form');
            form.className = 'modal-card__form';

            fields.forEach(({ name, label, type, value, options }) => {
                const group = document.createElement('div');
                group.className = 'modal-card__field';

                const lbl = document.createElement('label');
                lbl.className = 'modal-card__label';
                lbl.textContent = label;
                group.appendChild(lbl);

                let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                if (type === 'select' && options) {
                    input = document.createElement('select');
                    input.className = 'modal-card__input';
                    options.forEach((opt) => {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label;
                        if (opt.value === value) option.selected = true;
                        input.appendChild(option);
                    });
                } else if (type === 'textarea') {
                    input = document.createElement('textarea');
                    input.className = 'modal-card__input modal-card__textarea';
                    input.rows = 5;
                    if (value !== undefined) input.value = value;
                } else {
                    input = document.createElement('input');
                    input.className = 'modal-card__input';
                    input.type = type || 'text';
                    if (value !== undefined) input.value = value;
                }
                input.name = name;
                group.appendChild(input);
                form.appendChild(group);
            });

            const actions = document.createElement('div');
            actions.className = 'modal-card__actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'modal-card__btn modal-card__btn--cancel';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', () => { this.close(null); });

            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.className = 'modal-card__btn modal-card__btn--submit';
            submitBtn.textContent = 'Сохранить';

            actions.appendChild(cancelBtn);
            actions.appendChild(submitBtn);
            form.appendChild(actions);

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const data: Record<string, string> = {};
                fields.forEach(({ name }) => {
                    const el = (form.elements).namedItem(
                        name
                    ) as HTMLInputElement | null;
                    if (el) data[name] = el.value;
                });
                this.close(data);
            });

            card.appendChild(form);
            this._element.appendChild(card);
            this._element.classList.add('modal-overlay--visible');

            const firstInput = form.querySelector('input, select');
            if (firstInput) firstInput.focus();
        });
    }

    public close(result: Record<string, string> | null): void {
        this._element.classList.remove('modal-overlay--visible');
        if (this.#resolve) {
            this.#resolve(result);
            this.#resolve = null;
        }
    }
}
