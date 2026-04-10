export function FilterBarTemplate() {
    return `<div class="filter-bar">
    <div class="filter-bar__filters">
        <div class="filter-bar__date-wrapper">
            <button class="filter-bar__dropdown-btn filter-bar__date-btn">Изменено</button>
            <div class="filter-bar__date-dropdown">
                <label class="filter-bar__date-label">
                    От
                    <input type="date" class="filter-bar__date-input filter-bar__date-from">
                </label>
                <label class="filter-bar__date-label">
                    До
                    <input type="date" class="filter-bar__date-input filter-bar__date-to">
                </label>
            </div>
        </div>
        <div class="filter-bar__owner-wrapper">
            <button class="filter-bar__dropdown-btn filter-bar__owner-btn">Владелец</button>
            <div class="filter-bar__owner-dropdown"></div>
        </div>
        <div class="filter-bar__tags"></div>
        <button class="filter-bar__clear-btn">Очистить фильтр</button>
    </div>
    <button class="simple-btn filter-bar__create-btn">+ Создать файл</button>
</div>`;
}
