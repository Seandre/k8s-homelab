# KOReader Sync Server Tutorial

This tutorial walks through installing KOReader Sync Server on the homelab Kubernetes cluster as a learning workload. The goal is not only to make KOReader sync work, but to understand the core Kubernetes concepts involved in running a small internal stateful service.

You will learn and practice:

- Namespace isolation.
- Deployments and Pods.
- Services.
- Ingress through Traefik.
- TLS certificates through cert-manager.
- Persistent storage with PVCs.
- Application configuration through environment variables.
- Bootstrap security tradeoffs.
- Backup and restore planning.

## Target v1 Design

The first version should stay intentionally simple:

```text
App name:      kosync
Namespace:     kosync
Hostname:      kosync.lab.home.arpa
Image:         koreader/kosync:v2.1.1
Ingress:       Traefik
TLS issuer:    homelab-ca
Service port:  17200
Storage:       local-path PVC
Redis path:    /var/lib/redis
```

This version uses the upstream all-in-one KOReader Sync container. Redis runs inside the same container and stores data at `/var/lib/redis`. That is not the ideal long-term architecture, but it is a good first learning step because it lets you focus on the Kubernetes plumbing before splitting Redis into its own workload.

## Before You Start

Run commands from the repo root:

```bash
cd /Users/spinzon/Developer/homelab
export KUBECONFIG=$HOME/.kube/k8s-homelab.yaml
```

Confirm the cluster is reachable:

```bash
kubectl get nodes
kubectl get application -n argocd
```

## Step 1: Create the App Directory

Each app in this repo lives under `kubernetes/apps/<name>`. Create a new directory for KOReader Sync:

```bash
mkdir -p kubernetes/apps/kosync
```

## Step 2: Create the Namespace

A namespace gives the app its own Kubernetes workspace. It does not provide complete security isolation by itself, but it gives you a clean boundary for inspecting and managing resources.

Create `kubernetes/apps/kosync/namespace.yaml`:

```bash
cat > kubernetes/apps/kosync/namespace.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: kosync
EOF
```

After deployment, this command should show only KOReader Sync resources:

```bash
kubectl get all -n kosync
```

Do not apply this file with `kubectl apply`. In this repo, Argo CD reconciles app resources from Git through Kustomize.

## Step 3: Add the Namespace-Only App Kustomization

Kustomize tells Argo CD which YAML files belong to this app. At this checkpoint, include only the namespace so Argo CD can create the namespace by itself before the workload exists.

Create `kubernetes/apps/kosync/kustomization.yaml`:

```bash
cat > kubernetes/apps/kosync/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
EOF
```

## Step 4: Add KOReader Sync to the Homelab Apps

Edit `kubernetes/clusters/homelab/apps/kustomization.yaml` so it includes the new app:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/nginx-test
  - ../../../apps/homepage
  - ../../../apps/kosync
```

This is the GitOps connection. The `homelab-apps` Argo CD Application watches `kubernetes/clusters/homelab/apps`, so once this file references `../../../apps/kosync`, Argo CD can reconcile the namespace from Git.

## Step 5: Validate and Deploy the Namespace

Before committing, ask Kustomize to render the namespace-only app:

```bash
kubectl kustomize kubernetes/apps/kosync
kubectl kustomize kubernetes/clusters/homelab/apps
git diff --check
```

Commit and push the namespace checkpoint:

```bash
git status --short
git add kubernetes/apps/kosync kubernetes/clusters/homelab/apps/kustomization.yaml
git commit -m "Add KOReader Sync namespace"
git push
```

Let Argo CD reconcile the change, or trigger a hard refresh:

```bash
kubectl -n argocd annotate application homelab-apps argocd.argoproj.io/refresh=hard --overwrite
kubectl -n argocd get application homelab-apps
kubectl get ns kosync
kubectl get all -n kosync
```

At this point, `kubectl get ns kosync` should show the namespace. `kubectl get all -n kosync` should return no workload resources yet, because only `namespace.yaml` is listed in the app kustomization.

## Step 6: Add Persistent Storage

Pods are disposable. Data is not. KOReader Sync stores state in Redis, so the first deployment needs a PersistentVolumeClaim.

This v1 tutorial uses `local-path` storage. That is useful for learning, but it is node-local and not resilient to losing the node that holds the volume.

Create `kubernetes/apps/kosync/pvc.yaml`:

```bash
cat > kubernetes/apps/kosync/pvc.yaml <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: kosync-redis
  namespace: kosync
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
EOF
```

The important part is that this volume will be mounted at `/var/lib/redis`, where the all-in-one container keeps Redis data.

## Step 7: Deploy the Application

A Deployment manages the desired number of Pods. If the Pod crashes or is deleted, Kubernetes creates a replacement.

Create `kubernetes/apps/kosync/deployment.yaml`:

```bash
cat > kubernetes/apps/kosync/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kosync
  namespace: kosync
  labels:
    app.kubernetes.io/name: kosync
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: kosync
  template:
    metadata:
      labels:
        app.kubernetes.io/name: kosync
    spec:
      containers:
        - name: kosync
          image: koreader/kosync:v2.1.1
          ports:
            - name: http
              containerPort: 17200
          env:
            - name: ENABLE_USER_REGISTRATION
              value: "true"
          volumeMounts:
            - name: redis-data
              mountPath: /var/lib/redis
      volumes:
        - name: redis-data
          persistentVolumeClaim:
            claimName: kosync-redis
EOF
```

`ENABLE_USER_REGISTRATION=true` is only for bootstrap. The intended flow is:

1. Deploy the service.
2. Create your user from KOReader.
3. Change registration to `false`.
4. Redeploy.
5. Verify existing login still works and new signups are rejected.

This is a useful production habit: bootstrap access and steady-state access are often different.

## Step 8: Expose the Pod with a Service

A Deployment creates Pods, but Pod IPs are temporary. A Service gives the app a stable internal network identity.

Create `kubernetes/apps/kosync/service.yaml`:

```bash
cat > kubernetes/apps/kosync/service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: kosync
  namespace: kosync
spec:
  selector:
    app.kubernetes.io/name: kosync
  ports:
    - name: http
      port: 17200
      targetPort: http
EOF
```

This Service selects Pods with `app.kubernetes.io/name: kosync` and forwards traffic to their named `http` port.

## Step 9: Add Ingress Through Traefik

Ingress is the HTTP routing layer. Instead of exposing every app directly, Traefik receives requests for internal hostnames and routes them to the right Kubernetes Service.

For this app, the request path should be:

```text
Client -> HTTPS -> Traefik -> HTTP -> kosync Service -> Pod port 17200
```

Create `kubernetes/apps/kosync/ingress.yaml`:

```bash
cat > kubernetes/apps/kosync/ingress.yaml <<'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kosync
  namespace: kosync
  annotations:
    cert-manager.io/cluster-issuer: homelab-ca
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - kosync.lab.home.arpa
      secretName: kosync-tls
  rules:
    - host: kosync.lab.home.arpa
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kosync
                port:
                  number: 17200
EOF
```

cert-manager should issue the certificate using the internal `homelab-ca` ClusterIssuer. Traefik terminates TLS at the edge, so the app only needs to speak HTTP inside the cluster.

KOReader clients may need to trust the homelab root CA. If the device does not trust the CA, sync can fail even when the server is working correctly.

## Step 10: Expand the App Kustomization

Now update the app kustomization so Argo CD deploys the full workload, not just the namespace.

Edit `kubernetes/apps/kosync/kustomization.yaml`:

```bash
cat > kubernetes/apps/kosync/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - pvc.yaml
  - deployment.yaml
  - service.yaml
  - ingress.yaml
EOF
```

## Step 11: Validate Locally

Before committing, ask Kustomize to render the manifests:

```bash
kubectl kustomize kubernetes/apps/kosync
kubectl kustomize kubernetes/clusters/homelab/apps
git diff --check
```

These checks catch common YAML and whitespace mistakes before Argo CD sees the change.

## Step 12: Commit and Push

Commit the manifests:

```bash
git status --short
git add kubernetes/apps/kosync
git commit -m "Add KOReader Sync learning workload"
git push
```

Let Argo CD reconcile the change, or trigger a refresh:

```bash
kubectl -n argocd annotate application homelab-apps argocd.argoproj.io/refresh=hard --overwrite
kubectl -n argocd get application homelab-apps
```

If your root application handles app sync instead, inspect both the root and child apps:

```bash
kubectl -n argocd get application
kubectl -n argocd get application homelab
kubectl -n argocd get application homelab-apps
```

## Step 13: Verify the Deployment

Check the main Kubernetes objects:

```bash
kubectl get ns kosync
kubectl -n kosync get pods
kubectl -n kosync get deploy
kubectl -n kosync get svc
kubectl -n kosync get ingress
kubectl -n kosync get pvc
kubectl -n kosync get certificate
```

Check the rollout:

```bash
kubectl -n kosync rollout status deployment/kosync
```

Check logs:

```bash
kubectl -n kosync logs deploy/kosync
```

Inspect the certificate:

```bash
kubectl -n kosync describe certificate kosync-tls
```

Useful things to confirm:

- The Pod is running.
- The PVC is bound.
- The Ingress has the expected hostname.
- The certificate is issued.
- KOReader can connect.
- Data survives a Pod restart.
- Registration is disabled after account creation.

## Step 14: Test the Endpoint

Test with certificate verification disabled first:

```bash
curl -vk https://kosync.lab.home.arpa
```

If your Mac trusts the homelab CA, test normally:

```bash
curl -v https://kosync.lab.home.arpa
```

If `curl -vk` works but normal `curl` fails with a certificate error, the server path is likely working and the client trust path needs attention.

## Step 15: Create Your KOReader Account

In KOReader, configure the sync server as:

```text
https://kosync.lab.home.arpa
```

Create your account while registration is enabled.

## Step 16: Lock Registration Down

After your account exists, change `kubernetes/apps/kosync/deployment.yaml`:

```yaml
- name: ENABLE_USER_REGISTRATION
  value: "false"
```

Commit and push the lock-down:

```bash
git add kubernetes/apps/kosync/deployment.yaml
git commit -m "Disable KOReader Sync registration"
git push
```

Verify the rollout:

```bash
kubectl -n kosync rollout status deployment/kosync
kubectl -n kosync logs deploy/kosync
```

Then confirm your existing login still works and new registration does not.

## Step 17: Test Persistence

Restart the Deployment:

```bash
kubectl -n kosync rollout restart deployment/kosync
kubectl -n kosync rollout status deployment/kosync
kubectl -n kosync get pvc
```

Then verify KOReader can still sync. This teaches the core stateful workload concept: Pods can be replaced, but the PVC should keep the Redis data.

## Known v1 Limitations

This first version is a learning deployment, not the final state.

- `local-path` storage is node-local and is not resilient to losing the node that holds the volume.
- No backup or restore workflow is in place yet.
- Redis is bundled inside the upstream all-in-one container.
- Registration is temporarily open during bootstrap.
- KOReader clients may need to trust the homelab root CA before connecting.

Do not trust this app with important reading progress until backup and restore have been tested.

## Future Improvements

Improve the service in this order:

1. Add backup and restore testing.
2. Move Redis data from `local-path` to Longhorn or another resilient StorageClass.
3. Add monitoring for Pod health.
4. Add PVC usage alerts.
5. Add alerts for failed readiness or liveness probes after probes are defined.
6. Split Redis into its own Kubernetes workload, or use a Redis chart/operator, once the all-in-one deployment is understood.

## Recommended Learning Order

Use this sequence to keep the learning focused:

1. Deploy the simplest working all-in-one version.
2. Confirm KOReader can sync.
3. Restart the Pod and verify data survives.
4. Disable registration.
5. Document the exact bootstrap steps.
6. Add backup and restore.
7. Move storage off `local-path`.
8. Later, split Redis out once you understand the app's behavior.

That gives you a useful app while teaching the path from container image to real internal service.
