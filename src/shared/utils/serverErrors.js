const ERROR_MAP = {
    'invalid request body': 'Некорректные данные',
    'email or username already exists': 'Email или имя пользователя уже заняты',
    'invalid credentials': 'Неверный email или пароль',
    'internal server error': 'Ошибка сервера, попробуйте позже'
};

export function translateError(error) {
    return ERROR_MAP[error] ?? 'Произошла ошибка, попробуйте позже';
}
