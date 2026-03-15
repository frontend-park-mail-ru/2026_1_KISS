/**
 * @module shared/utils/serverErrors
 *
 * Локализация ошибок API -- маппинг английских сообщений сервера
 * на русскоязычные строки для отображения в UI.
 */

/** @type {Object<string, string>} */
const ERROR_MAP = {
    'invalid request body': 'Некорректные данные',
    'email or username already exists': 'Email или имя пользователя уже заняты',
    'invalid credentials': 'Неверный email или пароль',
    'internal server error': 'Ошибка сервера, попробуйте позже',
    'invalid input: invalid email format': 'Почта введена некорректно',
    'invalid input: file too large': 'Файл слишком большой (максимум 5 МБ)',
    'invalid input: invalid file type': 'Неподдерживаемый формат файла',
    'invalid input: status must not exceed 100 characters':
        'Статус не должен превышать 100 символов',
    'invalid input: description must not exceed 500 characters':
        'Описание не должно превышать 500 символов',
    'invalid input: password must be at least 8 characters':
        'Пароль должен быть не менее 8 символов'
};

/**
 * Переводит сообщение об ошибке сервера на русский.
 * Если перевод не найден -- возвращает дефолтное "Произошла ошибка, попробуйте позже".
 *
 * @param {string} error -- английское сообщение от API
 * @returns {string} локализованная строка ошибки
 */
export function translateError(error) {
    return ERROR_MAP[error] ?? 'Произошла ошибка, попробуйте позже';
}
