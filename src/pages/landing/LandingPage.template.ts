/**
 * Рендерит главную (landing) страницу для гостей: hero-секция с CTA-кнопкой,
 * блок features из 3 карточек. Полностью статична — без интерактивности кроме
 * единственной кнопки "Создать блокнот".
 * @returns HTML-разметка для innerHTML
 */
export function LandingPageTemplate(): string {
    return `<div class="landing-page">
    <main class="landing-page__main">
        <section class="landing-page__hero">
            <h1 class="landing-page__title">Kisscolab: Простые блокноты для кода в один клик</h1>
            <blockquote class="landing-page__quote">
                Онлайн-среда для data science, машинного обучения и экспериментов с кодом.
                Делитесь проектами так же легко, как отправляете ссылку.
            </blockquote>
            <button class="landing-page__cta" data-action="create-notebook">Создать блокнот</button>
        </section>

        <section class="landing-page__features">
            <h2 class="landing-page__features-title">Все, что нужно для работы с данными, прямо в браузере</h2>
            <div class="landing-page__features-grid">
                <div class="landing-page__feature-card">
                    <h3 class="landing-page__feature-heading">Ноль настроек:</h3>
                    <p class="landing-page__feature-text">Никаких установок Python и библиотек. Просто открой браузер.</p>
                </div>
                <div class="landing-page__feature-card">
                    <h3 class="landing-page__feature-heading">AI-ассистент в каждом блокноте:</h3>
                    <p class="landing-page__feature-text">Запускай код, а если что-то пошло не так, то просто спроси AI.</p>
                </div>
                <div class="landing-page__feature-card">
                    <h3 class="landing-page__feature-heading">Простой шэринг:</h3>
                    <p class="landing-page__feature-text">Отправил ссылку и коллега открыл твой код. Идеально для обучения и команд.</p>
                </div>
            </div>
        </section>
    </main>
</div>`;
}
