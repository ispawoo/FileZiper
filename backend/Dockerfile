# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install package manager (npm is already installed)

COPY package.json ./

RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production Stage
FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

# Create folders for temporary uploads and zips
RUN mkdir -p temp/uploads temp/zips

EXPOSE 7860

ENV NODE_ENV=production
ENV PORT=7860

CMD ["node", "dist/index.js"]
