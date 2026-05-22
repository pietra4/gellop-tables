FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc && cp -r migrations dist/

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini curl
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/app.js"]
