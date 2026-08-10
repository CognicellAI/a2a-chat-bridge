FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
RUN bun build ./src/index.ts --target=node --outfile dist/index.js

FROM node:22-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh

USER root

ENTRYPOINT ["/app/docker-entrypoint.sh"]
