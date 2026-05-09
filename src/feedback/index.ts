import { FeedbackPage } from './FeedbackPage.js';
import { nn } from '../shared/utils/notNull.js';

/**
 * Bootstrap отдельной страницы обратной связи (открывается в iframe из FeedbackModal).
 * Создаёт FeedbackPage в #feedback-root и сразу инициализирует postMessage-связь с родителем.
 */
const page = new FeedbackPage(nn(document.getElementById('feedback-root')));
page.init();
