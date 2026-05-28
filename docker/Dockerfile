# Stage 1: Build frontend
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/
COPY client/src client/src
COPY client/public client/public
RUN npm ci --workspace=client && npm run build -w client

# Stage 2: Build backend
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json server/tsconfig.json server/
COPY server/src server/src
RUN npm ci --workspace=server && npm run build -w server

# Stage 3: Production runtime
FROM node:22-alpine
WORKDIR /app

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=client-builder /app/client/dist ./client/dist

COPY server/prompts ./server/prompts
COPY user ./user
COPY .env.example ./.env

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]
