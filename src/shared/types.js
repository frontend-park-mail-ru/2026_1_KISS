/**
 * @module shared/types
 *
 * Общие типы проекта KISS Colab.
 * Файл не содержит runtime-кода -- только JSDoc-определения
 * для переиспользования через import('...').
 */

/**
 * @typedef {Object} BlockData
 * @property {string} id -- идентификатор блока
 * @property {string} type -- тип блока ('code' | 'text')
 * @property {string} content -- текстовое содержимое блока
 */

/**
 * @typedef {Object} Notebook
 * @property {string} id -- идентификатор ноутбука
 * @property {string} title -- название ноутбука
 * @property {string} updated_at -- ISO-дата последнего обновления
 * @property {string} [owner_username] -- имя владельца (только для расшаренных ноутбуков)
 * @property {BlockData[]} [blocks] -- список блоков (может отсутствовать в списочном API)
 */

/**
 * @typedef {Object} UserData
 * @property {string} username -- имя пользователя
 * @property {string} [email] -- email (присутствует не во всех ответах)
 */

/**
 * @typedef {Object} InputConfig
 * @property {string} type -- тип HTML-input ('text' | 'password' | 'email')
 * @property {string} id -- уникальный id элемента
 * @property {string} placeholder -- placeholder текст
 * @property {boolean} required -- обязательность заполнения
 * @property {?string} pattern -- regexp-паттерн для валидации
 * @property {string} error_by_pattern -- сообщение при несовпадении с паттерном
 * @property {?number} minlength -- минимальная длина
 * @property {?number} maxlength -- максимальная длина
 */

/**
 * @typedef {Object} InputState
 * @property {boolean} isValid -- текущий статус валидации
 * @property {string} value -- текущее значение поля
 */

/**
 * @typedef {Object} KebabAction
 * @property {string} name -- идентификатор действия (data-action)
 * @property {string} label -- отображаемый текст пункта меню
 * @property {Function} handler -- обработчик клика по пункту меню
 */

/**
 * @typedef {Object} EventListenerRecord
 * @property {EventTarget} element -- DOM-элемент подписки
 * @property {string} event -- название события
 * @property {Function} handler -- обработчик (уже привязанный через bind)
 */

/**
 * @typedef {Object} RouteDefinition
 * @property {string} pattern -- исходный паттерн маршрута (например '/notebooks/:id')
 * @property {RegExp} regexp -- скомпилированное регулярное выражение
 * @property {string[]} paramNames -- имена параметров из паттерна
 * @property {Function} PageClass -- конструктор страницы
 */

/**
 * @typedef {Object} RouteMatch
 * @property {Function} PageClass -- конструктор совпавшей страницы
 * @property {Object<string, string>} params -- извлечённые параметры маршрута
 */

/**
 * @typedef {Object} GreenHeaderConfig
 * @property {UserData} [user] -- данные пользователя (если авторизован)
 * @property {Function} [onProfile] -- обработчик клика "Профиль"
 * @property {Function} [onLogout] -- обработчик клика "Выход"
 */

/**
 * @typedef {Object} NotebookHeaderConfig
 * @property {string} [filename] -- название ноутбука
 * @property {UserData} [user] -- данные пользователя
 * @property {Function} [onRename] -- обработчик переименования
 * @property {Function} [onProfile] -- обработчик клика "Профиль"
 * @property {Function} [onLogout] -- обработчик клика "Выход"
 */

/**
 * @typedef {Object} FilesPageState
 * @property {Notebook[]} notebooks -- текущая страница ноутбуков
 * @property {number} currentPage -- номер текущей страницы (1-based)
 * @property {number} limit -- количество элементов на странице
 * @property {string} username -- имя текущего пользователя
 */

/**
 * @typedef {Object} FilterSet
 * @property {?string} owner -- фильтр по владельцу
 * @property {?string} dateFrom -- ISO-дата начала диапазона
 * @property {?string} dateTo -- ISO-дата конца диапазона
 */

/**
 * @callback PageChangeCallback
 * @param {number} targetPage -- номер страницы (0-based)
 */

/**
 * @callback FilterChangeCallback
 * @param {FilterSet} filters -- набор изменённых фильтров
 */

/**
 * @callback RenameCallback
 * @param {string} newTitle -- новое название
 * @returns {Promise<void>}
 */
