export function EditorSettingsTemplate() {
    return `<div class="editor-settings">
    <h2 class="editor-settings__title">Настройки редактора</h2>
    <div class="editor-settings__form">
        <div class="editor-settings__field">
            <label class="editor-settings__label" for="editor-font-size">Размер шрифта</label>
            <select class="editor-settings__select" id="editor-font-size" data-setting="fontSize">
                <option value="12">12px</option>
                <option value="14" selected>14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
            </select>
        </div>
        <div class="editor-settings__field">
            <label class="editor-settings__label" for="editor-tab-size">Размер табуляции</label>
            <select class="editor-settings__select" id="editor-tab-size" data-setting="tabSize">
                <option value="2">2 пробела</option>
                <option value="4" selected>4 пробела</option>
                <option value="8">8 пробелов</option>
            </select>
        </div>
        <span class="editor-settings__saved-msg"></span>
    </div>
</div>`;
}
