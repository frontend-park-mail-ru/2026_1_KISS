import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { PricingTable, type PlanId } from '../../widgets/pricing-table/PricingTable.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { logError } from '../../shared/utils/logger.js';
import { nn } from '../../shared/utils/notNull.js';
import { isAuthError } from '../../shared/http_client/authStatus.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import type { ApiEnvelope, UserDTO } from '../../shared/api/types.js';
import { PricingPageTemplate } from './PricingPage.template.js';

/**
 * Конфиг шапки в auth-режиме: пользовательский pill + действия dropdown.
 * Передаётся в GreenHeader без специального DTO, чтобы повторить контракт
 * существующих страниц (Files/Profile/Disk).
 */
interface AuthHeaderConfig {
    /** Данные user-pill: имя, инициалы, аватар */
    user: { username: string; initials: string; avatarUrl: string };
    /** Обработчик клика по «Профиль» */
    onProfile: () => void;
    /** Обработчик клика по «Выйти» */
    onLogout: () => Promise<void>;
    /** Обработчик клика по «Обратная связь» */
    onFeedback: () => void;
    /** Обработчик клика по «Админ-панель» — только если пользователь админ */
    onAdmin?: () => void;
}

/**
 * Публичная страница тарифов /pricing. Доступна и гостям, и авторизованным:
 * в первом случае рендерит гостевую шапку и виджет PricingTable в режиме
 * public (CTA ведут на регистрацию), во втором — auth-шапку и виджет в
 * режиме authenticated (CTA ведут в профиль на оплату). Текущий план
 * пользователя подсвечивается в таблице.
 *
 * Загрузка /auth/me нужна только для того чтобы решить какой режим
 * рендерить; сама таблица данных с бэка не запрашивает (цены и фичи
 * декларативные и проверяются бэкендом при оплате).
 */
export class PricingPage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #table: PricingTable | null = null;
    #feedbackModal: FeedbackModal | null = null;

    /**
     * Запоминает корневой элемент SPA. Рендер откладывается до render().
     * @param root - корневой контейнер приложения
     */
    public constructor(root: HTMLElement) {
        this.#root = root;
    }

    /**
     * Рендерит страницу. Проверяет /auth/me для выбора режима, ставит
     * соответствующую шапку и монтирует PricingTable. Ошибки сети
     * (offline / 5xx) тихо переводят страницу в public-режим.
     */
    public async render(): Promise<void> {
        this.#root.innerHTML = '';
        const user = await this.#probeUser();

        if (user) {
            this.#renderAuthHeader(user);
        } else {
            this.#renderGuestHeader();
        }

        const tmp = document.createElement('div');
        tmp.innerHTML = PricingPageTemplate();
        const page = nn(tmp.firstElementChild) as HTMLElement;
        this.#root.appendChild(page);

        const tableSlot = nn(page.querySelector<HTMLElement>('[data-table]'));
        const router = nn(Router.getInstance());

        this.#table = new PricingTable(tableSlot, {
            mode: user ? 'authenticated' : 'public',
            currentPlan: user?.plan,
            onSelectPlan: (plan: PlanId): void => {
                router.navigate(`/profile?section=subscription&plan=${plan}`);
            },
            onPublicCta: (): void => {
                router.navigate('/sign?mode=register');
            }
        });
        this.#table.mount();
    }

    /**
     * Разрушает страницу: размонтирует таблицу и закрывает фидбек-модалку.
     * Вызывается роутером при переходе на другой маршрут.
     */
    public destroy(): void {
        if (this.#table) this.#table.unmount();
        if (this.#feedbackModal) this.#feedbackModal.close();
    }

    /**
     * Запрашивает /auth/me и возвращает DTO пользователя при успешной сессии.
     * Любые ошибки трактуются как «гость» — таблица всё равно отрендерится.
     * @returns DTO пользователя или null если гость / запрос упал
     */
    async #probeUser(): Promise<UserDTO | null> {
        try {
            const response = await HttpClient.getInstance().get('/auth/me');
            if (!response.ok) return null;
            const result = (await response.json()) as Partial<ApiEnvelope<UserDTO>>;
            return result.data ?? null;
        } catch (err) {
            logError('PricingPage.probeUser', err);
            return null;
        }
    }

    /**
     * Рендерит шапку для авторизованного пользователя: user-pill и dropdown
     * с навигацией в профиль, выходом, фидбеком и (опционально) админкой.
     * @param user - DTO авторизованного пользователя
     */
    #renderAuthHeader(user: UserDTO): void {
        const router = nn(Router.getInstance());
        const initials = user.username.substring(0, 2).toUpperCase();

        const config: AuthHeaderConfig = {
            user: {
                username: user.username,
                initials,
                avatarUrl: user.avatar_url
            },
            onProfile: (): void => {
                router.navigate('/profile');
            },
            onFeedback: (): void => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async (): Promise<void> => {
                try {
                    const response = await HttpClient.getInstance().post('/auth/logout');
                    if (response.ok || isAuthError(response.status)) {
                        router.navigate('/sign');
                        return;
                    }
                    logError('PricingPage logout failed', response.status);
                } catch (err) {
                    logError('PricingPage logout error', err);
                }
            }
        };

        if (user.is_admin) {
            config.onAdmin = (): void => {
                router.navigate('/admin');
            };
        }

        this.#header = new GreenHeader(this.#root, config);
        this.#header.render();
    }

    /**
     * Рендерит гостевую шапку с кнопками «Войти» и «Регистрация».
     * Клики на кнопки навигируют на /sign с соответствующим режимом.
     */
    #renderGuestHeader(): void {
        const router = nn(Router.getInstance());
        this.#header = new GreenHeader(this.#root);
        this.#header.render();

        this.#header.registerBtn?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            router.navigate('/sign?mode=register');
        });
        this.#header.loginBtn?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            router.navigate('/sign?mode=login');
        });
    }
}
