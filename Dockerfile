FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY src ./src
COPY config.docker.yaml ./config.yaml
COPY docker-entrypoint.sh ./docker-entrypoint.sh

USER root

ENTRYPOINT ["/app/docker-entrypoint.sh"]
