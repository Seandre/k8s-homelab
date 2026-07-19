# Network Topology and UniFi Policy

This page records the live UniFi topology and the security boundaries around the homelab. Address assignments for individual hosts remain canonical in the [Infrastructure Reference](infrastructure-reference.md).

Last verified: 2026-07-18, after the U6 Pro management-plane migration.

## Topology

![Logical homelab network topology showing the UDM Pro, Teleport VPN, and the Default, Services, Main, IoT, Servers, Management, and Parking VLANs](network-topology.svg)

The UDM Pro is the router, DHCP/DNS authority, firewall, IDS/IPS enforcement point, and Teleport endpoint. VLANs terminate on the UDM Pro; zone rules control routed traffic between them.

The U6 Pro uplink is a small, explicit trunk: Management VLAN `50` is native for the AP itself, while Main VLAN `20` and IoT VLAN `30` are the only tagged networks. Proxmox and its VMs use native Servers VLAN `40`, so VM NIC VLAN tags remain blank.

## VLAN and Zone Matrix

| VLAN | UniFi network / zone | Subnet | Purpose | Internet | Important notes |
|---:|---|---|---|---|---|
| `1` | Default / Internal | `192.168.10.0/24` | Wired recovery and legacy/default access | Yes | UDM port 2 is retained as the tested recovery path; it assigned `192.168.10.242` during verification. |
| `11` | Services / Services | `192.168.11.0/24` | Isolated service discovery when needed | No | DHCP, DNS, NTP, and mDNS to the gateway are allowed before a gateway catch-all block. No permanent client is documented. |
| `20` | Main / Trusted | `192.168.20.0/24` | Primary user and administrative clients | Yes | The `WeDontHaveInternet` SSID uses WPA2/WPA3 transition mode with optional PMF. |
| `30` | IoT / IoT | `192.168.30.0/24` | Wireless and wired consumer devices | Yes | Gateway access is limited to DHCP, DNS, NTP, and mDNS; gateway HTTPS and Servers access are blocked. |
| `40` | Servers / Servers | `192.168.40.0/24` | Proxmox, VMs, Kubernetes, OKD, and service VIPs | Yes | Servers cannot initiate into Trusted, IoT, Services, Management, Internal, or VPN. Approved Trusted, Management, and VPN connections receive stateful return traffic. |
| `50` | Management / Management | `192.168.50.0/24` | UniFi infrastructure management | Yes | DHCP pool is `.100-.199`; the AP and PDU use controlled static addresses outside that pool. mDNS forwarding is off. |
| `999` | Parking | None assigned | Unused physical ports | No | Use as the native network for an intentionally parked port, or disable the port. |

WiFiman Teleport uses `192.168.2.0/24` and is the intended remote-access VPN. It has been tested over cellular from `192.168.2.4` to the Proxmox UI on `192.168.40.20:8006`. The separate standalone WireGuard server is disabled.

## UDM Pro Port Map

| Port | Connected device / role | Native network | Tagged networks | Current state |
|---:|---|---|---|---|
| `1` | `pve-01` | Servers VLAN `40` | All currently permitted | Active; this unrestricted tagged set is the highest-priority hardening item. Block all tags if the host does not need a trunk, or allow only explicitly required VM VLANs. |
| `2` | Wired recovery | Default VLAN `1` | Currently not explicitly restricted | Keep available for recovery, but block all tagged VLANs. The recovery path has been tested at 1 Gbps. |
| `3` | Living Room Apple TV | IoT VLAN `30` | Blocked | Active native-only access port. |
| `4` | Unused | Review | Review | Disable it or move it to Parking VLAN `999`. |
| `5` | USP-PDU-Pro | Management VLAN `50` | Blocked | Active at 100 Mbps full duplex; the device is `192.168.50.252`. |
| `6` | Unused | Review | Review | Disable it or move it to Parking VLAN `999`. |
| `7` | U6 Pro | Management VLAN `50` | Main `20`, IoT `30` only | Active at 1 Gbps full duplex; the AP is `192.168.50.251`. |
| `8` | Stale `USP-PDU-Pro` label | Not the PDU uplink | — | Correct or remove the misleading label. |
| `9`, `11` | Unused | — | — | Disabled. |

Ports not listed here have no documented homelab-specific role. Confirm the live UniFi port view before changing them.

## Wireless and IoT Layout

The two production broadcasts are:

| SSID | VLAN | Security | Use |
|---|---:|---|---|
| `WeDontHaveInternet` | Main `20` | WPA2/WPA3 transition, optional PMF | Trusted user and admin clients |
| `WeDontHaveInternet-IoT` | IoT `30` | WPA2-compatible | Consumer and embedded devices |

Reserved IoT addresses verified during the migration are:

| Device | Address | Connection |
|---|---:|---|
| Airmega unit 1 | `192.168.30.32` | Wi-Fi |
| Airmega unit 2 | `192.168.30.16` | Wi-Fi |
| Denon receiver | `192.168.30.78` | IoT network |
| LG TV | `192.168.30.214` | IoT network |
| Living Room Apple TV | `192.168.30.74` | Wired, UDM port 3 |
| Nest thermostat | `192.168.30.141` | Wi-Fi |

Cross-VLAN AirPlay discovery and control from Main are working. mDNS currently forwards all service types across Main, IoT, Services, and Servers. The wired Apple TV has one source-MAC-scoped callback rule to Main for TCP/UDP `49152-65535`. Narrow mDNS to Main and IoT and to the required service types through the supported UniFi UI when practical.

## Security Boundaries

- IDS/IPS runs in prevention mode across Default, Services, Main, IoT, Servers, and Management, with all 36 configured categories enabled.
- UPnP and NAT-PMP are disabled. There are no configured port forwards or static routes.
- IoT can use gateway DHCP, DNS, NTP, and mDNS plus the Internet, but cannot open the gateway management UI or initiate into Servers.
- Services can use gateway DHCP, DNS, NTP, and mDNS, but has no Internet access and is blocked from other gateway services.
- Servers can reach the gateway and Internet but cannot initiate connections into client, management, service, internal, or VPN zones.
- Trusted currently has broad access to Management, Servers, Services, and IoT. A future policy should restrict administrative access to an explicit group of approved Macs and phones.
- Management devices currently have broad initiation rules into Trusted, Servers, Services, and IoT. Replace those with only the traffic required for device operation and administration.
- Teleport gateway access remains at UniFi's system default. A narrower DNS/NTP allow plus management-plane block interrupted the tunnel and was rolled back.

## Operational Notes

- Preserve UDM port 2 as a wired recovery path during firewall, VLAN, AP, or switch-port changes.
- Export a current System Config Backup before network-policy changes and verify local-console access from the recovery port.
- When changing a native network, first confirm the device's static address, gateway, and DNS will be valid on the destination VLAN.
- Use allow-first ordering: install and verify required exceptions before enabling a zone or gateway catch-all block.
- Test both UDP and TCP DNS, Internet access, management access, and cross-VLAN discovery after relevant changes.
- Keep the DHCP pools unchanged unless a documented stable-address need arises. Use reservations or controlled static addresses outside the pool.
- UniFi device SSH password authentication should be disabled when not required, or replaced with key-only authentication.
- DHCP search domains currently drift between `home.arpa`, `lab.home.arpa`, and blank. Standardize them separately from the canonical private split-DNS zone, `lab.seandre.dev`.
- IPv6 has partial or legacy settings. Either configure it consistently across the active networks or disable it consistently.

## Hardening Backlog

1. Restrict tagged VLANs on UDM port 1 and harden the recovery and unused access ports.
2. Create an explicit admin-device group; narrow Trusted access to Management and Servers.
3. Remove unnecessary Management-initiated cross-zone rules.
4. Narrow mDNS network and service scope through the supported UI.
5. Disable or harden UniFi device SSH, remove the obsolete `Teleport-ServerVLAN` rule, and delete the disabled WireGuard object if it will not be reused.
6. Standardize DHCP domain and IPv6 intent, export a post-change backup, and complete a documented restore drill.

The broader physical-reliability backlog is a UPS, a second AP or WAN path if justified, and deliberate cabling and failover tests.
