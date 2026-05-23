import { BaseComponent } from '../../shared/components/base-component/BaseComponent.js';
import { AiApi } from '../../shared/api/AiApi.js';
import type { AiModelDTO } from '../../shared/api/chatTypes.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { AiSettingsTemplate } from './AiSettings.template.js';

/**
 * Секция настроек ИИ в `/profile`. Позволяет пользователю выбрать модель
 * по умолчанию (из whitelist его тарифа) и задать системный промпт; рядом
 * показывает суточное использование (запросы / токены) с лимитом тарифа.
 */
export class AiSettings extends BaseComponent {
    #api: AiApi;
    #modelSelectEl: HTMLSelectElement | null = null;
    #promptEl: HTMLTextAreaElement | null = null;
    #saveBtnEl: HTMLButtonElement | null = null;
    #statusEl: HTMLElement | null = null;
    #planHintEl: HTMLElement | null = null;
    #usageReqEl: HTMLElement | null = null;
    #usageTokEl: HTMLElement | null = null;

    /**
     * Конструктор: рендерит шаблон и кеширует ссылки на DOM-узлы.
     * @param parent - родительский контейнер секции профиля
     */
    public constructor(parent: HTMLElement) {
        super(null, parent);
        this.#api = new AiApi();
        this.#render();
    }

    /**
     * Создаёт корневой DOM-элемент из шаблона.
     */
    #render(): void {
        const wrap = document.createElement('div');
        wrap.innerHTML = AiSettingsTemplate().trim();
        this._element = wrap.firstElementChild as HTMLElement;

        this.#modelSelectEl = this._element.querySelector<HTMLSelectElement>(
            '.ai-settings__model-select'
        );
        this.#promptEl = this._element.querySelector<HTMLTextAreaElement>('.ai-settings__prompt');
        this.#saveBtnEl = this._element.querySelector<HTMLButtonElement>('.ai-settings__save');
        this.#statusEl = this._element.querySelector<HTMLElement>('[data-save-status]');
        this.#planHintEl = this._element.querySelector<HTMLElement>('[data-plan-hint]');
        this.#usageReqEl = this._element.querySelector<HTMLElement>('[data-usage-requests]');
        this.#usageTokEl = this._element.querySelector<HTMLElement>('[data-usage-tokens]');
    }

    /**
     * Монтирует секцию, подключает обработчики и параллельно подгружает
     * модели, текущие настройки и статистику.
     */
    public mount(): void {
        if (this._isMounted) return;
        super.mount();
        this._addListener(this.#saveBtnEl, 'click', (): void => {
            void this.#handleSave();
        });

        void this.#loadAll();
    }

    /**
     * Снимает секцию и обработчики (вызывается родителем при переключении вкладки).
     */
    public unmount(): void {
        if (!this._isMounted) return;
        super.unmount();
    }

    /**
     * Параллельно загружает модели, настройки и использование. Ошибки
     * каждого вызова не прерывают остальные.
     */
    async #loadAll(): Promise<void> {
        try {
            const models = await this.#api.getModels();
            this.#populateModels(models.models);
        } catch (e) {
            logError('AiSettings.models', e);
        }
        try {
            const settings = await this.#api.getSettings();
            if (this.#modelSelectEl && settings.model) {
                this.#modelSelectEl.value = settings.model;
            }
            if (this.#promptEl) {
                this.#promptEl.value = settings.system_prompt;
            }
        } catch (e) {
            logError('AiSettings.settings', e);
        }
        try {
            const usage = await this.#api.getUsage();
            if (this.#usageReqEl) {
                this.#usageReqEl.textContent = `${String(usage.requests_today)} / ${String(usage.daily_request_limit)}`;
            }
            if (this.#usageTokEl) {
                this.#usageTokEl.textContent = `${String(usage.tokens_today)} / ${String(usage.daily_token_limit)}`;
            }
        } catch (e) {
            logError('AiSettings.usage', e);
        }
    }

    /**
     * Заполняет селект моделей: сначала доступные, потом залоченные
     * с пометкой тарифа. Если все модели одного тарифа недоступны —
     * подсказывает обновиться.
     * @param models - список моделей с пометкой доступности
     */
    #populateModels(models: AiModelDTO[]): void {
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
        if (available.length === 0 && this.#planHintEl) {
            this.#planHintEl.textContent =
                'На вашем тарифе модели недоступны. Перейдите в раздел «Подписка», чтобы открыть чат с ИИ.';
        } else if (locked.length > 0 && this.#planHintEl) {
            this.#planHintEl.textContent = 'Доступно больше моделей на тарифах Pro/Max.';
        }
    }

    /**
     * Отправляет PUT /chat/settings с текущими model и system_prompt,
     * показывает статус «Сохранено» на 1.5 секунды.
     */
    async #handleSave(): Promise<void> {
        if (!this.#modelSelectEl || !this.#promptEl || !this.#saveBtnEl) return;
        const model = this.#modelSelectEl.value;
        const prompt = this.#promptEl.value;
        this.#saveBtnEl.disabled = true;
        try {
            await this.#api.updateSettings(model, prompt);
            if (this.#statusEl) {
                this.#statusEl.textContent = 'Сохранено';
                setTimeout(() => {
                    if (this.#statusEl) this.#statusEl.textContent = '';
                }, 1500);
            }
        } catch (e) {
            logError('AiSettings.save', e);
            if (this.#statusEl) {
                this.#statusEl.style.color = 'var(--error-red)';
                this.#statusEl.textContent =
                    e instanceof Error ? e.message : 'Не удалось сохранить';
            }
        } finally {
            this.#saveBtnEl.disabled = false;
        }
    }
}
