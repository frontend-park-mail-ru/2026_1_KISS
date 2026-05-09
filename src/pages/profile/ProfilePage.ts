import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { ProfileSection } from '../../widgets/profile-section/ProfileSection.js';
import { PasswordSection } from '../../widgets/password-section/PasswordSection.js';
import { SubscriptionSection } from '../../widgets/subscription-section/SubscriptionSection.js';
import { EditorSettings } from '../../widgets/editor-settings/EditorSettings.js';
import { StatsSection } from '../../widgets/stats-section/StatsSection.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { ProfilePageTemplate } from './ProfilePage.template.js';
import { FeedbackModal } from '../../widgets/feedback-modal/FeedbackModal.js';
import { nn } from '../../shared/utils/notNull.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTION_MAP: Record<string, new (...args: any[]) => { mount(): void; unmount(): void }> = {
    profile: ProfileSection,
    password: PasswordSection,
    subscription: SubscriptionSection,
    stats: StatsSection,
    editor: EditorSettings
};

export class ProfilePage {
    #root: HTMLElement;
    #header: GreenHeader | null = null;
    #httpClient: HttpClient;
    #user: Record<string, unknown> | null = null;
    #activeKey = 'profile';
    #activeSection: { mount(): void; unmount(): void } | null = null;
    #contentArea: HTMLElement | null = null;
    #feedbackModal: FeedbackModal | null = null;

    public constructor(root: HTMLElement) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    public async render(): Promise<void> {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                nn(Router.getInstance()).navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#user = user;
        } catch (_e) {
            nn(Router.getInstance()).navigate('/sign');
            return;
        }

        const initials = (nn(this.#user).username as string).substring(0, 2).toUpperCase();

        const headerConfig: Record<string, unknown> = {
            user: {
                username: nn(this.#user).username,
                initials,
                avatarUrl: (nn(this.#user).avatar_url as string) || ''
            },
            onProfile: () => {},
            onFeedback: () => {
                if (!this.#feedbackModal) this.#feedbackModal = new FeedbackModal();
                this.#feedbackModal.open();
            },
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                nn(Router.getInstance()).navigate('/sign');
            }
        };
        if (nn(this.#user).is_admin) {
            headerConfig.onAdmin = () => { nn(Router.getInstance()).navigate('/admin'); };
        }
        this.#header = new GreenHeader(this.#root, headerConfig);
        this.#header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ProfilePageTemplate();
        const main = nn(tempContainer.firstElementChild);
        this.#root.appendChild(main);

        this.#contentArea = nn(main.querySelector('.profile-page__content'));
        this.#attachSidebarEvents(main as HTMLElement);
        this.#showSection('profile');
    }

    #attachSidebarEvents(main: HTMLElement): void {
        const items = main.querySelectorAll('.profile-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = (item as HTMLElement).dataset.section;
                if (section && section !== this.#activeKey) {
                    items.forEach((i) => { i.classList.remove('profile-page__sidebar-item--active'); });
                    item.classList.add('profile-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    #showSection(key: string): void {
        if (this.#activeSection) {
            this.#activeSection.unmount();
            this.#activeSection = null;
        }

        this.#activeKey = key;
        const SectionClass = SECTION_MAP[key] as (typeof SECTION_MAP)[keyof typeof SECTION_MAP] | undefined;
        if (!SectionClass) return;

        this.#activeSection = new SectionClass(this.#contentArea, {
            user: this.#user,
            onUserUpdate: (updatedUser: Record<string, unknown>) => {
                this.#user = updatedUser;
            }
        });
        this.#activeSection.mount();
    }

    public destroy(): void {
        if (this.#activeSection) {
            this.#activeSection.unmount();
        }
        this.#root.innerHTML = '';
    }
}
