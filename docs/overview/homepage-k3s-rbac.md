# Custom Homepage k3s Read-only RBAC

`kubernetes/apps/homepage/custom-k3s-readonly-rbac.yaml` is rendered through
the Homepage kustomization and bound only to the custom Homepage ServiceAccount.
It does not modify the stock Homepage ServiceAccount, Deployment, or current
production Service/Ingress ownership.

The identity can only `get`, `list`, and `watch`:

- core `nodes`;
- `apps` `deployments`, `statefulsets`, and `daemonsets`.

It deliberately has no Secret access and no create, update, patch, delete,
exec, attach, port-forward, or task-control permissions.
