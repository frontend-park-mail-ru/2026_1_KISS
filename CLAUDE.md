# CLAUDE.md

Local instructions for Claude Code when working with the KISS Colab frontend.

## Project essence

**KISS Colab** is a collaborative Jupyter-like notebook platform built by team KISS as an academic project (defense in May 2026). Users sign up, create notebooks composed of code cells (executed in sandboxed Docker containers on the backend) and text cells, share notebooks with other users via permission grants, and exchange feedback. The platform also embeds an LLM chat (proxied to a local Ollama instance) for in-notebook assistance.

This repository (`front_2026_1_KISS/`) is the frontend SPA. It is one of three independent subprojects:

| Subproject | Stack | Repo |
|---|---|---|
| Frontend SPA (this repo) | Vanilla TypeScript, custom bundler, nginx | `front_2026_1_KISS/` |
| Backend | Go 1.26, gRPC microservices, PostgreSQL, Redis, Docker | `../go_2026_1_KISS/` |
| LLM proxy | Python 3.13, FastAPI, httpx, SQLite | `../python_server_for_llm_chat/` |

Production: **https://colkiss.ru** (server `212.233.96.54`, frontend served from `/home/ubuntu/front/2026_1_KISS`). Auto-deploys from the `develop` branch via GitHub Actions.

The frontend talks to the Go HTTP-Gateway on `:8080` under `/api/v1/...` (gateway translates HTTP to gRPC and dispatches to Auth/Notebook/Runner/Storage services). Auth flow uses cookies + a CSRF token, automatically read from cookies by `HttpClient`.

## Project overview

**KISS Colab Frontend** — a Single Page Application (SPA) for the collaborative Jupyter-like notebook platform.

- **Stack**: Vanilla TypeScript (no UI libraries), a custom Node.js bundler, a custom SCSS transpiler, nginx in production.
- **Hard constraint**: NO runtime libraries are allowed (see `description` in `package.json`). Only devDependencies for build/lint/types.
- **Node**: v22.21.0 (see `.nvmrc`).
- **TypeScript**: strict mode, ES2022 target, output to `.ts-out/` (then bundled into `dist/`).

## Structure

```
front_2026_1_KISS/
├── src/
│   ├── app/              # SPA entry point, global styles, index.html
│   ├── pages/            # Page-level components: landing, sign, files, blocks, profile, admin
│   ├── widgets/          # Composite UI blocks: CellList, FilesTable, NotebookHeader, ShareModal, etc.
│   ├── shared/
│   │   ├── api/          # HTTP clients (HttpClient, NotebookApi, RunnerApi, AdminApi, ...)
│   │   ├── components/   # Base reusable components (BaseComponent, CodeCell, Input, ...)
│   │   ├── router/       # SPA router built on the History API
│   │   ├── utils/        # Utilities (escapeHtml, ansiToHtml, notNull/nn, ...)
│   │   └── types.ts      # Shared types
│   ├── feedback/         # Standalone feedback page (iframe)
│   └── sw.js             # Service worker
├── build/                # Custom build scripts (bundler, scss-transpiler, dev-server, css-concat)
├── public/               # Static assets (favicon, fonts, images), copied into dist
├── nginx/                # Production nginx config
├── .github/workflows/    # CI: lint.yml + deploy.yml
├── eslint.config.mjs     # ESLint config — DO NOT EDIT (see rules below)
├── tsconfig.json         # TS strict mode, ES2022 target
└── .prettierrc.js        # Prettier config
```

## Architectural conventions

- **Components** inherit from `BaseComponent` (lifecycle: `mount`/`unmount`, automatic listener cleanup).
- **Singletons** via a static `getInstance()`: `HttpClient`, `Router`, `Heartbeat`.
- **Templates** live in `*.template.ts` files next to the component and return an HTML string.
- **Styles** live in separate `*.scss` files next to the component, imported into `src/app/index.scss`.
- **Private fields** use `#privateField` (native TS/JS), not the TS `private` modifier (although the latter still appears in some places).
- **API clients** call `await response.json()` and return `Record<string, unknown>` — response types are currently NOT described in code (this is tech debt).

## Commands

```bash
npm run dev            # Dev server on :3000, proxies /api → :8080 (Go backend)
npm run build          # tsc → bundler → css-concat into dist/
npm run typecheck      # tsc --noEmit
npm run lint           # eslint . --max-warnings 0
npm run lint:fix       # eslint --fix
npm run format         # prettier --write
npm run format:check   # prettier --check (used in CI)
```

Local CI (requires Docker Desktop):
```bash
act pull_request --container-architecture linux/amd64 -j lint
```

## Relations to other parts of the project

- **Go backend**: `../go_2026_1_KISS/` — gRPC microservices behind an HTTP-Gateway on `:8080`. Endpoints under `/api/v1/...`. Auto-deploys from the `develop` branch.
- **Python LLM proxy**: `../python_server_for_llm_chat/` — Ollama proxy for the LLM chat. FastAPI, separate service.
- **Production**: `colkiss.ru`, server `212.233.96.54`, frontend in `/home/ubuntu/front/2026_1_KISS`.

Auth flow: cookies + CSRF token (read automatically from a cookie by `HttpClient`).

---

# RULES FOR WORKING IN THIS PROJECT

## Rule #1 (CRITICAL): do not change linter and formatter configs

**FORBIDDEN** to edit without an explicit, separate request from the user:
- `eslint.config.mjs` — ESLint config
- `.prettierrc.js` — Prettier config
- `tsconfig.json` — TypeScript config
- `package.json` `scripts` section (especially the `--max-warnings 0` flag)

**Why this matters**: rules in `eslint.config.mjs` are intentionally strict (`tseslint.configs.strictTypeChecked` + `js.configs.all`). Any relaxation of rules, options (`allowNumber`, `allow: [...]`, etc.) or disabling (`'off'`) is a **hidden quality regression** that is invisible in commit diffs. Lint must report the **truth** about the state of the code.

**What to do instead**:
- If a rule fires on obviously valid code → fix the CODE, not the rule.
- If a mechanical fix is impossible → add a **targeted** `// eslint-disable-next-line <rule> -- <reason>` with an explicit justification comment. Never block-disable, never file-level disable.
- If a rule fires en masse on something systemic (dozens/hundreds of places) → DO NOT touch the config yourself; ask the user how to proceed.

If a rule looks wrong — first **ask the user**, give examples, discuss, and only then change anything.

## Rule #2: code comments — only when justified

Do not write comments in the code unless the user explicitly asks. Do not leave traces like `// added X`, `// removed Y`, `// for Z task`. A good variable/function name beats a comment.

**Exception**: JSDoc blocks on methods/functions/classes are not "code comments" but **mandatory API documentation** (see Rule #7 below). They are checked by the linter and are part of the contract.

## Rule #2.1: `.js` files are forbidden under `src/`

All sources under `src/` must be `.ts`. If you are tempted to drop a `.js` file (for example for the Service Worker) — use `.ts` with appropriate types instead. The Service Worker is already done correctly: `src/sw.ts` uses a triple-slash reference to the webworker lib + a local `declare const self: ServiceWorkerGlobalScope` to avoid clashing with the DOM types in the rest of the code. See `src/sw.ts` as a reference.

`build/` scripts may remain `.js` (Node build code, not frontend code).

## Rule #3: no emojis

No emojis in code, commits, or responses. (User's global rule.)

## Rule #4: Conventional Commits in English

Format: `type(scope): description`.
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Frontend scopes**: `auth`, `ui`, `api`, `core`, `config`, `deps`, `tests`, `build`
- One logical fix = one commit.

## Rule #5: DOM/HTML safety

- Any user input that ends up in `innerHTML` must be passed through `escapeHtml()` (`src/shared/utils/escapeHtml.ts`).
- Do not use `eval`, `Function()`, or inline handlers (`onclick="..."` in template strings).
- The `nn()` helper (`src/shared/utils/notNull.ts`) is a runtime check used in place of `!`. It is used throughout the project.

## Rule #6: centralized error logging

- Any `console.error` (e.g. inside catch blocks) must go through `logError()` from `src/shared/utils/logger.ts` — it has a single targeted `eslint-disable` for `no-console` with a justification. Do not scatter new `// eslint-disable-next-line no-console` comments across the code.

## Rule #7: JSDoc is mandatory on every method and function

This is an academic-defense (РК) requirement, defense in May 2026. Enforced via `eslint-plugin-jsdoc` (see the `jsdocRules` block in `eslint.config.mjs`). Lint will fail with `jsdoc/require-jsdoc` if a new method/class/function/interface/type-alias is added without documentation.

**What must be documented**:
- All class methods (public/private/protected, including `#privateField` methods)
- All constructors (`public constructor(...)`)
- All getters/setters
- All exported functions (`export function`)
- All interfaces and type aliases
- All arrow functions in a `PropertyDefinition` (class fields with arrow values)

**What is NOT required** (disabled in the config): inline arrows inside methods, FunctionExpression callbacks (documenting the containing method is sufficient).

**JSDoc style**:
```ts
/**
 * Brief description (one sentence — what it does and why).
 * Optionally — a second paragraph with invariants/side effects.
 * @param userId - the user id to load
 * @param options - request options
 * @returns a promise with the user
 * @throws Error if the server returns a non-2xx response
 */
public async loadUser(userId: string, options?: RequestOptions): Promise<UserDTO> { ... }
```

**Formatting rules**:
- Descriptions are written **in Russian**, while identifiers and parameter names stay **in English**.
- **No types in JSDoc** (`{string}`, `{number}` are forbidden — TypeScript already supplies the types; the rule `jsdoc/no-types: error` enforces this).
- `@param name - description` (with a hyphen separator).
- Omit `@returns` for `void` and `Promise<void>`.
- Use `@throws` only when the body has an explicit `throw` or calls code that throws (for example `nn()` throws on null).
- For **constructors** — keep it short: what is initialized, what dependencies it takes.
- For **template functions** (`*.template.ts`) — a single JSDoc on the lone export, describing what it renders.
- For **getters/setters** — describe the property, not "returns X".
- Interface fields are documented inline with `/** ... */` blocks above each field.

**Destructured parameters**: for constructors of the form `constructor(parent, { a, b }: Options)` it is enough to write `@param parent` + `@param options`. Fields inside Options are documented in the interface itself. This behavior is set via `checkDestructured: false` in the config.

**Reference files to imitate**:
- `src/shared/components/base-component/BaseComponent.ts` — base class with lifecycle JSDoc
- `src/shared/http_client/HttpClient.ts` — singleton with description of the CSRF/cache flow
- `src/shared/api/types.ts` — DTO interfaces with inline field documentation
- `src/shared/api/NotebookApi.ts` — API client with a description of every endpoint

**Phased rollout**: the rule applies to files listed in `jsdocRequiredFiles` in `eslint.config.mjs`. At the time of this note, `src/sw.ts`, `src/shared/**`, `src/app/**` are covered. Expansion to `src/widgets/**` and `src/pages/**` is happening in phases — when JSDoc is added to a group of files, the glob must be widened accordingly.

---

# HOW TO HANDLE LINTER ERRORS

## 1. Errors from strict TypeScript rules — fix locally

`@typescript-eslint/explicit-member-accessibility` → add `public`/`private`/`protected`.
`@typescript-eslint/explicit-function-return-type` → add `: void`/`: Promise<void>`/the concrete type.
`@typescript-eslint/no-non-null-assertion` (`x!`) → replace with `nn(x)` from `src/shared/utils/notNull.ts`.
`@typescript-eslint/prefer-nullish-coalescing` (`a || b`) → replace with `a ?? b` (when semantics allow).
`@typescript-eslint/no-unnecessary-condition` → remove the obviously truthy/falsy check.
`no-console` → delete debug `console.log`. For `console.error` in catch blocks use `// eslint-disable-next-line no-console -- error logging` with a justification.

## 2. Errors caused by backend responses (`no-unsafe-*` group)

These appear because `await response.json()` returns `any`, and then `.field` access propagates `any` through everything.

**What you should NOT do**: silence with `// eslint-disable` en masse or disable the rule in the config.

**What to do**:

1. **Find the matching type in the Go backend** under `../go_2026_1_KISS/`:
   - gRPC messages: `api/proto/{auth,notebook,runner,storage,issue,notification}/*.proto`
   - HTTP handlers (request/response structs): `internal/{service}/grpc/server.go` or `internal/gateway/...`
   - Domain models: `internal/{service}/domain/`

2. **Create a TS interface** in `src/shared/types.ts` (or a new file `src/shared/api/types/<service>.ts`) reflecting the JSON response fields. Keep backend snake_case as is (e.g. `user_id: number`).

3. **Type the call** when parsing the response:
   ```ts
   const { data } = (await response.json()) as { data: User };
   ```
   After this, all `.field` accesses become safe.

4. **If fields are unclear / not described on the backend** → ask the user for the contract (or go into `../go_2026_1_KISS/` and read the .proto/handler yourself, then ask the user: "I found this structure in the backend, does it match?").

## 3. Errors from external DOM APIs (`Element` vs `HTMLInputElement`, etc.)

`querySelector('.foo')` returns `Element | null`, which has no `.value`/`.dataset`/`.style`, etc.

**Fix**: use the generic parameter `querySelector<HTMLInputElement>('.foo')`, or cast with `as HTMLInputElement` at the selection site. Do not propagate the problem further down the code.

## 4. Errors from code-style rules (`no-shadow`, `no-multi-assign`, `radix`, `default-case`)

Purely mechanical — rename, split, add `, 10`, add `default: break;`. No need to discuss with the user.

## 5. `require-atomic-updates` errors after await

Often a false positive for DOM assignments (the UI is single-threaded). A targeted `// eslint-disable-next-line require-atomic-updates -- DOM single-threaded` with a comment is acceptable. If it really is an async race — rewrite using locally captured variables.

## 6. `no-floating-promises` / `no-misused-promises` errors

- `no-floating-promises` → add `void ` before the expression (`void this.#refresh();`) or `.catch(...)`.
- `no-misused-promises` for event handlers → wrap: `addEventListener('click', () => { void this.#asyncHandler(); })`.

## 7. If the fix is impossible or sweeping — DO NOT decide on your own

Tell the user: "I see N errors of rule X. Possible approaches: [A, B, C]. Which one do we pick?" — and **wait for the answer**. Do not touch the config and do not silence en masse.

---

# Current lint status (as of this note)

After my refactor the codebase still has **553 errors** under full strictness. They group into the following categories (see `npm run lint`):

| Group | Count | Nature |
|---|---|---|
| `no-unsafe-*` (5 rules) | ~236 | Tech debt of typing API responses (see point 2 above) |
| `restrict-template-expressions` (`number`) | ~109 | Stylistic: number inside `${expr}` |
| `strict-boolean-expressions` | ~75 | `if (str)` / `if (n)` without explicit comparison |
| `explicit-function-return-type` (inline arrows) | ~50 | `() => expr` without an explicit return type |
| `no-alert` | ~16 | `confirm()`/`alert()` in the admin area |
| `no-console` | ~12 | `console.error()` inside catch blocks |
| Other | <55 | One-off |

Each category should be discussed separately with the user — which to fix by hand, which require backend-side typing, which to accept as correct and silence in a targeted way.
