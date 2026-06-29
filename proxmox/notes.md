# Proxmox Notes

Proxmox is installed and running on the 256 GB NVMe.

The separate 2 TB NVMe is installed and has been added in Proxmox as LVM-thin storage named `vmdata`. Use `vmdata` for real VM disks and Kubernetes lab workloads.

Proxmox is reachable at `192.168.40.20`.

The Proxmox host and Kubernetes VMs are attached to the homelab network:

- Subnet: `192.168.40.0/24`
- Gateway: `192.168.40.1`
- VLAN ID: `40`
- Domain: `lab.home.arpa`

The Ubuntu template was built with Ubuntu Server 26.04 normal install. The minimized install was not used, no featured server snaps were installed, OpenSSH was enabled, and `qemu-guest-agent` was installed.

The qemu guest agent `systemctl enable` warning was encountered and treated as non-fatal.

Current Kubernetes VMs:

- `k8s-control-01`: `192.168.40.21`
- `k8s-worker-01`: `192.168.40.22`
- `k8s-worker-02`: `192.168.40.23`

The three-node k3s cluster is running and Argo CD is installed. The next Proxmox-adjacent milestone is supporting ingress/load balancer networking for the future `192.168.40.30` VIP.
