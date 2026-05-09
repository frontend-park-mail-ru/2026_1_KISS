import type { BlockDTO, NotebookDTO } from '../../api/types.js';

/**
 * Доменная модель notebook'а: обёртка над NotebookDTO с типизированными
 * аксессорами и бизнес-правилами (isOwner). Заменяет нетипизированное
 * поле `Record<string, unknown>`, которое раньше держала страница BlocksPage.
 *
 * Жизненный цикл: создаётся из ответа NotebookApi.getNotebook(),
 * обновляется через mergeFrom() (rename) или replaceFrom() (full reload).
 * Поля для записи доступны только через явные методы — это защищает от
 * случайной мутации DTO напрямую.
 */
export class NotebookModel {
    #data: NotebookDTO;

    /**
     * Создаёт модель поверх готового DTO. DTO копируется по ссылке —
     * не используйте его после передачи в конструктор, чтобы не нарушить
     * инкапсуляцию.
     * @param data - DTO, полученный от NotebookApi
     */
    public constructor(data: NotebookDTO) {
        this.#data = data;
    }

    /**
     * ID notebook'а.
     * @returns серверный идентификатор notebook'а
     */
    public get id(): number {
        return this.#data.id;
    }

    /**
     * Текущий title notebook'а.
     * @returns заголовок (может быть пустой строкой)
     */
    public get title(): string {
        return this.#data.title;
    }

    /**
     * ID владельца notebook'а.
     * @returns user_id владельца
     */
    public get ownerId(): number {
        return this.#data.owner_id;
    }

    /**
     * Флаг публичности (доступен ли notebook по прямой ссылке).
     * @returns true если notebook публичный
     */
    public get isPublic(): boolean {
        return this.#data.is_public;
    }

    /**
     * Массив блоков notebook'а.
     * @returns массив BlockDTO (пустой, если поле отсутствует в DTO)
     */
    public get blocks(): BlockDTO[] {
        return this.#data.blocks ?? [];
    }

    /**
     * Исходный DTO. Используется при необходимости передать полную
     * структуру в внешний код (например при экспорте в .ipynb).
     * Не используйте для мутаций — только для чтения.
     * @returns ссылка на внутренний NotebookDTO
     */
    public get raw(): NotebookDTO {
        return this.#data;
    }

    /**
     * Проверяет, является ли указанный пользователь владельцем notebook'а.
     * Бизнес-правило, которое раньше повторялось в BlocksPage.
     * @param userId - ID проверяемого пользователя
     * @returns true если userId совпадает с owner_id
     */
    public isOwner(userId: number | null): boolean {
        return userId !== null && this.#data.owner_id === userId;
    }

    /**
     * Меняет заголовок notebook'а в локальном состоянии (без обращения
     * к серверу). Используется после успешного rename'а, чтобы UI отразил
     * новый title без перезагрузки.
     * @param title - новый заголовок
     */
    public setTitle(title: string): void {
        this.#data.title = title;
    }

    /**
     * Мержит частичный DTO в текущие данные (Object.assign-семантика).
     * Используется после mutation-эндпоинтов, которые возвращают только
     * изменившиеся поля.
     * @param partial - частичный NotebookDTO с обновлёнными полями
     */
    public mergeFrom(partial: Partial<NotebookDTO>): void {
        Object.assign(this.#data, partial);
    }

    /**
     * Заменяет всё внутреннее состояние новым DTO целиком (full-reload).
     * Используется после операций, после которых проще перезагрузить
     * notebook полностью (createBlock, deleteBlock, resync from WS).
     * @param data - новый полный DTO
     */
    public replaceFrom(data: NotebookDTO): void {
        this.#data = data;
    }
}
