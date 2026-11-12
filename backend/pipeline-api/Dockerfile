FROM node:22-slim

WORKDIR /srv

# Манифесты всех workspace нужны для npm ci (lock-файл охватывает всё монорепо).
COPY package.json package-lock.json ./
COPY packages ./packages
COPY backend/pipeline-api/package.json ./backend/pipeline-api/
COPY frontend/package.json ./frontend/
RUN npm ci

# Исходники пайплайна и данные, которые он читает с диска:
# supabase/ — миграции и seed, kb/ — манифест программы.
COPY backend/pipeline-api ./backend/pipeline-api
COPY backend/supabase ./backend/supabase
COPY backend/kb ./backend/kb

WORKDIR /srv/backend/pipeline-api
EXPOSE 8080
CMD ["npx", "tsx", "src/main.ts"]
