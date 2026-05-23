/* eslint-disable max-lines -- TODO(refactor): вынести #renderAssistantBody/#attachInsertButtons/#dumpNotebook в helpers рядом с виджетом */
import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { AiApi } from '../../shared/api/AiApi.js';
import { ChatWS } from '../../shared/api/ChatWS.js';
import type {
    AiModelDTO,
    ChatContextOptions,
    ChatMessageDTO,
    ChatWSIncoming
} from '../../shared/api/chatTypes.js';
import { escapeHtml } from '../../shared/utils/escapeHtml.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { AiChatPanelTemplate } from './AiChatPanel.template.js';

/**
 * Имя CustomEvent, который слушает CodeCell / BlocksPage чтобы вставить
 * сгенерированный ИИ блок кода в текущий ноутбук.
 */
export const AI_INSERT_CELL_EVENT = 'ai-chat:insert-cell';

/**
 * Имя CustomEvent, по которому панель чата открывается извне (например,
 * из CodeCell при нажатии «Объяснить» / «Исправить через ИИ») и сразу
 * подставляет preset-сообщение.
 */
export const AI_OPEN_WITH_PROMPT_EVENT = 'ai-chat:open-with-prompt';

/**
 * Полезная нагрузка события AI_INSERT_CELL_EVENT.
 */
export interface AiInsertCellDetail {
    /** Код, который нужно вставить в новую ячейку */
    code: string;
    /** Язык программирования */
    language: string;
}

/**
 * Полезная нагрузка события AI_OPEN_WITH_PROMPT_EVENT.
 */
export interface AiOpenWithPromptDetail {
    /** Текст preset-сообщения */
    prompt: string;
    /** Дополнительный контекст (необязательно) */
    context?: ChatContextOptions;
    /** Признак: автоматически отправлять сразу (true) или дать пользователю отредактировать (false) */
    autoSend?: boolean;
}

/**
 * Виджет AI-чата для боковой панели ноутбука. Управляет:
 * - WebSocket-соединением для потоковых ответов модели,
 * - REST-вызовами для истории, настроек, списка моделей,
 * - локальной лентой сообщений и индикатором «думает».
 *
 * Связь с другими виджетами — через CustomEvent на document:
 * - слушает AI_OPEN_WITH_PROMPT_EVENT, чтобы CodeCell мог попросить ИИ
 *   объяснить ячейку или исправить ошибку;
 * - диспатчит AI_INSERT_CELL_EVENT, когда пользователь нажимает «Вставить
 *   в ячейку» на блоке кода в ответе модели.
 */
export class AiChatPanel extends BaseComponent {
    #notebookId: number;
    #api: AiApi;
    #ws: ChatWS | null = null;
    #messagesEl: HTMLElement | null = null;
    #thinkingEl: HTMLElement | null = null;
    #errorEl: HTMLElement | null = null;
    #textareaEl: HTMLTextAreaElement | null = null;
    #sendBtnEl: HTMLButtonElement | null = null;
    #modelSelectEl: HTMLSelectElement | null = null;
    #includeCellEl: HTMLInputElement | null = null;
    #includeNotebookEl: HTMLInputElement | null = null;
    #clearBtnEl: HTMLButtonElement | null = null;
    #emptyEl: HTMLElement | null = null;
    #currentAssistantContainer: HTMLElement | null = null;
    #currentAssistantContent = '';
    #streaming = false;
    #presetHandler: ((e: Event) => void) | null = null;

    /**
     * Конструктор: рендерит HTML и сохраняет ссылки на DOM-узлы.
     * @param parent - родительский элемент, в который панель будет смонтирована
     * @param notebookId - ID ноутбука для привязки истории и контекста
     */
    public constructor(parent: HTMLElement, notebookId: number) {
        super(null, parent);
        this.#notebookId = notebookId;
        this.#api = new AiApi();
        this.#render();
    }

    /**
     * Создаёт корневой DOM-элемент панели из шаблона и кэширует ссылки
     * на интерактивные подэлементы.
     */
    #render(): void {
        const wrap = document.createElement('div');
        wrap.innerHTML = AiChatPanelTemplate().trim();
        this._element = wrap.firstElementChild as HTMLElement;

        this.#messagesEl = this._element.querySelector<HTMLElement>('.ai-chat-panel__messages');
        this.#thinkingEl = this._element.querySelector<HTMLElement>('.ai-chat-panel__thinking');
        this.#errorEl = this._element.querySelector<HTMLElement>('.ai-chat-panel__error');
        this.#textareaEl = this._element.querySelector<HTMLTextAreaElement>(
            '.ai-chat-panel__textarea'
        );
        this.#sendBtnEl = this._element.querySelector<HTMLButtonElement>('.ai-chat-panel__send');
        this.#modelSelectEl = this._element.querySelector<HTMLSelectElement>(
            '.ai-chat-panel__model-select'
        );
        this.#includeCellEl = this._element.querySelector<HTMLInputElement>(
            '.ai-chat-panel__include-cell'
        );
        this.#includeNotebookEl = this._element.querySelector<HTMLInputElement>(
            '.ai-chat-panel__include-notebook'
        );
        this.#clearBtnEl = this._element.querySelector<HTMLButtonElement>(
            '.ai-chat-panel__clear-btn'
        );
        this.#emptyEl = this._element.querySelector<HTMLElement>('.ai-chat-panel__empty');
    }

    /**
     * Монтирует панель в DOM, подключает обработчики, открывает WS-сессию,
     * загружает историю и список моделей. Идемпотентно.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();

        this._addListener(this.#sendBtnEl, 'click', (): void => {
            this.#handleSubmit();
        });
        this._addListener(this.#textareaEl, 'input', (): void => {
            this.#handleInput();
        });
        this._addListener(this.#textareaEl, 'keydown', (e: Event): void => {
            this.#handleKeydown(e as KeyboardEvent);
        });
        this._addListener(this.#clearBtnEl, 'click', (): void => {
            void this.#handleClear();
        });
        this._addListener(this._element.querySelector('form'), 'submit', (e: Event): void => {
            e.preventDefault();
        });

        this.#presetHandler = (e: Event): void => {
            const detail = (e as CustomEvent<AiOpenWithPromptDetail>).detail;
            this.#applyPreset(detail);
        };
        document.addEventListener(AI_OPEN_WITH_PROMPT_EVENT, this.#presetHandler);

        this.#openWS();
        void this.#bootstrap();
    }

    /**
     * Снимает обработчики, закрывает WS и очищает DOM. Должен быть вызван
     * перед уничтожением виджета (например, при смене ноутбука).
     */
    public unmount(): void {
        if (this.#presetHandler) {
            document.removeEventListener(AI_OPEN_WITH_PROMPT_EVENT, this.#presetHandler);
            this.#presetHandler = null;
        }
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
        super.unmount();
    }

    /**
     * Открывает WebSocket-сессию и связывает её колбэки с локальными
     * обработчиками входящих сообщений.
     */
    #openWS(): void {
        this.#ws = new ChatWS({
            onMessage: (m): void => {
                this.#onWSMessage(m);
            },
            onClose: (code): void => {
                if (code === 4403 || code === 1008) {
                    this.#showError('Чат недоступен на текущем тарифе');
                }
            }
        });
        this.#ws.connect();
    }

    /**
     * Подгружает историю, список моделей и пользовательские настройки.
     * Любая ошибка пишется в errorEl, но не ломает работу панели.
     */
    async #bootstrap(): Promise<void> {
        try {
            const history = await this.#api.getHistory(this.#notebookId);
            history.messages.forEach((m) => {
                this.#renderMessage(m);
            });
        } catch (e) {
            logError('AiChatPanel.history', e);
        }
        try {
            const models = await this.#api.getModels();
            this.#populateModelSelect(models.models);
        } catch (e) {
            logError('AiChatPanel.models', e);
        }
        try {
            const settings = await this.#api.getSettings();
            if (this.#modelSelectEl && settings.model !== '') {
                this.#modelSelectEl.value = settings.model;
            }
        } catch (e) {
            logError('AiChatPanel.settings', e);
        }
    }

    /**
     * Заполняет select моделей. Недоступные модели остаются в списке,
     * но disabled и помечены меткой требуемого тарифа.
     * @param models - список моделей из ответа /chat/models
     */
    #populateModelSelect(models: AiModelDTO[]): void {
        if (!this.#modelSelectEl) return;
        this.#modelSelectEl.innerHTML = '';
        const available = models.filter((m) => m.available);
        const locked = models.filter((m) => !m.available);

        available.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.label || m.id;
            nn(this.#modelSelectEl).appendChild(opt);
        });
        locked.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.disabled = true;
            opt.textContent = `${m.label || m.id} — доступно в ${m.required_plan ?? 'pro'}`;
            nn(this.#modelSelectEl).appendChild(opt);
        });
    }

    /**
     * Обработчик ввода в textarea: меняет disabled-флаг кнопки «Отправить»
     * и автоматически растягивает поле под содержимое.
     */
    #handleInput(): void {
        if (!this.#textareaEl || !this.#sendBtnEl) return;
        const hasText = this.#textareaEl.value.trim().length > 0;
        this.#sendBtnEl.disabled = !hasText || this.#streaming;
        this.#textareaEl.style.height = 'auto';
        this.#textareaEl.style.height = `${String(this.#textareaEl.scrollHeight)}px`;
    }

    /**
     * Обрабатывает Enter без Shift — отправляет сообщение.
     * @param e - keyboard-событие textarea
     */
    #handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.#handleSubmit();
        }
    }

    /**
     * Собирает текущий контекст диалога (выделенная ячейка + опционально весь
     * ноутбук) из чекбоксов панели.
     * @returns объект ContextOptions для передачи в ChatWS.sendMessage
     */
    #collectContext(): ChatContextOptions {
        const ctx: ChatContextOptions = {};
        if (this.#includeCellEl?.checked === true) {
            const cellContent = this.#findActiveCellContent();
            if (cellContent) {
                ctx.cell_content = cellContent.content;
                ctx.cell_language = cellContent.language;
            }
        }
        if (this.#includeNotebookEl?.checked === true) {
            ctx.include_notebook = true;
            ctx.notebook_dump = this.#dumpNotebook();
        }
        return ctx;
    }

    /**
     * Собирает запрос (контент + контекст + модель) и отправляет в WS.
     * Блокирует повторную отправку до завершения текущего ответа.
     */
    #handleSubmit(): void {
        if (this.#streaming) return;
        const text = this.#textareaEl?.value.trim() ?? '';
        if (text === '') return;
        if (!this.#ws || !this.#ws.isOpen()) {
            this.#showError('Соединение с чатом потеряно, попробуйте обновить страницу');
            return;
        }

        const selectedValue = this.#modelSelectEl?.value ?? '';
        const model = selectedValue !== '' ? selectedValue : undefined;
        const ctx = this.#collectContext();

        const ok = this.#ws.sendMessage(this.#notebookId, text, model, ctx);
        if (!ok) {
            this.#showError('Не удалось отправить сообщение');
            return;
        }

        this.#renderMessage({
            id: -1,
            role: 'user',
            content: text,
            tokens_in: 0,
            tokens_out: 0,
            notebook_id: this.#notebookId,
            created_at: Math.floor(Date.now() / 1000)
        });
        if (this.#textareaEl) {
            this.#textareaEl.value = '';
            this.#textareaEl.style.height = 'auto';
        }
        if (this.#sendBtnEl) {
            this.#sendBtnEl.disabled = true;
        }
        this.#startThinking();
    }

    /**
     * Очищает историю переписки по текущему ноутбуку: и на сервере, и в DOM.
     */
    async #handleClear(): Promise<void> {
        if (!confirm('Очистить историю чата для этого ноутбука?')) return; // eslint-disable-line no-alert -- minimal confirm UI; full modal will come with design pass
        try {
            await this.#api.clearHistory(this.#notebookId);
            if (this.#messagesEl) {
                this.#messagesEl.innerHTML = '';
                if (this.#emptyEl) {
                    this.#messagesEl.appendChild(this.#emptyEl);
                }
            }
        } catch (e) {
            logError('AiChatPanel.clear', e);
            this.#showError('Не удалось очистить историю');
        }
    }

    /**
     * Обрабатывает входящее WS-сообщение и переводит UI в соответствующее
     * состояние (печать чанка / завершение / ошибка).
     * @param msg - событие из ChatWS
     */
    #onWSMessage(msg: ChatWSIncoming): void {
        switch (msg.type) {
            case 'chunk':
                this.#appendAssistantChunk(msg.content ?? '');
                break;
            case 'done':
                this.#finishAssistant();
                break;
            case 'error':
                this.#finishAssistant();
                this.#showError(
                    msg.error_message ?? msg.error_code ?? 'Ошибка при работе с ИИ'
                );
                break;
            default:
                break;
        }
    }

    /**
     * Добавляет кусок ответа модели в текущий контейнер; создаёт контейнер,
     * если приходит первый чанк.
     * @param chunk - очередная порция текста
     */
    #appendAssistantChunk(chunk: string): void {
        if (!this.#currentAssistantContainer) {
            this.#stopThinking();
            this.#currentAssistantContainer = this.#createMessageElement('assistant');
            nn(this.#messagesEl).appendChild(this.#currentAssistantContainer);
            this.#currentAssistantContent = '';
        }
        this.#currentAssistantContent += chunk;
        const body = this.#currentAssistantContainer.querySelector<HTMLElement>(
            '.ai-chat-panel__message-body'
        );
        if (body) {
            body.innerHTML = this.#renderAssistantBody(this.#currentAssistantContent);
        }
        this.#scrollToBottom();
    }

    /**
     * Завершает текущий ответ модели: сбрасывает буфер, разблокирует
     * поле ввода и довешивает кнопки «Вставить в ячейку» на блоки кода.
     */
    #finishAssistant(): void {
        this.#stopThinking();
        if (this.#currentAssistantContainer) {
            this.#attachInsertButtons(this.#currentAssistantContainer);
            this.#currentAssistantContainer = null;
            this.#currentAssistantContent = '';
        }
        this.#streaming = false;
        this.#handleInput();
    }

    /**
     * Рисует одно сообщение в ленте (используется для истории и для
     * только что отправленных пользовательских сообщений).
     * @param msg - DTO сообщения
     */
    #renderMessage(msg: ChatMessageDTO): void {
        if (this.#emptyEl?.parentElement) {
            this.#emptyEl.parentElement.removeChild(this.#emptyEl);
        }
        const el = this.#createMessageElement(msg.role === 'assistant' ? 'assistant' : 'user');
        const body = el.querySelector<HTMLElement>('.ai-chat-panel__message-body');
        if (body) {
            if (msg.role === 'assistant') {
                body.innerHTML = this.#renderAssistantBody(msg.content);
            } else {
                body.textContent = msg.content;
            }
        }
        nn(this.#messagesEl).appendChild(el);
        if (msg.role === 'assistant') {
            this.#attachInsertButtons(el);
        }
        this.#scrollToBottom();
    }

    /**
     * Создаёт DOM-элемент пустого сообщения c подготовленным телом, аватаром
     * и явной плашкой автора («Вы» / «ИИ») для контрастного разделения
     * пользовательских и ассистентских реплик.
     * @param role - 'user' или 'assistant'
     * @returns корневой div сообщения
     */
    #createMessageElement(role: 'user' | 'assistant'): HTMLElement {
        const el = document.createElement('div');
        el.className = `ai-chat-panel__message ai-chat-panel__message--${role}`;
        const label = role === 'user' ? 'Вы' : 'ИИ';
        const avatar = role === 'user' ? 'В' : 'ИИ';
        el.innerHTML = `
            <div class="ai-chat-panel__message-avatar" aria-hidden="true">${avatar}</div>
            <div class="ai-chat-panel__message-bubble">
                <div class="ai-chat-panel__message-author">${label}</div>
                <div class="ai-chat-panel__message-body"></div>
            </div>
        `;
        return el;
    }

    /**
     * Конвертирует ответ ассистента в безопасный HTML: экранирует всё,
     * затем заменяет fenced code-блоки ```lang\n...\n``` на <pre><code>...
     * @param raw - сырой текст ответа
     * @returns HTML-строка для innerHTML
     */
    #renderAssistantBody(raw: string): string {
        const escaped = escapeHtml(raw);
        return escaped.replace(
            /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g,
            (_match, lang: string, body: string) =>
                `<pre class="ai-chat-panel__code" data-lang="${escapeHtml(lang)}"><code>${body}</code><button type="button" class="ai-chat-panel__insert-cell">Вставить в ячейку</button></pre>`
        );
    }

    /**
     * Навешивает обработчики на кнопки «Вставить в ячейку» внутри
     * указанного контейнера сообщения.
     * @param container - корневой элемент одного сообщения
     */
    #attachInsertButtons(container: HTMLElement): void {
        const buttons = container.querySelectorAll<HTMLButtonElement>(
            '.ai-chat-panel__insert-cell'
        );
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const pre = btn.closest('pre');
                if (!pre) return;
                const code = pre.querySelector('code')?.textContent ?? '';
                const language = pre.dataset.lang ?? '';
                document.dispatchEvent(
                    new CustomEvent<AiInsertCellDetail>(AI_INSERT_CELL_EVENT, {
                        detail: { code, language }
                    })
                );
                this.#copyToClipboard(code, btn);
            });
        });
    }

    /**
     * Копирует код в буфер обмена и кратко меняет надпись на кнопке,
     * чтобы пользователь видел подтверждение. Fallback на случай, если
     * страница не подцепила событие AI_INSERT_CELL_EVENT.
     * @param code - содержимое кодового блока
     * @param btn - DOM-кнопка, на которой показывается фидбек
     */
    #copyToClipboard(code: string, btn: HTMLButtonElement): void {
        navigator.clipboard
            .writeText(code)
            .then(() => {
                const original = btn.textContent;
                btn.textContent = 'Скопировано';
                setTimeout(() => {
                    if (btn.textContent === 'Скопировано') {
                        btn.textContent = original;
                    }
                }, 1500);
            })
            .catch((e: unknown) => {
                logError('AiChatPanel.clipboard', e);
            });
    }

    /**
     * Скроллит ленту сообщений к низу, чтобы новое сообщение было видно.
     */
    #scrollToBottom(): void {
        if (!this.#messagesEl) return;
        this.#messagesEl.scrollTop = this.#messagesEl.scrollHeight;
    }

    /**
     * Показывает индикатор «модель думает» и блокирует отправку.
     */
    #startThinking(): void {
        this.#streaming = true;
        if (this.#thinkingEl) this.#thinkingEl.hidden = false;
        if (this.#errorEl) this.#errorEl.hidden = true;
    }

    /**
     * Прячет индикатор «модель думает» (вызывается при первом чанке).
     */
    #stopThinking(): void {
        if (this.#thinkingEl) this.#thinkingEl.hidden = true;
    }

    /**
     * Выводит сообщение об ошибке в специальный блок и логирует.
     * @param text - текст ошибки для пользователя
     */
    #showError(text: string): void {
        if (this.#errorEl) {
            this.#errorEl.textContent = text;
            this.#errorEl.hidden = false;
        }
        this.#streaming = false;
        this.#handleInput();
    }

    /**
     * Применяет preset-запрос (приходит от CodeCell через CustomEvent).
     * Подставляет текст в textarea и при autoSend сразу отправляет.
     * @param detail - содержимое события AI_OPEN_WITH_PROMPT_EVENT
     */
    #applyPreset(detail: AiOpenWithPromptDetail): void {
        if (!this.#textareaEl) return;
        this.#textareaEl.value = detail.prompt;
        this.#handleInput();
        const hasCellContext = (detail.context?.cell_content ?? '') !== '';
        if (hasCellContext && this.#includeCellEl) {
            this.#includeCellEl.checked = true;
        }
        if (detail.autoSend === true) {
            this.#handleSubmit();
        } else {
            this.#textareaEl.focus();
        }
    }

    /**
     * Достаёт содержимое активной (focused) CodeCell со страницы — нужно для
     * подмешивания в контекст по чекбоксу «Текущая ячейка». Не SPA-friendly,
     * зато не требует прямой ссылки на CellList.
     * @returns текст и язык или null если активная ячейка не найдена
     */
    #findActiveCellContent(): { content: string; language: string } | null {
        const active = document.querySelector<HTMLElement>('.cell--active, .code-cell--focused');
        if (!active) return null;
        const textarea = active.querySelector<HTMLTextAreaElement>('textarea');
        if (!textarea) return null;
        return {
            content: textarea.value,
            language: active.dataset.language ?? ''
        };
    }

    /**
     * Сериализует весь ноутбук в текстовый дамп (один блок за другим,
     * code-блоки помечены fenced-разделителями). Используется для
     * чекбокса «Весь ноутбук».
     * @returns строка-дамп или пустая строка, если ничего не нашли
     */
    #dumpNotebook(): string {
        const cells = document.querySelectorAll<HTMLElement>('[data-block-id]');
        const parts: string[] = [];
        cells.forEach((cell) => {
            const lang = cell.dataset.language ?? '';
            const textarea = cell.querySelector<HTMLTextAreaElement>('textarea');
            const content = textarea?.value ?? '';
            if (content.trim() === '') return;
            if (lang !== '') {
                parts.push(`\`\`\`${lang}\n${content}\n\`\`\``);
            } else {
                parts.push(content);
            }
        });
        return parts.join('\n\n');
    }
}
