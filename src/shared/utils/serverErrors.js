const ERROR_MAP = {
    'invalid request body': 'Некорректные данные',
    'email or username already exists': 'Email или имя пользователя уже заняты',
    'invalid credentials': 'Неверный email или пароль',
    'internal server error': 'Ошибка сервера, попробуйте позже',
    'invalid input: invalid email format': 'Почта введена некорректно'
};

export function translateError(error) {
    return ERROR_MAP[error] ?? 'Произошла ошибка, попробуйте позже';
}
