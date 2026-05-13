import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { AdminStatsSection } from '../../widgets/admin-stats-section/AdminStatsSection.js';
import { AdminNotebooksSection } from '../../widgets/admin-notebooks-section/AdminNotebooksSection.js';
import { AdminIssuesSection } from '../../widgets/admin-issues-section/AdminIssuesSection.js';
import { AdminUsersSection } from '../../widgets/admin-users-section/AdminUsersSection.js';
import { AdminFilesSection } from '../../widgets/admin-files-section/AdminFilesSection.js';
import { Router } from '../../shared/router/Router.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { nn } from '../../shared/utils/notNull.js';
import { logError } from '../../shared/utils/logger.js';
import { isAuthError } from '../../shared/http_client/authStatus.js';
import { renderServerUnavailable } from '../../shared/utils/serverUnavailable.js';

/**
 * Возвращает HTML-каркас админ-страницы: sidebar с четырьмя пунктами
 * (Статистика / Пользователи / Блокноты / Обращения) и пустую область
 * `.admin-page__content`, которую заполняет AdminPage в зависимости от
 * выбранной секции.
 * @returns HTML-строка корневого `<main>` элемента
 */
function AdminPageTemplate(): string {
    return `<main class="admin-page">
    <div class="admin-page__container">
        <nav class="admin-page__sidebar">
            <div class="admin-page__sidebar-group">
                <h3 class="admin-page__sidebar-title">Управление</h3>
                <button class="admin-page__sidebar-item admin-page__sidebar-item--active" data-section="stats">Статистика</button>
                <button class="admin-page__sidebar-item" data-section="users">Пользователи</button>
                <button class="admin-page__sidebar-item" data-section="notebooks">Блокноты</button>
                <button class="admin-page__sidebar-item" data-section="issues">Обращения</button>
                <button class="admin-page__sidebar-item" data-section="files">Файлы</button>
            </div>
        </nav>
        <div class="admin-page__content"></div>
    </div>
</main>`;
}

/**
 * Админ-панель платформы (`/admin`, доступна только пользователям с is_admin=true).
 * Содержит 4 секции: Статистика (DAU/MAU/MAU графики, обращения по категориям),
 * Пользователи (CRUD, смена тарифа, отправка email, бан), Блокноты (просмотр+удаление),
 * Обращения (issue-tracker с категориями bug/idea/problem/feedback и статусами
 * open/in_progress/resolved/closed, ответы на обращения).
 *
 * Перед рендером проверяет права через /auth/me; не-админ → редирект на /files.
 * Использует кастомный ContextMenu для action'ов и Modal для форм-диалогов.
 */
export class AdminPage {
    #root: HTMLElement;
    #httpClient: HttpClient;
    #user: Record<string, unknown> | null = null;
    #activeKey = 'stats';
    #contentArea: HTMLElement | null = null;
    #feedbackModal: FeedbackModal | null = null;

    /**
     * Сохраняет root и инициализирует HttpClient (singleton). Сами секции
     * (виджеты) создают свои AdminApi-инстансы по необходимости.
     * @param root - корневой элемент SPA
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Загружает данные пользователя через /auth/me, проверяет is_admin,
     * рендерит шапку GreenHeader, sidebar-каркас (через AdminPageTemplate)
     * и показывает дефолтную секцию 'stats'. При не-админе → редирект на /files,
     * при неавторизации → /sign.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (isAuthError(response.status)) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            if (!response.ok) {
                renderServerUnavailable(this.#root);
                return;
            }
            const { data: user } = (await response.json()) as { data: Record<string, unknown> };
            if (user.is_admin !== true) {
                nn(Router.getInstance()).navigate('/files');
                return;
            }
            this.#user = user;
        } catch (_e) {
            renderServerUnavailable(this.#root);
            return;
        }

        const initials = (this.#user.username as string).substring(0, 2).toUpperCase();
        const header = new GreenHeader(this.#root, {
            user: {
                username: this.#user.username as string,
                initials,
                avatarUrl: (this.#user.avatar_url as string) || ''
            },
            onProfile: (): void => {
                nn(Router.getInstance()).navigate('/profile');
            },
            onAdmin: (): void => {
                /* noop */
            },
            onFeedback: (): void => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onLogout: async (): Promise<void> => {
                try {
                    const response = await this.#httpClient.post('/auth/logout');
                    if (response.ok || isAuthError(response.status)) {
                        nn(Router.getInstance()).navigate('/sign');
                        return;
                    }
                    logError('Logout failed with HTTP status', response.status);
                } catch (e: unknown) {
                    logError('Logout request failed', e);
                }
            }
        });
        header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = AdminPageTemplate();
        const main = nn(tempContainer.firstElementChild);
        this.#root.appendChild(main);

        this.#contentArea = nn(main.querySelector('.admin-page__content'));
        this.#attachSidebarEvents(main as HTMLElement);
        this.#showSection('stats');
    }

    /**
     * Навешивает обработчики кликов по пунктам sidebar'а: переключает
     * active-класс и вызывает #showSection. Игнорирует клик по уже
     * активной секции.
     * @param main - корневой элемент содержимого admin-страницы
     */
    #attachSidebarEvents(main: HTMLElement): void {
        const items = main.querySelectorAll('.admin-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = (item as HTMLElement).dataset.section;
                if (section !== undefined && section !== this.#activeKey) {
                    items.forEach((i) => {
                        i.classList.remove('admin-page__sidebar-item--active');
                    });
                    item.classList.add('admin-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    /**
     * Очищает контент-область и инициализирует выбранную секцию.
     * Switch по ключу: stats / users / notebooks / issues. Каждый init-метод
     * сбрасывает свою пагинацию и поиск, рендерит таблицу и навешивает
     * search-debounce.
     * @param key - идентификатор секции из sidebar'а
     */
    #showSection(key: string): void {
        this.#activeKey = key;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#contentArea!.innerHTML = '';
        switch (key) {
            case 'stats': {
                const section = new AdminStatsSection(nn(this.#contentArea));
                void section.mount();
                break;
            }
            case 'users': {
                const section = new AdminUsersSection(
                    nn(this.#contentArea),
                    nn(this.#user).id as number
                );
                section.mount();
                break;
            }
            case 'notebooks': {
                const section = new AdminNotebooksSection(nn(this.#contentArea));
                section.mount();
                break;
            }
            case 'issues': {
                const section = new AdminIssuesSection(nn(this.#contentArea));
                section.mount();
                break;
            }
            case 'files': {
                const section = new AdminFilesSection(nn(this.#contentArea));
                section.mount();
                break;
            }
            default:
                break;
        }
    }

    /**
     * Очищает root. Виджеты ContextMenu/Modal/FeedbackModal — singleton'ы
     * с собственным lifecycle, их явно демонтировать не требуется.
     */
    public destroy(): void {
        this.#root.innerHTML = '';
    }
}
