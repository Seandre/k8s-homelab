# Operations 04: Proxmox and VM Names under `seandre.dev`

**Status:** Complete — verified from a trusted macOS client on 2026-07-12.

This tutorial makes the active Proxmox host available at `https://pve-01.lab.seandre.dev:8006` with a publicly trusted certificate and adds private `lab.seandre.dev` aliases for the VMs hosted on it.

The design keeps every management address private. Cloudflare publishes only temporary ACME TXT challenges; UniFi answers the host and VM names on trusted LAN and VPN clients. Proxmox obtains and renews its own certificate so hypervisor access does not depend on Kubernetes, Traefik, or cert-manager.

## Target Design

| Resource | New private name | Existing identity or address | Certificate |
|---|---|---|---|
| Proxmox host | `pve-01.lab.seandre.dev` | installed node name `pve01`; `192.168.40.20` | Proxmox native ACME DNS-01 |
| k3s control plane VM | `k8s-control-01.lab.seandre.dev` | `k8s-control-01.lab.home.arpa`; `192.168.40.21` | None required |
| k3s worker VM | `k8s-worker-01.lab.seandre.dev` | `k8s-worker-01.lab.home.arpa`; `192.168.40.22` | None required |
| k3s worker VM | `k8s-worker-02.lab.seandre.dev` | `k8s-worker-02.lab.home.arpa`; `192.168.40.23` | None required |
| Automation VM | `utility-01.lab.seandre.dev` | `utility-01.lab.home.arpa`; `192.168.40.24` | None required |

Do not rename the installed Proxmox node merely to add the new DNS name. The live node certificate shows that its installed name is `pve01`. Renaming an installed Proxmox node changes paths and cluster-filesystem assumptions; an ACME certificate may use `pve-01.lab.seandre.dev` without changing the node name.

## 1. Preserve the Existing DNS Records

Before changing UniFi, capture the current DNS table and DHCP reservations as described in [Build 01: Publicly Trusted TLS](../10-build/01-public-domain-tls.md).

The live UniFi audit found no legacy DNS records for `pve01` or the three k3s VMs. Their addresses are unique, so create direct Host (A) records. `utility-01.lab.home.arpa` already owns the A record for `.24`, so use a CNAME only for its new alias:

| Type | Name | Address or canonical target |
|---|---|---|
| A | `pve-01.lab.seandre.dev` | `192.168.40.20` |
| A | `k8s-control-01.lab.seandre.dev` | `192.168.40.21` |
| A | `k8s-worker-01.lab.seandre.dev` | `192.168.40.22` |
| A | `k8s-worker-02.lab.seandre.dev` | `192.168.40.23` |
| CNAME | `utility-01.lab.seandre.dev` | `utility-01.lab.home.arpa` |

If UniFi later reports that an address is already owned by a different A record, preserve that working record and use it as the CNAME target rather than deleting it blindly.

In UniFi Network 9.4, open **Settings → Policy Table → Create New Policy → DNS**. In Network 9.3, open **Settings → Policy Engine → DNS → Create DNS Record**. Select **Host (A)** for the first four rows and **Alias (CNAME)** for `utility-01`.

These records belong only in UniFi. Do not add public Cloudflare A, AAAA, or CNAME records for them.

## 2. Make Split DNS Reach the Mac and VPN Clients

The NextDNS Apple profile must exclude both private zones so macOS uses the network-provided UniFi resolver:

```text
lab.seandre.dev,home.arpa
```

If AdGuard DNS Protection is enabled, also add both zones to `network.extension.exclude.domains`, or disable AdGuard's DNS module and let NextDNS own filtered DNS.

Flush macOS resolver state after changing the records or profiles:

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

Verify through UniFi and through the native macOS resolver:

```bash
dig @192.168.40.1 A pve-01.lab.seandre.dev +noall +answer
dscacheutil -q host -a name pve-01.lab.seandre.dev
```

Expected final address:

```text
192.168.40.20
```

Repeat the native lookup for each VM alias. Also verify that public resolvers expose nothing:

```bash
for name in \
  pve-01 \
  k8s-control-01 \
  k8s-worker-01 \
  k8s-worker-02 \
  utility-01; do
  dig @1.1.1.1 A "$name.lab.seandre.dev" +short
  dig @1.1.1.1 AAAA "$name.lab.seandre.dev" +short
done
```

Every public query should be empty.

## 3. Create a Dedicated Cloudflare Token

Create a new token specifically for Proxmox rather than copying the cert-manager token out of Kubernetes.

Use these permissions:

- Zone / DNS / Edit
- Zone / Zone / Read

Restrict the resource to the single `seandre.dev` zone. Record the token, Cloudflare Account ID, and Zone ID in the password manager under a Proxmox ACME entry. Never commit them.

The Proxmox Cloudflare DNS plugin accepts:

```text
CF_Token=REDACTED
CF_Account_ID=REDACTED
CF_Zone_ID=REDACTED
```

`CF_Zone_ID` is optional in the upstream plugin, but specifying the known zone avoids broad zone discovery and matches the single-zone token restriction.

## 4. Register Staging and Production ACME Accounts

Log in to the existing Proxmox UI at `https://192.168.40.20:8006`. The IP endpoint will still show the current Proxmox private-CA warning during this maintenance step.

In the Proxmox UI:

1. Open **Datacenter → ACME**.
2. Under **Accounts**, add `letsencrypt-staging` with the Let's Encrypt staging directory, a valid email address, and accepted terms.
3. Add `letsencrypt-production` with the normal Let's Encrypt V2 production directory and the same contact address.
4. Under **Challenge Plugins**, add a DNS plugin named `cloudflare-seandre-dev`.
5. Select the Cloudflare DNS API (`cf` / Cloudflare Managed DNS).
6. Paste the three `CF_*` lines from the password manager into the plugin API-data field.
7. Use a validation delay of 30 seconds initially if the UI exposes that option.

Proxmox stores ACME plugin credentials in its protected `/etc/pve/priv/acme/` configuration. Do not copy that configuration into Git or diagnostics.

## 5. Prove DNS-01 with Staging

Select the installed node `pve01`, then open **System → Certificates**.

1. Select the staging ACME account.
2. Add `pve-01.lab.seandre.dev` as an ACME domain.
3. Choose DNS validation and the `cloudflare-seandre-dev` plugin.
4. Select **Order Certificates Now**.
5. Watch the task log until DNS presentation, validation, installation, and the `pveproxy` reload succeed.

The staging certificate is deliberately untrusted. This step proves the dedicated token and renewal path without consuming production rate limits.

During the challenge, verify the public TXT record if troubleshooting is needed:

```bash
dig @1.1.1.1 TXT \
  _acme-challenge.pve-01.lab.seandre.dev +short
```

Do not create a public address record or forward port `8006` from the internet.

## 6. Issue the Production Certificate

After staging succeeds:

1. Select `letsencrypt-production` for the node certificate.
2. Keep the same domain and Cloudflare challenge plugin.
3. Order the certificate again.
4. Let Proxmox install it and reload `pveproxy`.

Open the FQDN rather than the IP address:

```text
https://pve-01.lab.seandre.dev:8006
```

Let's Encrypt validates the DNS name, not the private IP. Accessing `https://192.168.40.20:8006` may still show a hostname mismatch and should no longer be the normal bookmark.

## 7. Verify End to End

From a trusted client:

```bash
curl -I https://pve-01.lab.seandre.dev:8006
```

Proxmox does not implement the HTTP `HEAD` method on this endpoint, so this successful TLS test can return:

```text
HTTP/1.1 501 method 'HEAD' not available
```

That response is expected. It proves DNS resolution, TCP connectivity, and TLS validation succeeded because `curl` reached the Proxmox API without a certificate error. To test with a normal `GET` request while discarding the response body, use:

```bash
curl -sS -o /dev/null \
  -w 'HTTP %{http_code} — TLS verified\n' \
  https://pve-01.lab.seandre.dev:8006/
```

Inspect the certificate chain and hostname:

```bash
openssl s_client \
  -connect pve-01.lab.seandre.dev:8006 \
  -servername pve-01.lab.seandre.dev \
  -verify_return_error </dev/null
```

Expected result:

```text
Verify return code: 0 (ok)
```

Verify that the subject alternative name includes `pve-01.lab.seandre.dev` and the issuer is Let's Encrypt rather than `Proxmox Virtual Environment`.

Test VM aliases independently:

```bash
ssh sean@utility-01.lab.seandre.dev
ssh sean@k8s-control-01.lab.seandre.dev
```

SSH will ask once to associate an existing host key with each new alias. Compare the fingerprint with the existing IP or `.home.arpa` entry before accepting it.

## 8. Verify Renewal and Recovery

Proxmox automatically renews certificates issued through its integrated ACME configuration. Periodically check the node's **System → Certificates** page and ACME task history.

Preserve these recovery facts in the password manager:

- FQDN: `pve-01.lab.seandre.dev`
- private address: `192.168.40.20`
- ACME account names
- Cloudflare token, Account ID, and Zone ID
- DNS plugin ID: `cloudflare-seandre-dev`
- UniFi DNS recovery table

The Cloudflare token is a renewal dependency. Rotate it deliberately by updating the Proxmox challenge plugin and completing a forced staging validation before relying on the new token.

## Completion Record

Completed and verified on 2026-07-12:

- UniFi and the native macOS resolver return `192.168.40.20` for `pve-01.lab.seandre.dev`.
- The Cloudflare DNS-01 challenge succeeded with both the staging and production ACME accounts.
- Proxmox installed the production certificate and reloaded `pveproxy`.
- `curl -I https://pve-01.lab.seandre.dev:8006` completed TLS validation and reached Proxmox, which returned its expected `501 method 'HEAD' not available` response.
- The normal management URL is now `https://pve-01.lab.seandre.dev:8006`.

## Upstream References

- [Proxmox VE Administration Guide: certificate management and ACME](https://pve.proxmox.com/pve-docs/pve-admin-guide.pdf)
- [acme.sh Cloudflare DNS plugin options](https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_cf.sh)
- [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
