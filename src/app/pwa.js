/** @param {ServiceWorkerRegistration} registration */
function activateWaiting(registration) {
    if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING');
    }
}

/** @param {Function} onAccept */
function showUpdateToast(onAccept) {
    if (document.querySelector('.pwa-update-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';

    const label = document.createElement('span');
    label.textContent = 'Доступна новая версия';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Обновить';
    btn.addEventListener('click', () => {
        onAccept();
        toast.remove();
    });

    toast.appendChild(label);
    toast.appendChild(btn);
    document.body.appendChild(toast);
}

export function initPwa() {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost') return;

    navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
            if (registration.waiting) {
                showUpdateToast(() => activateWaiting(registration));
            }

            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(() => activateWaiting(registration));
                    }
                });
            });
        })
        .catch((err) => {
            console.warn('Service Worker registration failed:', err);
        });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
