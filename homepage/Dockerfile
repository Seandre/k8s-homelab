FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    SHUTDOWN_GRACE_MS=10000

WORKDIR /app

RUN addgroup -S -g 10001 homepage \
    && adduser -S -D -H -u 10001 -G homepage homepage \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build --chown=homepage:homepage /app/package.json ./
COPY --from=build --chown=homepage:homepage /app/node_modules ./node_modules
COPY --from=build --chown=homepage:homepage /app/dist ./dist

USER 10001:10001

EXPOSE 3000

CMD ["node", "dist/server/server/index.js"]
