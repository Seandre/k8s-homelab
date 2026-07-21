# Home Assistant k3s Operations

This runbook owns the IE-004 Home Assistant foundation at
`https://ha.lab.seandre.dev`. Argo CD deploys one Home Assistant replica from
`kubernetes/apps/home-assistant`; the `homelab-apps` Application selects it
through the cluster apps kustomization.

## Storage and configuration boundary

The `home-assistant-config` claim requests 10 GiB from `local-path` and mounts at
`/config`. Home Assistant runtime state, `.storage`, SQLite history, and the
image-installed Coway component live there. `configuration.yaml` is a read-only
ConfigMap subPath, so Git owns the bootstrap while runtime state remains
writable and survives replacement pods.

`local-path` is node-local, not highly available. A pod replacement can reuse
the bound volume, but loss of the volume's node is a restore event. IE-014 owns
encrypted backup and clean-PVC restore.

The initial NetworkPolicy permits only Traefik ingress on TCP 8123, kube-dns on
TCP/UDP 53, and public non-RFC1918 HTTPS on TCP 443. It intentionally has no
Atom, Prometheus, Homepage, Kubernetes API, or private-subnet egress rule.

## Validate and observe

Before pushing any workload change:

```sh
home-assistant/k3s/test-manifests.sh
kubectl kustomize kubernetes/clusters/homelab/apps >/tmp/homelab-apps.yaml
git diff --check
```

After Argo reconciles:

```sh
kubectl -n argocd get application homelab-apps
kubectl -n home-assistant get deployment,pod,service,pvc,ingress,networkpolicy
kubectl -n home-assistant rollout status deployment/home-assistant --timeout=300s
kubectl -n home-assistant logs deployment/home-assistant --tail=100
curl --fail https://ha.lab.seandre.dev/
```

The first request must show Home Assistant onboarding. Complete onboarding only
as the owner, over the private Main or Teleport path. Do not record the account,
recovery material, integration credentials, `.storage` contents, or logs that
contain identifiers in Git.

To prove persistence without inspecting sensitive state, create a harmless
Home Assistant zone or helper named `IE-004 Persistence Check`, record the PVC
and pod UID, delete only the current pod, wait for rollout, then confirm that the
named object remains and the PVC UID is unchanged. Remove the helper afterward
if it has no operational use. Never delete the PVC for this test.

## Immutable image update

Only deploy a `main` workflow image using both its full-SHA tag and OCI index
digest. Verify the digest first, then edit the single `image:` field in
`deployment.yaml`, run the validation commands above, review, commit, and push.
Argo performs a `Recreate` rollout so two Home Assistant writers cannot share
the ReadWriteOnce volume.

Record the workflow URL, old and new image references, Argo revision, rollout
result, and redacted smoke-test result in the package evidence. Never use
`latest`, a branch tag, or a tag without its digest.

## Rollback

The normal rollback is a Git revert of only the image-update commit followed by
an Argo reconciliation. Confirm the Deployment returns to the exact prior
full-SHA tag and digest and that `/`, persisted state, and integrations are
healthy. Do not roll back or restore `.storage` merely to roll back the image.

If the API is unavailable and an emergency live image rollback is necessary,
set the Deployment to the last accepted tag-and-digest, restore that same value
in Git immediately, and let Argo converge. A live-only edit is temporary drift,
not a completed rollback. Deleting the PVC is never part of image rollback.

