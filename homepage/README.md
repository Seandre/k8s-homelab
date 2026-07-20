# Homelab Homepage

Phase 1 foundation for the custom private homelab homepage.

## Local development

From this directory:

```bash
npm ci
npm run dev
```

The Vite client runs at `http://localhost:5173` and proxies `/api` requests to
the Fastify server at `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

## Production preview

Build the client and server, then start the single process:

```bash
npm run build
NODE_ENV=production npm start
```

The server serves the built client and API from one port. Configuration is
available through `NODE_ENV`, `HOST`, `PORT`, and `SHUTDOWN_GRACE_MS`.

Phase 1 currently exposes fixture-backed `/api/v1/bootstrap`,
`/api/health/live`, and `/api/health/ready` endpoints. It does not contact
infrastructure systems.
