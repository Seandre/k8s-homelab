# Homepage Phase 0 Answers

Fill in this file to provide decisions for HP-001 and HP-002 of the
[Homepage Rework Build Plan](../build/homepage-rework.md). Replace the answer
placeholders or add notes below each question.

Do not include passwords, API tokens, kubeconfigs, private keys, private
certificates, or any other secret values. Secret names, key names, endpoint
names, and permission descriptions are safe to provide here.

## HP-001: Implementation baseline

### Preview hostname

Proposed value: `homepage-preview.lab.seandre.dev`

Answer: `accept proposed`

### Custom application port

Proposed value: `3000`

Answer: `accept`

### Preview DNS and TLS

How should the preview hostname resolve, and how should its private TLS
certificate be issued?

Answer: `you decide`

### Other baseline corrections

List any corrections to the implementation baseline, rollback files, existing
service links, or bookmarks.

Answer:
dont include homepage link (link to homepage github)

## HP-002: Data-source decisions

For each source, provide corrections or write `APPROVE`.

### Prometheus

Proposed endpoint: `http://kube-prometheus-stack-prometheus.monitoring.svc:9090`

Answer: `APPROVE`

Approved query families and client-visible fields:

Answer:

### Alertmanager

Proposed endpoint: `http://kube-prometheus-stack-alertmanager.monitoring.svc:9093`

Answer: `APPROVE`

Approved alert labels/annotations exposed to the client:

Answer:

### k3s API

Proposed endpoint: `https://kubernetes.default.svc`

Answer: `APPROVE`

Approved Kubernetes resources, namespaces, and verbs:

Answer:

whatever it takes to display my required fields

### Future OKD API

Proposed endpoint: `https://api.okd.lab.seandre.dev`

Answer: `UNRESOLVED`

Answer `NOT PROVISIONED` until OKD exists? `YES`

Answer:

### Argo CD

Proposed endpoint: `https://argocd-server.argocd.svc`

Answer: `APPROVED`

Read-only account/API path and approved client-visible fields:

Answer:
whatever it takes to satisfy my requirements

### Proxmox `pve-01`

Proposed endpoint: `https://pve-01.lab.seandre.dev:8006/api2/json`

Answer: `approve`

Secret name: `homepage-proxmox-pve01`

Secret key names: `server`, `token-id`, `token-secret`; add `ca` only if private TLS is introduced.

Answer/corrections:
approve

### Proxmox `pve-02`

Proposed endpoint: `https://pve-02.lab.seandre.dev:8006/api2/json`

Answer: `approve`

Secret name: `homepage-proxmox-pve02`

Secret key names: `server`, `token-id`, `token-secret`; the configured endpoint uses a publicly trusted certificate.

Answer/corrections:

approve
### PBS

Proposed endpoint: `https://pbs-01.lab.seandre.dev:8007/api2/json`

Answer: `approve`

Secret name: `homepage-pbs-readonly`

Secret key names: `token-id`, `token-secret`, `ca`

Approved datastore, backup, and failure fields:

Answer:
recommendataion

### UniFi

Current user-facing link: `https://unifi.ui.com`

Server API endpoint, API version, and site/controller scope:

Answer: `UNRESOLVED`

Read-only credential arrangement and approved client-visible fields:

Answer:
recommendation

### Glances bridge

Current endpoints:

- `http://192.168.40.20:61208`
- `http://192.168.40.25:61208`
- `http://192.168.40.33:61208`

Answer: `APPROVE`

Corrections or additional approved fields:

Answer:

### Service probes

Answer: `APPROVE`

Corrections to the allowlisted targets or check behavior:

Answer:

### Open-Meteo

Answer: `APPROVE`

Confirm Portland `97209` is the location and imperial units are required:

Answer: `YES / NO`

Corrections:

### Optional USP-PDU-PRO

Answer: `NOT SUPPORTED / UNRESOLVED / APPROVE`

If supported, provide the verified endpoint, protocol, and read-only fields:

Answer:
find out

## Cross-cutting approval

### Polling and timeout rules

Approve the proposed polling intervals and timeouts in
`homepage-data-sources.md`, or provide corrections.

Answer: `APPROVE`

### Cache and freshness rules

Approve the proposed `CURRENT`, `STALE`, `NO DATA`, `NOT PROVISIONED`, and
`NOT SUPPORTED` behavior, or provide corrections.

Answer: `APPROVE`

### Browser/server boundary

Approve that all upstream access remains server-only and the browser receives
only normalized allowlisted REST/SSE data.

Answer: `APPROVE`

### Redaction rules

Approve the proposed credential, header, raw-response, and internal-field
redaction rules.

Answer: `APPROVE`

### Fixture status

Approve the proposed fixture coverage, including healthy, warning, critical,
stale, no-data, not-provisioned, unsupported, timeout, and recovery states.

Answer: `APPROVE`

## Gate A approval

HP-001 baseline approved: `YES`

HP-002 data-source map approved: `YES`

Approved to proceed beyond Gate A: `YES`

Owner: `SEAN`

Date: `07-19-2026`

Final notes:

Answer:
