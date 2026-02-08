FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat argon2 bash python3 make vips vips-dev binutils gcc g++ fftw-dev tzdata
ENV TZ=Europe/Paris

RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build
RUN pnpm install --prod --offline

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat argon2 bash python3 make vips vips-dev binutils gcc g++ fftw-dev tzdata
ENV TZ=Europe/Paris

RUN npm install -g pnpm
WORKDIR /app

ENV NODE_ENV production

COPY mikro-orm.config.ts package.json nest-cli.json certificate.crt tsconfig.json ./
COPY /src/adapters/for-production/database/migrations ./src/adapters/for-production/database/migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD pnpm orm:up && pnpm start:prod
