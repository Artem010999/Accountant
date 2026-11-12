# Фронтенд «Буха» — каркас (G0)

Vite 5 + React 18 + TypeScript, react-router-dom 6, Supabase JS. Стили — CSS-файлы с токенами, без Tailwind и UI-библиотек.
Источник правды по визуалу и текстам — `design/project/*.dc.html`, карта экранов — `docs/user-flows.md` §1, гейты — `docs/quality-gates.md`.

## Запуск

Из корня репозитория:

```
npm install
npm run dev -w @passport/frontend        # http://localhost:5173
```

В Claude Code то же самое поднимает `preview_start` с именем `frontend` (конфигурация в `.claude/launch.json`).

## Тесты и проверки

```
npm test                                  # из корня: pipeline-api, passport-core и фронтенд (vitest.workspace.ts)
npm run typecheck                         # из корня
npm run build -w @passport/frontend       # tsc + vite build
npx vitest run --root frontend            # только фронтенд
```

Тесты лежат рядом с кодом (`Имя.test.tsx`). Окружение — jsdom, setup-файл `src/test/setup.ts` (jest-dom, очистка DOM).
Тест `src/app/routes.test.tsx` проверяет, что каждый маршрут открывается с заголовком из дизайна и без ошибок в консоли.

## Сверка с дизайном (порядок)

1. Поднять статический сервер эталона: `cd design/project && py -m http.server 8001 --bind 127.0.0.1` (в фоне). Эталон: `http://127.0.0.1:8001/<Имя>.dc.html`.
2. Поднять dev-сервер фронта (см. выше).
3. Снять скриншоты при ширине 1440 px: эталон и наш маршрут. Имена: `frontend/.visual/<этап>-<экран>-{ref,ours}.png`. Папка `frontend/.visual/` в `.gitignore`.
4. Сравнить по критерию V1 из `docs/quality-gates.md`, расхождения списком «элемент — эталон — наше — файл».
5. Текстовая сверка (V2): строки из `*.dc.html` должны присутствовать дословно в отрендеренной странице.

Пример для G0 (headless Edge, файлы сохраняются на диск):
```
msedge --headless=new --window-size=1440,2370 --virtual-time-budget=15000 --screenshot=frontend/.visual/G0-design-system-ours.png http://localhost:5173/design-system
```

## Карта маршрут → экран → эталон

| Маршрут | Файл экрана | Эталон | Оболочка | Группа |
|---|---|---|---|---|
| `/` | `features/site/Main.tsx` | `Main.dc.html` | — | site (G1) |
| `/pricing` | `features/site/Pricing.tsx` | `Pricing.dc.html` | — | site (G1) |
| `/auth` | `features/site/Auth.tsx` | `Auth.dc.html` | — | site (G1) |
| `/onboarding` | `features/onboarding/Onboarding.tsx` | `Onboarding.dc.html` | — | onboarding (G2) |
| `/brief` | `features/onboarding/Brief.tsx` | `Brief.dc.html` | — | onboarding (G2) |
| `/generating` | `features/onboarding/Generating.tsx` | `Generating.dc.html` | — | onboarding (G2) |
| `/gaps` | `features/passport/Gaps.tsx` | `Gaps.dc.html` | кабинет | passport (G2) |
| `/result` | `features/passport/Result.tsx` | `Result.dc.html` | кабинет | passport (G2) |
| `/passport` | `features/passport/Passport.tsx` | `Passport.dc.html` | кабинет | passport (G2) |
| `/files` | `features/account/Files.tsx` | `Files.dc.html` | кабинет | account (G3) |
| `/billing` | `features/account/Billing.tsx` | `Billing.dc.html` | кабинет | account (G3) |
| `/profile` | `features/account/Profile.tsx` | `Profile.dc.html` | кабинет | account (G3) |
| `/states` | `features/account/States.tsx` | `States.dc.html` | — | account (G3) |
| `/admin/users` | `features/admin/AdminUsers.tsx` | `AdminUsers.dc.html` | админка | admin (G4) |
| `/admin/billing` | `features/admin/AdminBilling.tsx` | `AdminBilling.dc.html` | админка | admin (G4) |
| `/admin/guard` | `features/admin/AdminGuard.tsx` | `AdminGuard.dc.html` | админка | admin (G4) |
| `/admin/kb` | `features/admin/AdminKB.tsx` | `AdminKB.dc.html` | админка | admin (G4) |
| `/design-system` | `features/design-system/DesignSystem.tsx` | `DesignSystem.dc.html` | — | служебная |

Все экраны, кроме `DesignSystem`, на G0 — заглушки: заголовок h1 из эталона и `ScreenStub`. Таблица маршрутов: `src/app/routes.tsx` (`APP_ROUTES`). Оболочки: `src/shared/layout/CabinetLayout.tsx` (меню: Паспорт · Пробелы · Итог · Материалы · Тариф · Профиль) и `AdminLayout.tsx` (Пользователи · Платежи и тарифы · Страж · База знаний).

## Структура

```
src/
  app/              App.tsx, routes.tsx (карта маршрутов), routes.test.tsx
  shared/
    styles/         tokens.css (все цвета, радиусы, шрифты, размеры), global.css (базовые стили, типографика)
    ui/             общий UI-кит: Logo, Button, StatusPill, ClaimMark, TextField, Card, TextLink, SideNav, NavIcon, ScreenStub
    layout/         CabinetLayout, AdminLayout
    api/            pipeline.ts, supabase.ts (не менялись на G0)
    config/env.ts   переменные окружения
  features/<группа>/<Экран>.tsx | .css | .test.tsx
  test/setup.ts     настройка vitest
```

## Правила владения файлами

- Группа работает только в `src/features/<группа>/`: экран, его `.css` и `.test.tsx`. Ничего сверх экранов в `features/` не добавлять.
- `src/shared/styles/*`, `src/shared/ui/*`, `src/shared/layout/*`, `src/app/*` меняются только на G0 или отдельным согласованным изменением, которое фиксируется в отчёте этапа.
- Новый цвет, радиус или размер в компоненте — ошибка: сначала токен в `tokens.css`.
- Классы CSS — с префиксом по компоненту (`btn--`, `pill--`, `claim--`, `field__`, `sidenav__`, `ds__`).
- `backend/`, `packages/`, `design/` — не редактировать в рамках фронтенд-работ.
- Не использовать Tailwind и UI-библиотеки (MUI и т.п.), не делать снимки DOM как замену проверке дизайна.
