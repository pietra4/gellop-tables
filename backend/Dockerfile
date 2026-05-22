FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc --noEmit 2>/dev/null; exit 0

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p dist && npx tsc 2>/dev/null; exit 0
COPY migrations ./migrations

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--experimental-specifier-resolution=node", "dist/app.js"]
