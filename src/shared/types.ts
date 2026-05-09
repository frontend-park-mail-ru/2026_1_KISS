/**
 * Один блок (cell) внутри notebook'а. type определяет вид: 'code' для CodeCell,
 * 'text' для TextCell. Соответствует серверной модели Block.
 */
export interface BlockData {
    /** UUID блока */
    id: string;
    /** Тип блока: 'code' или 'text' */
    type: string;
    /** Содержимое: код или текст */
    content: string;
}

/**
 * Notebook — основная сущность приложения. blocks подгружаются опционально
 * (отдельным запросом для конкретного notebook'а). Соответствует серверной модели.
 */
export interface Notebook {
    /** UUID notebook'а */
    id: string;
    /** Заголовок (показывается пользователю) */
    title: string;
    /** ISO-дата последнего обновления */
    updated_at: string;
    /** Имя владельца — приходит когда notebook расшарен мне другим пользователем */
    owner_username?: string;
    /** Массив блоков (опционально, когда нужны детали) */
    blocks?: BlockData[];
}

/**
 * Минимальные данные пользователя для UI-обвязок (header, profile-section).
 */
export interface UserData {
    /** Логин */
    username: string;
    /** Email (опционально, может не приходить в публичных эндпоинтах) */
    email?: string;
}

/**
 * Конфиг компонента Input — параметры валидации и отображения.
 */
export interface InputConfig {
    /** type атрибута input ('text', 'email', 'password', ...) */
    type: string;
    /** id атрибута (для связки с label) */
    id: string;
    /** placeholder */
    placeholder: string;
    /** Обязательное поле */
    required: boolean;
    /** Регулярка валидации (как строка); null если не нужно */
    pattern: string | null;
    /** Сообщение об ошибке при несовпадении с pattern */
    error_by_pattern: string;
    /** Минимальная длина значения; null если не нужно */
    minlength: number | null;
    /** Максимальная длина значения; null если не нужно */
    maxlength: number | null;
}

/**
 * Внутреннее состояние Input: текущее значение и валидность.
 */
export interface InputState {
    /** Прошла ли последняя валидация */
    isValid: boolean;
    /** Текущее значение поля */
    value: string;
}

/**
 * Один пункт kebab-меню: name (data-action), label (видимый текст), handler.
 */
export interface KebabAction {
    /** Идентификатор (попадает в data-action) */
    name: string;
    /** Видимый текст пункта */
    label: string;
    /** Обработчик клика */
    handler: () => void;
}

/**
 * Запись о навешанном слушателе для автоматической очистки при unmount компонента.
 */
export interface EventListenerRecord {
    /** Целевой EventTarget */
    element: EventTarget;
    /** Имя события */
    event: string;
    /** Функция-обработчик (с уже привязанным this) */
    handler: EventListener;
}

/**
 * Интерфейс жизненного цикла страницы. Любой класс зарегистрированный в роутере
 * через addRoute должен реализовывать этот контракт.
 */
export interface PageInstance {
    /**
     * Рендерит страницу в корневой элемент. Вызывается роутером сразу после
     * создания экземпляра.
     */
    render(): void;
    /**
     * Освобождает ресурсы (снимает таймеры, WebSocket'ы, глобальные слушатели).
     * Вызывается роутером перед навигацией на следующую страницу.
     */
    destroy?(): void;
}

/**
 * Конструктор страницы. Принимает корневой элемент и Record params из роутера.
 * `any[]` нужен потому что разные страницы принимают разные сигнатуры
 * (некоторые без params, некоторые с дополнительными аргументами).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PageConstructor = new (...args: any[]) => PageInstance;

/**
 * Внутренняя запись маршрута роутера: исходный паттерн, скомпилированная regexp,
 * имена параметров и класс страницы.
 */
export interface RouteDefinition {
    /** Исходный паттерн ('/notebook/:id') */
    pattern: string;
    /** Regexp с group'ами для параметров */
    regexp: RegExp;
    /** Имена параметров в порядке появления */
    paramNames: string[];
    /** Класс страницы для рендера */
    PageClass: PageConstructor;
}

/**
 * Результат matchRoute: класс страницы и извлечённые параметры.
 */
export interface RouteMatch {
    /** Класс страницы */
    PageClass: PageConstructor;
    /** Извлечённые параметры из URL */
    params: Record<string, string>;
}

/**
 * Конфиг шапки на главных страницах (Files, Profile).
 */
export interface GreenHeaderConfig {
    /** Данные текущего пользователя для меню */
    user?: UserData;
    /** Обработчик клика по "Профиль" */
    onProfile?: () => void;
    /** Обработчик клика по "Выйти" */
    onLogout?: () => void;
}

/**
 * Конфиг шапки страницы notebook'а — расширяет GreenHeaderConfig полем filename
 * и обработчиком переименования.
 */
export interface NotebookHeaderConfig {
    /** Имя текущего notebook'а */
    filename?: string;
    /** Данные пользователя */
    user?: UserData;
    /** Обработчик клика по карандашу */
    onRename?: () => void;
    /** Обработчик клика по "Профиль" */
    onProfile?: () => void;
    /** Обработчик клика по "Выйти" */
    onLogout?: () => void;
}

/**
 * Состояние FilesPage: список notebook'ов, текущая страница пагинации, лимит на страницу,
 * имя владельца (для отображения в колонке "Владелец" в нерасшаренных файлах).
 */
export interface FilesPageState {
    /** Загруженный набор notebook'ов */
    notebooks: Notebook[];
    /** Текущая страница (0-based) */
    currentPage: number;
    /** Размер страницы */
    limit: number;
    /** Логин владельца (для нерасшаренных файлов) */
    username: string;
}

/**
 * Активный набор фильтров на странице файлов. null означает "не фильтровать".
 */
export interface FilterSet {
    /** Имя владельца для фильтра (null — все) */
    owner: string | null;
    /** Дата начала диапазона в ISO-формате (null — не ограничено снизу) */
    dateFrom: string | null;
    /** Дата конца диапазона в ISO-формате (null — не ограничено сверху) */
    dateTo: string | null;
}

/**
 * Callback пагинации: вызывается с индексом новой страницы (0-based).
 */
export type PageChangeCallback = (targetPage: number) => void;

/**
 * Callback фильтра: вызывается с обновлённым набором фильтров.
 */
export type FilterChangeCallback = (filters: FilterSet) => void;

/**
 * Callback переименования: возвращает Promise — UI отображает loading до резолва.
 */
export type RenameCallback = (newTitle: string) => Promise<void>;

/**
 * Один комментарий к блоку. user_id используется для определения "своих"
 * комментариев (показ кнопки удаления). created_at — ISO-дата для форматирования.
 */
export interface Comment {
    /** ID комментария на сервере */
    id: number;
    /** ID автора */
    user_id: number;
    /** Логин автора (для отображения) */
    username: string;
    /** ID блока к которому привязан */
    block_id: number;
    /** Текст комментария */
    text: string;
    /** ISO-дата создания */
    created_at: string;
}
