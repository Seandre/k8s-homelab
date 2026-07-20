# Homelab Homepage

Custom private homelab homepage. The application is deployed on k3s through
Argo CD and serves production at `https://home.lab.seandre.dev`; the isolated
preview is `https://homepage-preview.lab.seandre.dev`.

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

Production enables the approved read-only live adapters. Deployment, preview
verification, production smoke checks, credential handling, and Git-only
rollback are documented in
[`docs/operations/homepage-rework.md`](../docs/operations/homepage-rework.md).
The repository-level acceptance mapping is in
[`docs/overview/homepage-v1-evidence.md`](../docs/overview/homepage-v1-evidence.md).
