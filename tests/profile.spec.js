import { test, expect } from '@playwright/test';

const mockUser = {
    data: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: '',
        status: 'My status',
        description: 'My bio',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
    }
};

const mockNotebooks = {
    data: { notebooks: [], total: 0, limit: 7, offset: 0 }
};

async function mockAuthAPI(page) {
    await page.route('**/api/v1/auth/me', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
    });
}

test.describe('Profile Page', () => {
    test('loads and displays user data', async ({ page }) => {
        await mockAuthAPI(page);
        await page.goto('/profile');
        await expect(page.locator('.profile-page__sidebar')).toBeVisible();
        await expect(page.locator('.profile-section__title')).toHaveText('Профиль');
    });

    test('profile button navigates to profile page', async ({ page }) => {
        await mockAuthAPI(page);
        await page.route('**/api/v1/notebooks**', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockNotebooks)
            });
        });

        await page.goto('/files');
        await page.locator('.header-user-pill').click();
        await page.locator('[data-action="profile"]').click();
        await expect(page).toHaveURL(/\/profile/);
    });

    test('sidebar section switching works', async ({ page }) => {
        await mockAuthAPI(page);
        await page.goto('/profile');

        await page.locator('[data-section="password"]').click();
        await expect(page.locator('.password-section__title')).toHaveText('Смена пароля');

        await page.locator('[data-section="subscription"]').click();
        await expect(page.locator('.subscription-section__title')).toHaveText('Подписка');

        await page.locator('[data-section="editor"]').click();
        await expect(page.locator('.editor-settings__title')).toHaveText('Настройки редактора');

        await page.locator('[data-section="danger"]').click();
        await expect(page.locator('.danger-zone__title')).toHaveText('Удаление аккаунта');

        await page.locator('[data-section="profile"]').click();
        await expect(page.locator('.profile-section__title')).toHaveText('Профиль');
    });

    test('profile update submits correctly', async ({ page }) => {
        await mockAuthAPI(page);

        let putCalled = false;
        await page.route('**/api/v1/users/me', (route) => {
            if (route.request().method() === 'PUT') {
                putCalled = true;
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockUser)
                });
            } else {
                route.continue();
            }
        });

        await page.goto('/profile');
        await page.locator('.profile-section__save-btn').click();
        expect(putCalled).toBe(true);
    });

    test('avatar upload sends multipart request', async ({ page }) => {
        await mockAuthAPI(page);

        let uploadCalled = false;
        let hasCorrectContentType = false;
        await page.route('**/api/v1/users/me/avatar', (route) => {
            uploadCalled = true;
            const ct = route.request().headers()['content-type'] || '';
            hasCorrectContentType =
                ct.includes('multipart/form-data') && ct.includes('boundary=');
            const updated = { ...mockUser.data, avatar_url: '/uploads/test.jpg' };
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: updated })
            });
        });

        await page.goto('/profile');
        const fileInput = page.locator('.profile-section__file-input');
        const squarePng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'base64'
        );
        await fileInput.setInputFiles({
            name: 'avatar.png',
            mimeType: 'image/png',
            buffer: squarePng
        });

        await page.waitForTimeout(1000);
        expect(uploadCalled).toBe(true);
        expect(hasCorrectContentType).toBe(true);
    });

    test('unauthenticated user is redirected to /sign', async ({ page }) => {
        await page.route('**/api/v1/auth/me', (route) => {
            route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
        });

        await page.goto('/profile');
        await expect(page).toHaveURL(/\/sign/);
    });

    test('password change form validates and submits', async ({ page }) => {
        await mockAuthAPI(page);

        let passwordChanged = false;
        await page.route('**/api/v1/users/me/password', (route) => {
            passwordChanged = true;
            route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":null}' });
        });

        await page.goto('/profile');
        await page.locator('[data-section="password"]').click();

        const inputs = page.locator('.password-section .input-field');
        await inputs.nth(0).fill('oldpassword123');
        await inputs.nth(1).fill('newpassword123');
        await inputs.nth(2).fill('newpassword123');

        await page.locator('.password-section__submit-btn').click();
        await page.waitForTimeout(500);
        expect(passwordChanged).toBe(true);
    });

    test('editor settings save to localStorage', async ({ page }) => {
        await mockAuthAPI(page);
        await page.goto('/profile');
        await page.locator('[data-section="editor"]').click();

        await page.locator('#editor-font-size').selectOption('18');

        const saved = await page.evaluate(() => localStorage.getItem('kisscolab_editor'));
        const parsed = JSON.parse(saved);
        expect(parsed.fontSize).toBe('18');
    });
});
