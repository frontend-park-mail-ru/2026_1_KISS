import type { PermissionDTO } from '../../api/types.js';

/**
 * Опции для конструктора NotebookPermissions. Заполняются фабриками
 * forOwner / forSharedUser — напрямую конструктор обычно не вызывают.
 */
interface PermissionsOptions {
    /** true если пользователь — владелец notebook'а */
    isOwner: boolean;
    /** true если пользователь имеет право комментировать (owner или editor) */
    canComment: boolean;
}

/**
 * Иммутабельный набор разрешений текущего пользователя на конкретный notebook.
 *
 * Заменяет разрозненные булевы флаги (#isOwner, #canComment) в BlocksPage и
 * инкапсулирует правило "editor может комментировать". Используется виджетами
 * (CellList, NotebookHeader) для решения, какие пункты меню показывать и
 * разрешать ли действия.
 *
 * Создавайте через статические фабрики, а не через `new`:
 * - {@link NotebookPermissions.forOwner} — для владельца (без обращения к серверу).
 * - {@link NotebookPermissions.forSharedUser} — для пользователя с расшаренным доступом.
 */
export class NotebookPermissions {
    /** true если пользователь — владелец notebook'а */
    public readonly isOwner: boolean;
    /** true если пользователь имеет право комментировать (owner или editor) */
    public readonly canComment: boolean;

    /**
     * Сохраняет переданные флаги. Не предназначен для прямого вызова —
     * используйте статические фабрики forOwner / forSharedUser.
     * @param opts - набор разрешений
     */
    public constructor(opts: PermissionsOptions) {
        this.isOwner = opts.isOwner;
        this.canComment = opts.canComment;
    }

    /**
     * Возвращает разрешения для владельца notebook'а: всё разрешено,
     * без обращения к серверу за списком прав.
     * @returns NotebookPermissions с isOwner=true и canComment=true
     */
    public static forOwner(): NotebookPermissions {
        return new NotebookPermissions({ isOwner: true, canComment: true });
    }

    /**
     * Вычисляет разрешения для не-владельца на основе списка прав, выданных
     * на этот notebook. Если userId присутствует в списке как 'editor' —
     * пользователь может комментировать; иначе — только просмотр.
     * @param permissions - массив выданных прав (из getPermissions)
     * @param userId - ID текущего пользователя (или null если не залогинен)
     * @returns NotebookPermissions с isOwner=false и расчётным canComment
     */
    public static forSharedUser(
        permissions: PermissionDTO[],
        userId: number | null
    ): NotebookPermissions {
        const mine = permissions.find((p) => p.user_id === userId);
        return new NotebookPermissions({
            isOwner: false,
            canComment: mine?.permission_level === 'editor'
        });
    }
}
