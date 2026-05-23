/**
 * Возвращает HTML-разметку панели AI-чата: шапка с селектом моделей и чекбоксами
 * контекста, скроллируемая лента сообщений, индикатор «модель думает» и поле ввода.
 * Реальные опции селекта и сообщения подставляются JS-кодом компонента в mount().
 * @returns строка HTML для вставки в DOM
 */
export function AiChatPanelTemplate(): string {
    return `
<div class="ai-chat-panel">
    <header class="ai-chat-panel__header">
        <div class="ai-chat-panel__title">Чат с ИИ</div>
        <div class="ai-chat-panel__controls">
            <label class="ai-chat-panel__label">
                Модель
                <select class="ai-chat-panel__model-select" aria-label="Выбор модели">
                    <option value="" disabled selected>Загрузка…</option>
                </select>
            </label>
            <div class="ai-chat-panel__context-toggles">
                <label>
                    <input type="checkbox" class="ai-chat-panel__include-cell" />
                    Текущая ячейка
                </label>
                <label>
                    <input type="checkbox" class="ai-chat-panel__include-notebook" />
                    Весь ноутбук
                </label>
            </div>
            <button type="button" class="ai-chat-panel__clear-btn simple-btn" title="Очистить историю">
                Очистить
            </button>
        </div>
    </header>

    <div class="ai-chat-panel__messages" aria-live="polite">
        <div class="ai-chat-panel__empty">
            Задайте вопрос ИИ — например, «Объясни этот код» или «Найди ошибку».
        </div>
    </div>

    <div class="ai-chat-panel__thinking" hidden>
        <span></span><span></span><span></span>
    </div>

    <div class="ai-chat-panel__error" hidden></div>

    <form class="ai-chat-panel__form">
        <textarea
            class="ai-chat-panel__textarea"
            rows="2"
            placeholder="Спросите что угодно… (Shift+Enter — новая строка)"
        ></textarea>
        <button type="submit" class="ai-chat-panel__send accent-btn" disabled>Отправить</button>
    </form>
</div>
`;
}
