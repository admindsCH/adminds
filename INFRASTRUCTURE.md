# Adminds — Infrastructure & Compliance Summary

> Swiss-compliant medical data infrastructure for AI-assisted psychiatric report generation.
> All resources hosted in **Azure Switzerland North**. Zero data leaves Switzerland.

---

## Architecture Overview

See [architecture.svg](architecture.svg) for the full visual diagram.

```
User ──HTTPS/TLS 1.2+──▶ api.adminds.ch (Public IP)
                              │
                         ┌────▼─────────────────────────────┐
                         │  Azure Switzerland North          │
                         │                                   │
                         │  VNet: 10.0.0.0/16                │
                         │  ┌───────────────┐ ┌────────────┐ │
                         │  │ default subnet│ │ PE subnet  │ │
                         │  │ 10.0.0.0/24   │ │ 10.0.1.0/24│ │
                         │  │               │ │            │ │
                         │  │  adminds-vm   │ │ OpenAI PE  │ │
                         │  │  ┌─────────┐  │ │ 10.0.1.4   │ │
                         │  │  │ Nginx   │  │ │            │ │
                         │  │  │ :443    │  │ │ Key Vault  │ │
                         │  │  │   ↓     │  │ │ PE         │ │
                         │  │  │ FastAPI │──┼─▶ 10.0.1.5   │ │
                         │  │  │ :8000   │  │ │            │ │
                         │  │  └─────────┘  │ └────────────┘ │
                         │  │ ADE Encrypted │                │
                         │  └───────────────┘                │
                         └───────────────────────────────────┘
```

---

## Resources

| Resource | Type | Location | Access |
|----------|------|----------|--------|
| `adminds-vm` | Ubuntu VM | Switzerland North | SSH from admin IP only |
| `adminds-vm-vnet` | Virtual Network (10.0.0.0/16) | Switzerland North | — |
| `adminds-openai` | Azure OpenAI (GPT-4o Standard) | Switzerland North | Private endpoint only |
| `adminds-kv` | Azure Key Vault | Switzerland North | Private endpoint only |
| `adminds-vm-nsg` | Network Security Group | Switzerland North | — |

---

## Network & Security

### Private Endpoints (no public internet)

| Service | Private Endpoint | Private IP | DNS Zone |
|---------|-----------------|------------|----------|
| Azure OpenAI | `adminds-openai-pe` | `10.0.1.4` | `privatelink.openai.azure.com` |
| Azure Key Vault | `adminds-kv-pe` | `10.0.1.5` | `privatelink.vaultcore.azure.net` |

All API calls to OpenAI and Key Vault travel over Azure's private backbone — never the public internet.

### NSG Rules

| Rule | Direction | Port | Source | Action |
|------|-----------|------|--------|--------|
| SSH | Inbound | 22 | Admin IP (213.55.x.x) | Allow |
| HTTPS | Inbound | 443 | Any | Allow |
| HTTP | Inbound | 80 | Any | Allow (301 → HTTPS) |

### TLS

- Certificate: Let's Encrypt for `api.adminds.ch`
- Protocols: TLS 1.2 and 1.3 only
- HTTP automatically redirected to HTTPS
- HSTS enabled (1 year, includeSubDomains)

### Security Headers

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

---

## Encryption

| Layer | Method | Details |
|-------|--------|---------|
| **In transit** | TLS 1.2/1.3 | Nginx terminates TLS, all external traffic encrypted |
| **At rest (disk)** | Azure Disk Encryption (ADE) | OS disk encrypted, key stored in Key Vault |
| **Secrets** | Azure Key Vault | API keys stored in KV, fetched at app startup via private endpoint |

---

## Key Vault Configuration

| Setting | Value |
|---------|-------|
| Public network access | **Disabled** |
| RBAC authorization | Enabled |
| Soft delete | Enabled |
| Purge protection | Enabled |
| Disk encryption enabled | Yes |

Secrets stored:
- `azure-openai-api-key` — Azure OpenAI API key

---

## Application Stack

| Component | Technology | Details |
|-----------|-----------|---------|
| Reverse proxy | Nginx | TLS termination, security headers, proxy to :8000 |
| Backend | FastAPI (Python) | Docker container on port 8000 |
| AI model | Azure OpenAI GPT-4o | Standard SKU, Switzerland North, private endpoint |
| Auth | Clerk | JWT validation |

---

## Data Flow

1. **User** uploads a psychiatric document via `https://api.adminds.ch`
2. **Nginx** terminates TLS, forwards request to FastAPI on `localhost:8000`
3. **FastAPI** loads the API key from **Key Vault** (private endpoint `10.0.1.5`)
4. **FastAPI** sends document text to **Azure OpenAI** (private endpoint `10.0.1.4`)
5. **GPT-4o** processes the text and returns the structured report
6. **FastAPI** generates the DOCX and returns it to the user

All steps occur within Azure Switzerland North. No data crosses any border.

---

## Compliance Checklist

| Requirement | Status |
|-------------|--------|
| All compute in Switzerland | PASS |
| All AI processing in Switzerland | PASS |
| All secrets management in Switzerland | PASS |
| No public internet for AI/secrets calls | PASS |
| Encryption in transit (TLS 1.2+) | PASS |
| Encryption at rest (ADE) | PASS |
| Secrets in Key Vault (not hardcoded) | PASS |
| Key Vault purge protection | PASS |
| Network segmentation (VNet + subnets) | PASS |
| SSH access restricted | PASS |
| FADP/nDSG data residency | PASS |

---

## Setup Log

### Phase 1 — Azure Infrastructure
- Created VNet `adminds-vm-vnet` (10.0.0.0/16) with `default` and `private-endpoints` subnets
- Deployed Azure OpenAI resource in Switzerland North, disabled public access
- Created private endpoint for OpenAI (`10.0.1.4`) with DNS zone
- Deployed GPT-4o model (Standard SKU — stays in Switzerland)
- Configured NSG: SSH from admin IP only, HTTPS/HTTP open
- Set DNS: `api.adminds.ch` → VM public IP
- Obtained TLS certificate via Certbot

### Phase 2 — Application Deployment
- Configured Nginx as reverse proxy (`:443` → `:8000`) with security headers
- Updated FastAPI to use `AzureOpenAI` SDK client via private endpoint
- Integrated Azure Key Vault for secrets management
- Created Key Vault private endpoint (`10.0.1.5`) with DNS zone
- Hardened Key Vault: disabled public access, enabled RBAC, soft delete, purge protection
- Enabled Azure Disk Encryption on VM OS disk
- Secured `.env` file permissions (`chmod 600`)
- Ran full compliance audit — all checks passed
