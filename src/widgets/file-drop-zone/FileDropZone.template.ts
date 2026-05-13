/**
 * Рендерит контейнер drag-and-drop зоны для загрузки файлов с подсказкой и
 * скрытым input[type=file]. Заполнение состояния (loading/error/idle) делает
 * FileDropZone в рантайме.
 * @returns HTML-разметка для innerHTML
 */
export function FileDropZoneTemplate(): string {
    return `<div class="file-drop-zone" tabindex="0">
    <div class="file-drop-zone__inner">
        <div class="file-drop-zone__icon">+</div>
        <div class="file-drop-zone__title">Перетащите файлы сюда</div>
        <div class="file-drop-zone__subtitle">или</div>
        <button type="button" class="file-drop-zone__button">Выбрать файл</button>
        <input type="file" class="file-drop-zone__input" multiple hidden />
        <div class="file-drop-zone__status" aria-live="polite"></div>
    </div>
</div>`;
}
