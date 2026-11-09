FROM node:22-slim

WORKDIR /srv
# Монорепо: нужны корневые манифесты и workspaces для резолва @passport/*
COPY package.json package-lock.json ./
COPY packages ./packages
COPY backend/pipeline-api ./backend/pipeline-api
COPY backend/supabase ./backend/supabase
COPY backend/kb ./backend/kb
RUN npm ci --workspace @passport/pipeline-api --include-workspace-root=false

WORKDIR /srv/backend/pipeline-api
EXPOSE 8080
CMD ["npx", "tsx", "src/main.ts"]
