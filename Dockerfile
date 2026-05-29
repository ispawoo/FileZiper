FROM node:20-bullseye-slim

# Hugging Face Spaces run as user 1000
RUN useradd -m -u 1000 user

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY --chown=user:user package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=user:user frontend/package.json frontend/
COPY --chown=user:user backend/package.json backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY --chown=user:user . .

# Create temp directories for backend zipping with proper permissions
RUN mkdir -p temp/uploads temp/zips frontend/out && chown -R user:user temp frontend/out

# Switch to non-root user
USER user

# Build the project
RUN pnpm run build

# Expose port for Hugging Face Spaces
EXPOSE 7860
ENV PORT=7860

# Start the unified server
CMD ["pnpm", "run", "start"]
