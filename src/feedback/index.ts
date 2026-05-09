import { FeedbackPage } from './FeedbackPage.js';
import { nn } from '../shared/utils/notNull.js';

const page = new FeedbackPage(nn(document.getElementById('feedback-root')));
page.init();
