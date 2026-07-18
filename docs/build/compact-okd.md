# Build 04: Connected Compact OKD on the Ryzen Nodes

> Status: planned. `pve-02`, `bastion-01`, and the OKD nodes do not exist yet. Complete the public-DNS proof, `utility-01`, `pve-02`, and `bastion-01` first.

This project installs a connected, Agent-based compact OKD cluster on the three HP EliteDesk 805 G8 systems. Each system is a schedulable control-plane node; there are no separate compute nodes. The existing VM-based k3s cluster remains intact as the rollback and management environment.

This is a fresh installation, not a k3s conversion. The installer may overwrite the Ryzen-node disks.

## Target Design

| Item | `okd-cp-01` | `okd-cp-02` | `okd-cp-03` |
|---|---|---|---|
| Address | `192.168.40.26` | `192.168.40.27` | `192.168.40.28` |
| CPU | Ryzen 5 PRO 5650GE, 6C/12T | Ryzen 5 PRO 5650GE, 6C/12T | Ryzen 5 PRO 5650GE, 6C/12T |
| Initial RAM | 16 GB | 16 GB | 16 GB |
| Storage | 1 TB P400 Lite SSD | 1 TB P400 Lite SSD | 1 TB P400 Lite SSD |
| Roles | control plane, etcd, compute | control plane, etcd, compute | control plane, etcd, compute |

| Shared endpoint | Address | Owner |
|---|---:|---|
| `api.okd.lab.seandre.dev` | `192.168.40.29` | HAProxy on `bastion-01` |
| `api-int.okd.lab.seandre.dev` | CNAME to `api` | `dnsmasq` on `bastion-01` |
| `*.apps.okd.lab.seandre.dev` | `192.168.40.31` | HAProxy on `bastion-01` |

The install configuration uses `baseDomain: lab.seandre.dev`, `metadata.name: okd`, three control-plane replicas, and zero compute replicas.

## Gate 1: Finish the Dependencies

Do not generate installation media until all of these are true:

- Cloudflare is authoritative for `seandre.dev`, DNS-01 has succeeded on k3s, and no private A/AAAA records are public.
- `utility-01` at `.24` holds the repository, Ansible, `kubectl`, `oc`, `openshift-install`, `oc-mirror`, ISO tools, and protected kubeconfigs.
- standalone `pve-02` at `.25` is healthy.
- `bastion-01` at `.33` runs `dnsmasq`, HAProxy, and Nexus and owns secondary addresses `.29` and `.31`.
- the OKD forward and reverse records resolve correctly from `utility-01`, a workstation, and each node network.

Keep installer and client versions aligned with the selected OKD release. Record their checksums and versions in the build log; do not silently use `latest`.

## Gate 2: Prepare the Hardware

Install the three 1 TB SSDs, update each system to the same stable firmware, and record chassis, MAC address, hostname, and disk serial mappings in the private asset inventory. Configure UEFI, consistent boot settings, virtualization, and automatic recovery after power loss as desired.

Before installation, verify memory and storage and test SSD latency. etcd is sensitive to slow synchronous writes; investigate an outlier rather than accepting it as normal.

If you want a repeatable compute baseline, install temporary Ubuntu 26.04 on all three Ryzen nodes and complete [Optional 05: Top500 HPL Benchmark](../optional/hpl-benchmark.md) now. It is based on the pinned `geerlingguy/top500-benchmark` workflow. Collect and back up its results before continuing: the Agent-based installer may overwrite these temporary installations and their local data. The HPL project is optional and does not block OKD when deliberately skipped.

The initial 16 GB per node is an installation floor. Plan to upgrade to 32 GB after the cluster is stable, one node at a time.

## Gate 3: Activate Private DNS

Create these records in `dnsmasq` on `bastion-01` only after that VM is operational:

```text
address=/okd-cp-01.okd.lab.seandre.dev/192.168.40.26
address=/okd-cp-02.okd.lab.seandre.dev/192.168.40.27
address=/okd-cp-03.okd.lab.seandre.dev/192.168.40.28
address=/api.okd.lab.seandre.dev/192.168.40.29
cname=api-int.okd.lab.seandre.dev,api.okd.lab.seandre.dev
address=/.apps.okd.lab.seandre.dev/192.168.40.31
ptr-record=26.40.168.192.in-addr.arpa,okd-cp-01.okd.lab.seandre.dev
ptr-record=27.40.168.192.in-addr.arpa,okd-cp-02.okd.lab.seandre.dev
ptr-record=28.40.168.192.in-addr.arpa,okd-cp-03.okd.lab.seandre.dev
ptr-record=29.40.168.192.in-addr.arpa,api.okd.lab.seandre.dev
```

Configure UniFi Forward Domain for `okd.lab.seandre.dev` to `192.168.40.33`. Configure the OKD nodes to use `192.168.40.33` directly. If the installed UniFi version has no Forward Domain feature, distribute `.33` as DNS to the trusted LAN/VPN instead.

`dnsmasq` must forward unmatched queries, including `_acme-challenge` TXT queries, to public resolvers. Never shadow the whole `seandre.dev` public zone locally.

Validate before continuing:

```bash
for name in \
  okd-cp-01.okd.lab.seandre.dev \
  okd-cp-02.okd.lab.seandre.dev \
  okd-cp-03.okd.lab.seandre.dev \
  api.okd.lab.seandre.dev \
  api-int.okd.lab.seandre.dev \
  random.apps.okd.lab.seandre.dev; do
  dig @192.168.40.33 +short "$name"
done
dig @192.168.40.33 -x 192.168.40.26 +short
dig @192.168.40.33 TXT _acme-challenge.seandre.dev
```

Repeat forward and reverse tests from all three nodes and a workstation. Public resolvers must return no A/AAAA answer for these names.

## Gate 4: Configure HAProxy

Bind the API frontends to `.29` and ingress frontends to `.31`. Forward:

| Frontend | Backends |
|---|---|
| `.29:6443` | all three nodes on `6443` |
| `.29:22623` | all three nodes on `22623` during installation |
| `.31:80` | all three schedulable nodes on `80` |
| `.31:443` | all three schedulable nodes on `443` |

Use TCP mode and health checks. Keep Nexus on `.33:443`; distinct destination addresses prevent its HTTPS listener from colliding with OKD ingress. Validate the HAProxy configuration and prove that taking one backend down removes it from rotation.

## Optional: Learn PXE Booting with the OKD Nodes

PXE (Preboot Execution Environment) booting starts a computer from software delivered over Ethernet instead of from a USB drive or its local disk. The node firmware obtains an address with DHCP, downloads a network boot program and Fedora CoreOS boot artifacts, and then starts the OKD Agent-based Installer. The installer uses the matching Ignition configuration to install Fedora CoreOS to the node's SSD.

PXE changes how the node receives the installer; it does not replace the OKD Agent-based Installer or the infrastructure around it. DNS, HAProxy, the rendezvous IP, `install-config.yaml`, `agent-config.yaml`, and the cluster's Ignition data are still required.

### Choose the deployment path

Use the Agent-based Installer ISO for this first deployment. Three nodes do not justify adding DHCP/PXE and boot-artifact hosting before the cluster itself is proven, and the ISO has fewer moving parts and fewer failure modes. Keep PXE as the next learning exercise and as the repeatable recovery path for reprovisioning a failed node.

| Concern | Agent-based ISO | PXE/iPXE |
|---|---|---|
| First deployment of these three nodes | Recommended | More infrastructure than necessary |
| Setup complexity | Low | DHCP, boot service, HTTP, and firmware coordination |
| Reprovisioning | Requires attaching media again | Fast and repeatable |
| Scale | Best for a small cluster | Better for many bare-metal nodes |
| Enterprise use | Common with BMC virtual media and Assisted Installer workflows | Common with Ironic, Metal³, Foreman, MAAS, or iPXE-based provisioning |

Enterprise environments commonly use PXE or iPXE when they operate a managed bare-metal provisioning system. They also commonly use BMC virtual media or an Assisted/Agent-based Installer image for smaller deployments. This homelab should follow the same progression: deploy and validate OKD with the ISO, then add PXE without changing the cluster's DNS, HAProxy, or Ignition design.

### PXE in this homelab

```text
                         management / trusted LAN

  utility-01 (.24)                         bastion-01 (.33)
  - openshift-install                       - dnsmasq DNS
  - install-config.yaml                     - DHCP/PXE, if deliberately enabled
  - agent-config.yaml                       - HTTP boot-artifact server
  - generated PXE artifacts                 - HAProxy: .29 and .31
            |                                         |
            | copy artifacts / monitor                | DNS, DHCP, HTTP
            |                                         |
            +-------------------- switch -------------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
       okd-cp-01 (.26)     okd-cp-02 (.27)     okd-cp-03 (.28)
       HP 805 G8 / Ryzen   HP 805 G8 / Ryzen   HP 805 G8 / Ryzen
       UEFI PXE -> FCOS    UEFI PXE -> FCOS    UEFI PXE -> FCOS
```

The HP EliteDesk 805 G8 nodes must use their onboard wired Ethernet adapters. Wi-Fi and many USB Ethernet adapters cannot PXE boot. Use UEFI network boot and keep the three nodes' MAC addresses in the private asset inventory.

### Understand the boot sequence

```text
1. Node firmware
       |
2. DHCP lease and boot-server information
       |
3. UEFI PXE or iPXE boot program
       |
4. FCOS kernel, initramfs, and Agent-based Installer rootfs
       |
5. Agent Ignition configuration
       |
6. coreos-installer writes the intended SSD
       |
7. Node reboots from SSD and joins the OKD installation
```

There must be exactly one DHCP authority on the node's boot network. UniFi normally provides the household or trusted-LAN DHCP service. Do not enable a broad `dnsmasq` DHCP range on `.40` while UniFi is also serving that range. For a first exercise, use an isolated provisioning switch/VLAN, or configure tightly scoped reservations and PXE options in the existing DHCP service. Keep `bastion-01`'s DNS forwarding behavior unchanged.

### PXE learning exercise

Perform this exercise with one node first. It is destructive once the installer is allowed to write the disk.

1. Record the node's chassis serial, onboard NIC MAC address, intended hostname, and SSD serial. Confirm that the node is connected by wired Ethernet and that UEFI network boot appears in the HP `F9` boot menu.

2. On `utility-01`, create and protect the same install directory used by the ISO workflow. Keep `install-config.yaml`, `agent-config.yaml`, pull secrets, generated Ignition data, and kubeconfigs out of Git.

3. Generate the Agent-based Installer artifacts with the version of `openshift-install` selected for this build. Recent releases provide a PXE-artifact command; confirm the exact subcommand before generating:

   ```bash
   openshift-install agent --help
   openshift-install agent create pxe-files --dir ~/okd-install
   find ~/okd-install -maxdepth 2 -type f -print | sort
   ```

   If the selected OKD release does not provide `create pxe-files`, use its documented PXE workflow or fall back to `agent create image`. Do not mix PXE artifacts, Ignition files, or kernel arguments from different OKD releases.

4. Copy only the generated public boot artifacts to the HTTP directory on `bastion-01`. Keep pull secrets, private keys, kubeconfigs, and the original installation directory on `utility-01`. The boot artifacts must be reachable from all three nodes by HTTP or HTTPS, and the Ignition URL must remain stable for the entire installation.

5. Configure the chosen DHCP/PXE service to identify the nodes by MAC address and direct them to the generated UEFI PXE or iPXE boot entry. Start with one MAC reservation. The exact DHCP option names vary by service; the important values are the node address, gateway, DNS server `.33`, boot filename, and boot-artifact server.

6. On `bastion-01`, watch DNS, HTTP, and HAProxy while booting the first node:

   ```bash
   sudo journalctl -fu dnsmasq
   sudo journalctl -fu haproxy
   sudo ss -ltnp | grep -E ':(80|443|6443|22623)'
   ```

   From another session, verify that the node receives its intended address and that its requested boot artifacts return HTTP success. A DHCP lease alone proves only that address assignment works; it does not prove that the kernel, rootfs, or Ignition file is reachable.

7. At the HP `F9` menu, select `UEFI IPv4 Network` for the onboard NIC. Confirm that the boot log shows the expected MAC-to-host mapping and that the node reaches the Agent-based Installer. Stop before disk installation if the hostname, address, or disk mapping is wrong.

8. After the first node boots correctly, add the remaining two MAC reservations and boot entries. Keep all three nodes on the same installer release and use the rendezvous address from `agent-config.yaml`—`192.168.40.26` in this design.

9. Monitor installation from `utility-01`:

   ```bash
   openshift-install agent wait-for bootstrap-complete \
     --dir ~/okd-install --log-level=info
   openshift-install agent wait-for install-complete \
     --dir ~/okd-install --log-level=info
   ```

PXE is useful for reprovisioning a failed node, but normal operation should boot from the SSD. After installation, put the local disk before network boot in the HP UEFI order, or leave PXE as a manual `F9` option. Otherwise a healthy node can accidentally reinstall itself on the next reboot.

## Generate the Agent-based Installer Media

On `utility-01`, create a dedicated, permission-restricted install directory. Obtain the pull secret through the approved OKD release workflow and keep it outside Git. Create `install-config.yaml` with the important compact-cluster shape:

```yaml
apiVersion: v1
baseDomain: lab.seandre.dev
metadata:
  name: okd
compute:
  - name: worker
    replicas: 0
controlPlane:
  name: master
  replicas: 3
networking:
  networkType: OVNKubernetes
platform:
  none: {}
pullSecret: '<REDACTED>'
sshKey: '<PUBLIC_SSH_KEY>'
```

Create `agent-config.yaml` with the rendezvous IP and one host entry per MAC address. Pin each host to its address, gateway, DNS server `.33`, and intended hostname. Use `192.168.40.26` as the rendezvous address.

```bash
chmod 0700 ~/okd-install
openshift-install agent create image --dir ~/okd-install
```

Back up only the files required for recovery, with secret material encrypted and access controlled. Never commit `install-config.yaml`, pull secrets, generated authentication data, kubeconfigs, or private keys.

## Install and Monitor

Boot all three nodes from either the generated ISO or the PXE artifacts above. Confirm the MAC-to-host and disk mappings before accepting a disk write. From `utility-01`:

```bash
openshift-install agent wait-for bootstrap-complete \
  --dir ~/okd-install --log-level=info
openshift-install agent wait-for install-complete \
  --dir ~/okd-install --log-level=info
```

Install the resulting kubeconfig as a separate file and preserve the existing k3s context:

```bash
install -d -m 0700 ~/.kube
install -m 0600 ~/okd-install/auth/kubeconfig ~/.kube/okd.yaml
KUBECONFIG=~/.kube/okd.yaml oc get nodes -o wide
```

Because this is a compact cluster, confirm the control-plane nodes are schedulable. Do not configure Nexus mirroring or replace platform certificates while operators are converging.

## Cluster Acceptance

Wait until every ClusterOperator is stable:

```bash
KUBECONFIG=~/.kube/okd.yaml oc get clusteroperators
KUBECONFIG=~/.kube/okd.yaml oc get clusterversion
KUBECONFIG=~/.kube/okd.yaml oc get nodes
```

Acceptance requires `Available=True`, `Progressing=False`, and `Degraded=False` for all ClusterOperators over a meaningful observation period. Resolve pending CSRs, time synchronization, DNS, storage, registry, or networking faults before adding optional components.

## Publicly Trusted Platform Certificates

After acceptance, install a supported cert-manager release and Cloudflare DNS-01 credentials. Issue:

- a wildcard certificate for `*.apps.okd.lab.seandre.dev` in `openshift-ingress`, then reference its Secret as the default IngressController certificate;
- a certificate for `api.okd.lab.seandre.dev` in `openshift-config`, then configure it as an API server named certificate.

Never configure a custom certificate for `api-int.okd.lab.seandre.dev`. That internal endpoint remains platform-managed; replacing it can degrade the cluster. See [Build 01: Public TLS](public-domain-tls.md) for the rollout and checks.

## Nexus and Mirroring

Use Nexus first as an artifact repository. Document and test backup, restore, retention, and pruning before it becomes a dependency. Only after the connected cluster is healthy should `oc-mirror` add a narrowly scoped release and Operator mirror. Keep the first installation connected so DNS, load balancing, installation, and mirroring failures are not combined.

## Memory Upgrade

Upgrade one node from 16 GB to 32 GB at a time:

1. confirm all operators are healthy and etcd has quorum;
2. cordon and drain the node using OKD maintenance guidance;
3. shut down, install memory, and verify it in firmware;
4. boot, wait for `Ready`, uncordon, and recheck all operators;
5. proceed only after the cluster is stable.

## Failure and Recovery Tests

- Shut down one node and confirm etcd quorum, API access through `.29`, and application ingress through `.31` remain available.
- Confirm HAProxy removes and later restores the backend.
- Restore Nexus from backup and prove retention/pruning.
- Test the narrow `oc-mirror` workflow before relying on mirrored content.
- Preserve installer artifacts and kubeconfigs according to the recovery policy.

## Completion Criteria

- All forward, wildcard, and reverse records resolve from every required client.
- Public DNS contains no homelab A/AAAA records; ACME TXT lookup still works through the bastion.
- All ClusterOperators are available and stable.
- API and console certificates validate without a private CA.
- A one-node outage preserves quorum, API access, and ingress.
- Nexus restore and narrowly scoped mirroring have been tested.

## References

- [OKD Agent-based Installer](https://docs.okd.io/latest/installing/installing_with_agent_based_installer/installing-with-agent-based-installer.html)
- [OKD bare-metal DNS requirements](https://docs.okd.io/latest/installing/installing_bare_metal/ipi/ipi-install-prerequisites.html)
- [OKD API server certificates](https://docs.okd.io/latest/security/certificates/api-server.html)
