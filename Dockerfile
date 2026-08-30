# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage — produces the static bundle.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifests first so dependency installation is cached independently of
# source changes. The lockfile glob tolerates its absence before the first
# `npm install` has been run locally.
COPY package.json package-lock.json* ./

# Prefer a reproducible install when a lockfile exists; fall back otherwise.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage — nginx serving the static build. No Node, no application
# server: the MVP has no backend (ADR 0001).
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
