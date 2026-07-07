# Learning Roadmap

Last updated: 2026-06-30.

The homelab now has a working GitOps platform: k3s, Argo CD, MetalLB, Traefik, cert-manager, kube-prometheus-stack, Homepage, and a test app are running from this repo. The best next steps are to use that foundation to learn operational workflows instead of only adding more tools.

## Current Baseline

- Three-node k3s cluster is running on Proxmox.
- Argo CD reconciles the `homelab` root application and child applications from this repo.
- `homelab`, `homelab-apps`, `homelab-infrastructure`, and `homelab-monitoring` are `Synced` and `Healthy`.
- Traefik is exposed through MetalLB at `192.168.40.30`.
- Internal HTTPS works through cert-manager and the `homelab-ca` ClusterIssuer.
- Grafana, Argo CD, Homepage, and the nginx test app are exposed through `*.lab.home.arpa`.

## Recommended Learning Path

1. Storage and persistence
   - Choose a first storage layer, likely Longhorn or democratic-csi against Proxmox-backed storage.
   - Deploy one small stateful workload with a PVC.
   - Delete and recreate the workload to prove the volume survives.
   - Document the storage class, failure assumptions, and recovery procedure.

2. Backup and restore
   - Add Velero or a simpler first backup workflow.
   - Back up Kubernetes objects and persistent data for one stateful app.
   - Perform a restore test on purpose and document the exact commands.
   - Treat untested backups as no backups.

3. Secrets management
   - Pick one approach before deploying sensitive services: Sealed Secrets, External Secrets Operator, or SOPS with age.
   - Start with one low-risk secret, such as a test app credential.
   - Document how to rotate it and how to rebuild from Git plus the required private key material.

4. GitOps operations
   - Make changes through Git, then watch Argo CD sync them.
   - Practice rollback by reverting a commit.
   - Introduce a harmless drift manually with `kubectl`, then observe and fix it through Argo CD.
   - Keep using manual `kubectl apply` only for bootstrap and break-glass recovery.

5. Monitoring and alerting
   - Build a small set of Grafana dashboards for nodes, pods, ingress, and storage.
   - Add one or two practical alerts, such as node down and persistent volume nearly full.
   - Route alerts somewhere visible, even if it is just a local SMTP or webhook target at first.

6. Real workloads
   - Replace the nginx test app with one or two services that teach something concrete.
   - Use KOReader Sync Server as the next learning workload because it is small, personally useful, stateful, and exercises ingress, TLS, PVCs, registration, backups, and client trust of the lab CA.
   - Good candidates are a small database-backed app, a wiki, a pastebin, or a GitOps-managed internal dashboard.
   - Prefer services that require ingress, TLS, secrets, storage, backup, and monitoring.

7. Upgrade and failure drills
   - Practice k3s patch upgrades on one worker before touching the control plane.
   - Reboot nodes one at a time and observe workload behavior.
   - Break one non-critical component intentionally, then recover it from Git and documented runbooks.

8. Utility/admin VM
   - Add this after the storage and backup path is clear.
   - Install `kubectl`, `helm`, `k9s`, Ansible, SSH keys, and a repo checkout.
   - Use it for stable in-network operations, not as the only source of desired state.

## Near-Term Backlog

1. Add a persistent storage layer and commit the manifests through Argo CD.
2. Document and then deploy KOReader Sync Server as the next learning workload.
3. Add a first backup and restore test.
4. Choose and document a secrets-management approach.
5. Replace `nginx-test` with a real learning workload.
6. Add basic alerting for node health, ingress availability, and storage capacity.
7. Update the rebuild runbook after each milestone.

## Next Learning Workload: KOReader Sync Server

KOReader Sync Server is a good first real stateful app for this lab because it is small enough to reason about, useful on the internal network, and touches several platform concepts at once:

- Ingress and internal TLS through Traefik and cert-manager.
- Persistent Redis data through a PVC.
- Bootstrap-time account registration and later lock-down.
- Client trust of the homelab CA.
- Backup and restore discipline before treating synced reading progress as important data.

The planned v1 deployment should use the upstream all-in-one container first, with Redis bundled in the app container and persisted through a `local-path` PVC. That keeps the first deployment focused on understanding the app behavior and the Kubernetes plumbing. Splitting Redis into its own workload, or adopting a Redis chart/operator, should wait until the all-in-one deployment is understood and backup/restore expectations are clearer.

Use [KOReader Sync Server Tutorial](koreader-sync-tutorial.md) for the guided install steps, copyable manifests, verification commands, and follow-up hardening path.

## Learning Rules

- Every new service should teach at least one platform concept.
- Every stateful service needs a restore test before it matters.
- Every manual fix should become either Git state or a runbook note.
- Prefer boring, recoverable choices until the GitOps and backup workflows feel routine.
