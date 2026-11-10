# Прототип Бухи

Выгрузка экранов из прототипа на холсте: https://claude.ai/artifact/9bBUvgJj2oW72evAS3j3e3

- `project/canvas.json` — расположение экранов на холсте и их подписи.
- `project/*.dc.html` — 18 экранов: сайт (Main, Pricing, Auth), кабинет (Onboarding → Brief → Generating → Gaps → Result → Passport, а также Billing, Files, Profile, States), админка (Admin*) и дизайн-система (DesignSystem).

Файлы ссылаются на `support.js` среды прототипа, его здесь нет, поэтому по отдельности в браузере они не запускаются. Это исходник для вёрстки: разметка, тексты, цвета и логика состояний (класс `Component` в конце каждого файла). Пути пользователя описаны в [../docs/user-flows.md](../docs/user-flows.md).
