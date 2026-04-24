# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /build

# Install dependencies first for better layer caching
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/cli/package.json ./packages/cli/
COPY packages/server/package.json ./packages/server/
COPY packages/ui/package.json ./packages/ui/
RUN npm install --no-audit --no-fund

# Copy sources
COPY packages/ ./packages/
COPY examples/ ./examples/

# Build each package
RUN cd packages/core && npx tsc -p tsconfig.json
RUN cd packages/cli && npx tsc -p tsconfig.json
RUN cd packages/server && npx tsc -p tsconfig.json
RUN cd packages/ui && npx vite build

# ---------- Runtime stage ----------
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LSR_BUNDLE_DIR=/app/examples
ENV LSR_STATIC_DIR=/app/ui

# Copy built artifacts. Keep node_modules so the server can find its deps.
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/package.json ./
COPY --from=build /build/packages/core/dist ./packages/core/dist
COPY --from=build /build/packages/core/package.json ./packages/core/
COPY --from=build /build/packages/server/dist ./packages/server/dist
COPY --from=build /build/packages/server/package.json ./packages/server/
COPY --from=build /build/packages/ui/dist ./ui
COPY --from=build /build/examples ./examples

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
