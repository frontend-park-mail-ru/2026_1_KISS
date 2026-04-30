export function DangerZoneTemplate(): string {
    return `<div class="danger-zone">
    <h2 class="danger-zone__title">Удаление аккаунта</h2>
    <div class="danger-zone__card">
        <p class="danger-zone__warning">После удаления аккаунта все ваши ноутбуки и данные будут безвозвратно удалены. Это действие нельзя отменить.</p>
        <button class="danger-zone__delete-btn" disabled>Удалить аккаунт</button>
        <p class="danger-zone__notice">Функция временно недоступна</p>
    </div>
</div>`;
}
