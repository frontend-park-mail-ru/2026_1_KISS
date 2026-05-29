# KISS Colab — Frontend

Фронтенд платформы коллаборативных Jupyter-подобных блокнотов команды **KISS**.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Zero deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)](package.json)
[![SCSS](https://img.shields.io/badge/SCSS-CC6699?logo=sass&logoColor=white)](https://sass-lang.com)
[![nginx](https://img.shields.io/badge/nginx-009639?logo=nginx&logoColor=white)](https://nginx.org)
[![ESLint](https://img.shields.io/badge/ESLint-strict-4B32C3?logo=eslint&logoColor=white)](https://eslint.org)
[![Prettier](https://img.shields.io/badge/code_style-Prettier-F7B93E?logo=prettier&logoColor=white)](https://prettier.io)

**Прод:** https://colkiss.ru

## О проекте

SPA на чистом TypeScript **без единой рантайм-зависимости** — никаких фреймворков и UI-библиотек, всё своё:

- **Своя компонентная система** — `BaseComponent` с жизненным циклом (mount/unmount) и авто-очисткой обработчиков
- **Свой роутер** — singleton SPA-роутер на History API с параметрами (`:id`)
- **Свой HTTP-клиент** — обёртка над `fetch`, базовый путь `/api/v1`, авто-CSRF из cookie
- **Свой сборщик** — bundler + SCSS-транспайлер + конкатенация CSS на Node.js

## Стек

TypeScript (strict, ES2022) · нативные fetch / History API · SCSS · кастомный Node.js-бандлер · nginx · zero dependencies

## Структура

```
src/
├── app/       # точка входа, глобальные стили, index.html
├── pages/     # страницы (landing, sign, files, blocks, profile, admin)
├── widgets/   # композитные блоки (CellList, FilesTable, NotebookHeader, ShareModal, ...)
├── shared/    # переиспользуемое: api-клиенты, компоненты, роутер, утилиты, типы
└── feedback/  # отдельная страница обратной связи
```

## Запуск

Node `v22.21.0` (см. `.nvmrc`).

```bash
npm ci
npm run dev      # dev-сервер :3000, проксирует /api и /uploads на бэкенд :8080
npm run build    # tsc → бандл JS + сборка CSS в dist/
```

Прод: nginx раздаёт статику и проксирует `/api/` и `/uploads/` на Go-бэкенд.

## Качество кода

На каждый PR в CI гоняются три гейта, и любой из них падает при первой же ошибке или варнинге:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, --max-warnings 0 (strictTypeChecked + js/all)
npm run format:check   # Prettier
```

ESLint настроен максимально строго (`tseslint.configs.strictTypeChecked` + `js.configs.all`), а JSDoc на публичном API обязателен и проверяется линтером.

Подключать любые рантайм-библиотеки запрещено — это жёсткое ограничение проекта (см. `description` в `package.json`).

## Лицензия

ISC
