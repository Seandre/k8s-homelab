# Network

## LAN

| Item | Value |
|---|---|
| UniFi network | `Servers` |
| Subnet | `192.168.40.0/24` |
| VLAN ID | `40` |
| Gateway | `192.168.40.1` |
| DNS | `192.168.40.1` |
| Domain | `lab.home.arpa` |

## Host IPs

| Host | IP | Role |
|---|---:|---|
| `pve-01` | `192.168.40.20` | Proxmox host |
| `k8s-control-01` | `192.168.40.21` | Kubernetes control-plane VM |
| `k8s-worker-01` | `192.168.40.22` | Kubernetes worker VM |
| `k8s-worker-02` | `192.168.40.23` | Kubernetes worker VM |
| `utility-01` | `192.168.40.24` | Future utility VM |
| `ingress-vip` | `192.168.40.30` | Future ingress or load balancer IP |

## Current Status

- The Proxmox host and Kubernetes VMs are on `192.168.40.0/24`.
- The three Kubernetes nodes are reachable by static IP and joined to the k3s cluster.
- VM NIC VLAN tags are blank; the switch port/native network carries VLAN `40`.
- UniFi UDM Pro Intrusion Prevention previously interfered with SSH/TCP traffic and was adjusted.

## Notes

Use the UniFi `Servers` network for homelab infrastructure. Keep DHCP reservations, static leases, and DNS records aligned with this table.

Ingress uses MetalLB to assign `192.168.40.30` to the Traefik `LoadBalancer` Service. Service hostnames should use the `*.lab.home.arpa` convention.

Initial DNS records:

| Hostname | Address |
|---|---:|
| `argocd.lab.home.arpa` | `192.168.40.30` |
| `nginx-test.lab.home.arpa` | `192.168.40.30` |
