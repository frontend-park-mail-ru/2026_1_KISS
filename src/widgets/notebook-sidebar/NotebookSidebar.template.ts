/**
 * Рендерит сайдбар notebook'а: 4 кнопки переключения панелей (search/toc/files/resources)
 * и сами панели (find&replace, оглавление, файлы, ресурсы контейнера со sparklines).
 * @returns HTML-разметка для innerHTML
 */
export function NotebookSidebarTemplate(): string {
    return `<aside class="notebook-sidebar">
    <div class="notebook-sidebar__icons">
        <button class="notebook-sidebar__icon-btn" data-panel="search" title="Найти и заменить">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
        </button>
        <button class="notebook-sidebar__icon-btn" data-panel="toc" title="Содержание">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
        </button>
        <button class="notebook-sidebar__icon-btn" data-panel="files" title="Файлы">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
        </button>
        <button class="notebook-sidebar__icon-btn" data-panel="resources" title="Ресурсы">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
        </button>
    </div>
    <div class="notebook-sidebar__panel notebook-sidebar__panel--search">
        <h3 class="notebook-sidebar__panel-title">Найти и заменить</h3>
        <div class="notebook-sidebar__panel-content">
            <input type="text" class="notebook-sidebar__input notebook-sidebar__find-input" placeholder="Найти...">
            <input type="text" class="notebook-sidebar__input notebook-sidebar__replace-input" placeholder="Заменить на...">
            <label class="notebook-sidebar__checkbox">
                <input type="checkbox" class="notebook-sidebar__case-toggle">
                Учитывать регистр
            </label>
            <div class="notebook-sidebar__find-row">
                <button class="notebook-sidebar__find-btn" data-action="find">Найти</button>
                <button class="notebook-sidebar__nav-btn" data-action="prev" title="Назад">↑</button>
                <button class="notebook-sidebar__nav-btn" data-action="next" title="Далее">↓</button>
                <span class="notebook-sidebar__match-count">0 / 0</span>
            </div>
            <div class="notebook-sidebar__replace-links">
                <button class="notebook-sidebar__link-btn" data-action="replace">Заменить</button>
                <button class="notebook-sidebar__link-btn" data-action="replace-all">Заменить все</button>
            </div>
        </div>
    </div>
    <div class="notebook-sidebar__panel notebook-sidebar__panel--toc">
        <h3 class="notebook-sidebar__panel-title">Содержание</h3>
        <div class="notebook-sidebar__panel-content">
            <p class="notebook-sidebar__placeholder">Нет заголовков</p>
        </div>
    </div>
    <div class="notebook-sidebar__panel notebook-sidebar__panel--files">
        <h3 class="notebook-sidebar__panel-title">Файлы</h3>
        <div class="notebook-sidebar__panel-content">
            <p class="notebook-sidebar__placeholder">Нет файлов</p>
        </div>
    </div>
    <div class="notebook-sidebar__panel notebook-sidebar__panel--resources">
        <h3 class="notebook-sidebar__panel-title">Ресурсы</h3>
        <div class="notebook-sidebar__panel-content">
            <div class="container-stats container-stats--sidebar container-stats--inactive">
                <div class="container-stats__row">
                    <span class="container-stats__label">RAM</span>
                    <span class="container-stats__value" data-metric="ram">--</span>
                </div>
                <div class="container-stats__bar">
                    <div class="container-stats__bar-fill"></div>
                </div>
                <div class="container-stats__row">
                    <span class="container-stats__label">CPU</span>
                    <span class="container-stats__value" data-metric="cpu">--</span>
                </div>
                <div class="container-stats__divider"></div>
                <div class="container-stats__row">
                    <span class="container-stats__label">Ядра CPU</span>
                    <span class="container-stats__value" data-metric="cores">--</span>
                </div>
                <div class="container-stats__row">
                    <span class="container-stats__label">Диск (tmpfs)</span>
                    <span class="container-stats__value" data-metric="disk">--</span>
                </div>
                <div class="container-stats__row">
                    <span class="container-stats__label">GPU</span>
                    <span class="container-stats__value" data-metric="gpu">--</span>
                </div>
                <div class="container-stats__divider"></div>
                <div class="container-stats__sparkline-group">
                    <div class="container-stats__sparkline-label">RAM</div>
                    <div class="container-stats__sparkline" data-sparkline="ram"></div>
                    <div class="container-stats__sparkline-label">CPU</div>
                    <div class="container-stats__sparkline" data-sparkline="cpu"></div>
                </div>
            </div>
        </div>
    </div>
</aside>`;
}
