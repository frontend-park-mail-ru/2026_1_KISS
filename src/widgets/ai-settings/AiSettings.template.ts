/**
 * Рендерит секцию настроек ИИ для страницы профиля: выбор модели,
 * системный промпт и блок суточного использования.
 * @returns HTML-строка для innerHTML
 */
export function AiSettingsTemplate(): string {
    return `
<section class="ai-settings">
    <h2 class="ai-settings__title">Настройки ИИ</h2>

    <div class="ai-settings__field">
        <label class="ai-settings__label">
            Модель по умолчанию
            <select class="ai-settings__model-select">
                <option value="" disabled selected>Загрузка…</option>
            </select>
        </label>
        <p class="ai-settings__hint" data-plan-hint></p>
    </div>

    <div class="ai-settings__field">
        <label class="ai-settings__label">
            Системный промпт
            <textarea
                class="ai-settings__prompt"
                rows="6"
                maxlength="8000"
                placeholder="Например: «Ты — помощник в области data science»"
            ></textarea>
        </label>
        <p class="ai-settings__hint">До 8000 символов. Подставляется автоматически перед каждым диалогом.</p>
    </div>

    <div class="ai-settings__usage" data-usage>
        <h3 class="ai-settings__subtitle">Использование сегодня</h3>
        <div class="ai-settings__usage-row">
            <span>Запросы</span>
            <span data-usage-requests>—</span>
        </div>
        <div class="ai-settings__usage-row">
            <span>Токены</span>
            <span data-usage-tokens>—</span>
        </div>
    </div>

    <div class="ai-settings__actions">
        <button type="button" class="ai-settings__save accent-btn">Сохранить</button>
        <span class="ai-settings__status" data-save-status></span>
    </div>
</section>
`;
}
