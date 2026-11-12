# Сборка фронтенда и отдача статики через nginx. Контекст сборки — корень репозитория.
FROM node:22-slim AS build

WORKDIR /srv
COPY package.json package-lock.json ./
COPY packages ./packages
COPY backend/pipeline-api/package.json ./backend/pipeline-api/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY frontend ./frontend

# Адреса API задаются при сборке: в продакшене — относительные (одна origin через nginx).
ARG VITE_PIPELINE_URL=/pipeline
ARG VITE_SUPPORT_ENDPOINT=/support
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_PIPELINE_URL=$VITE_PIPELINE_URL \
    VITE_SUPPORT_ENDPOINT=$VITE_SUPPORT_ENDPOINT \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build -w @passport/frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/frontend/dist /usr/share/nginx/html
EXPOSE 80
