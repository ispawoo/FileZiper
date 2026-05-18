# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install package manager
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY eslint.config.mjs postcss.config.mjs next-env.d.ts next.config.ts ./

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

RUN pnpm build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
