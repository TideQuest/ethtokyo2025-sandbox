# syntax=docker/dockerfile:1

FROM node:20-slim

WORKDIR /usr/src/app

# Install OpenSSL for Prisma and git for @reclaimprotocol/tls
RUN apt-get update -y && apt-get install -y openssl git && rm -rf /var/lib/apt/lists/*

# Enable corepack and set pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc* ./

RUN pnpm install --frozen-lockfile=false

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=development

CMD ["./entrypoint.sh"]

