FROM node:22-bullseye-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=node:node frontend/package.json frontend/
COPY --chown=node:node backend/package.json backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY --chown=node:node . .

# Create temp directories for backend zipping with proper permissions
RUN mkdir -p temp/uploads temp/zips frontend/out && chown -R node:node temp frontend/out

# Switch to non-root user (node user is already UID 1000)
USER node

# Build the project
RUN pnpm run build

# Expose port for Hugging Face Spaces
EXPOSE 7860
ENV PORT=7860

# Start the unified server
CMD ["pnpm", "run", "start"]
