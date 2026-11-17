# Прототип Бухи

Выгрузка экранов из прототипа на холсте: https://claude.ai/artifact/9bBUvgJj2oW72evAS3j3e3 (версия 40, `1794920239-6bd0`, подогнана под бэк `main` на коммите `16e40ea`).

- `project/canvas.json` — расположение экранов на холсте и их подписи.
- `project/*.dc.html` — 21 экран:
  - сайт: Main, Pricing, Auth, Support;
  - кабинет: Onboarding → Eligibility → Brief → Generating → Gaps → Result → Passport, а также Budget, Billing, Files, Profile, States;
  - админка: Admin*;
  - дизайн-система: DesignSystem.

Файлы ссылаются на `support.js` среды прототипа. Его здесь нет, поэтому по отдельности в браузере они не запускаются. Это исходник для вёрстки: разметка, тексты, цвета и логика состояний (класс `Component` в конце каждого файла). ИИ-Консультант (кнопка и выезжающая панель) лежит внутри Gaps, Passport и Budget.

Пути пользователя описаны в [../docs/user-flows.md](../docs/user-flows.md). Расхождения макетов с бэком — в [../docs/design-vs-backend.md](../docs/design-vs-backend.md).
