import { GreenHeader } from '../../widgets/green-header/GreenHeader.js';
import { ProfileSection } from '../../widgets/profile-section/ProfileSection.js';
import { PasswordSection } from '../../widgets/password-section/PasswordSection.js';
import { SubscriptionSection } from '../../widgets/subscription-section/SubscriptionSection.js';
import { EditorSettings } from '../../widgets/editor-settings/EditorSettings.js';
import { HttpClient } from '../../shared/http_client/HttpClient.js';
import { Router } from '../../shared/router/Router.js';
import { ProfilePageTemplate } from './ProfilePage.template.js';

const SECTION_MAP = {
    profile: ProfileSection,
    password: PasswordSection,
    subscription: SubscriptionSection,
    editor: EditorSettings
};

/**
 * ProfilePage renders the user settings page with a sidebar navigation
 * and switchable content sections.
 */
export class ProfilePage {
    #root;
    #header;
    #httpClient;
    #user = null;
    #activeKey = 'profile';
    #activeSection = null;
    #contentArea = null;

    /**
     * @param {HTMLElement} root - root container element
     */
    constructor(root) {
        this.#root = root;
        this.#httpClient = HttpClient.getInstance();
    }

    /**
     * Fetches user data and renders the profile page layout.
     * Redirects to /sign if user is not authenticated.
     * @returns {Promise<void>}
     */
    async render() {
        this.#root.innerHTML = '';

        try {
            const response = await this.#httpClient.get('/auth/me');
            if (!response.ok) {
                Router.getInstance().navigate('/sign');
                return;
            }
            const { data: user } = await response.json();
            this.#user = user;
        } catch (_e) {
            Router.getInstance().navigate('/sign');
            return;
        }

        const initials = this.#user.username.substring(0, 2).toUpperCase();

        this.#header = new GreenHeader(this.#root, {
            user: {
                username: this.#user.username,
                initials,
                avatarUrl: this.#user.avatar_url || ''
            },
            onProfile: () => {},
            onLogout: async () => {
                try {
                    await this.#httpClient.post('/auth/logout');
                } catch (_e) {
                    /* ignore */
                }
                Router.getInstance().navigate('/sign');
            }
        });
        this.#header.render();

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = ProfilePageTemplate();
        const main = tempContainer.firstElementChild;
        this.#root.appendChild(main);

        this.#contentArea = main.querySelector('.profile-page__content');
        this.#attachSidebarEvents(main);
        this.#showSection('profile');
    }

    /**
     * Attaches click handlers to sidebar navigation items.
     * @param {HTMLElement} main - the main layout element
     */
    #attachSidebarEvents(main) {
        const items = main.querySelectorAll('.profile-page__sidebar-item');
        items.forEach((item) => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section && section !== this.#activeKey) {
                    items.forEach((i) => i.classList.remove('profile-page__sidebar-item--active'));
                    item.classList.add('profile-page__sidebar-item--active');
                    this.#showSection(section);
                }
            });
        });
    }

    /**
     * Unmounts the current section and mounts a new one.
     * @param {string} key - section identifier from SECTION_MAP
     */
    #showSection(key) {
        if (this.#activeSection) {
            this.#activeSection.unmount();
            this.#activeSection = null;
        }

        this.#activeKey = key;
        const SectionClass = SECTION_MAP[key];
        if (!SectionClass) return;

        this.#activeSection = new SectionClass(this.#contentArea, {
            user: this.#user,
            onUserUpdate: (updatedUser) => {
                this.#user = updatedUser;
            }
        });
        this.#activeSection.mount();
    }

    /**
     * Cleans up all widgets and clears the root element.
     */
    destroy() {
        if (this.#activeSection) {
            this.#activeSection.unmount();
        }
        this.#root.innerHTML = '';
    }
}
