# Security

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.
Email **[security contact email]** with a description, steps to reproduce, and the affected URL.
We acknowledge reports within 72 hours and aim to fix critical issues within 7 days. Please give us reasonable time to fix an issue before disclosing it publicly. We won't take legal action against good-faith research that avoids privacy violations, data destruction and service disruption.

## How the application protects data

| Area | Control | Where |
|---|---|---|
| Passwords | scrypt (N=2¹⁵, r=8, p=1) with a per-user random salt; plain-text passwords are never stored or logged | `src/server/security/crypto.ts` |
| Sessions | 256-bit random tokens in `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` cookies; only the SHA-256 hash is stored; 30-day expiry; revoked on password change or reset | `src/server/auth/` |
| Brute force | Per-IP and per-email rate limits (stored in Postgres, so they work on serverless) plus a 15-minute account lock after 5 failed logins; constant-time responses for unknown emails | `security/rate-limit.ts`, `auth/service.ts` |
| Account enumeration | Login and password-reset responses don't reveal whether an email exists | `auth/service.ts` |
| Email and reset links | Single-use, hashed, time-limited tokens (24 h verify, 1 h reset) | `auth/service.ts` |
| OAuth | Google authorization-code flow with PKCE and a signed `state` cookie; auto-linking only when Google has verified the email | `app/api/auth/google/` |
| Authorization | Role-based access control with 20 permissions and 6 default roles; every admin page and server action checks permissions on the server; role changes sign the user out | `auth/permissions.ts`, `auth/session.ts` |
| CSRF | Next.js server actions verify the `Origin` header; the upload route checks same-origin explicitly; cookies are `SameSite=Lax` | `server/request.ts` |
| Input validation | Every server action and API validates input with zod; nothing from the client is trusted | `src/lib/validation.ts`, actions |
| Prices and totals | Always computed from the database on the server, never taken from the browser | `server/cart/service.ts` |
| SQL injection | Prisma's parameterised queries; raw SQL uses tagged templates only (parameterised) | throughout |
| XSS | React escaping; admin-edited Markdown is rendered to React elements, never raw HTML, and blocks `javascript:` links; JSON-LD is escaped | `lib/markdown.tsx`, `lib/seo.tsx` |
| Security headers | Content-Security-Policy, HSTS (production), X-Frame-Options DENY, nosniff, strict Referrer-Policy and Permissions-Policy | `next.config.ts` |
| Uploads | Staff-only; type detected from file bytes (JPEG/PNG/WebP/AVIF only, SVG rejected); 4 MB limit; random filenames; rate limited | `server/storage.ts` |
| Open redirects | `?next=` only accepts same-site relative paths | `lib/utils.ts` |
| Inventory integrity | Atomic stock updates that can't oversell; every change is written to a ledger | `server/inventory/service.ts` |
| Audit trail | Admin changes are logged with actor, action and data | `server/audit.ts` |
| Secrets | All secrets come from environment variables; none are in the code or sent to the browser; production refuses to start without a strong `AUTH_SECRET` | `.env.example` |
| Payments (Phase 4) | Card data will never touch our servers (hosted gateway checkout); webhook signatures will be verified; payment operations will use idempotency keys | planned |

Automated tests cover hashing, signed cookies, RBAC, upload sniffing, XSS escaping, lockout, rate limits, single-use tokens and oversell protection (`tests/`).

## Operator checklist (do these before launch)

- [ ] Turn on **two-factor authentication** for GitHub, Vercel, Neon, Resend, Google Cloud and your domain registrar.
- [ ] Use a unique, random `AUTH_SECRET` of 32+ characters. Changing it later only invalidates OAuth-in-progress and guest-cart cookies.
- [ ] Give each staff member their own account with the **least-privileged role** they need. Never share the owner login.
- [ ] Keep the GitHub repository **private**.
- [ ] Remove `BOOTSTRAP_ADMIN_EMAIL` once the owner account exists.
- [ ] Never set `SEED_DEMO_ACCOUNTS` on a hosted environment.
- [ ] Give previews their own database branch, or no database, so previews can't change production data.
- [ ] Turn on GitHub **Dependabot alerts** (Settings → Code security) and merge security updates promptly.
- [ ] Check backups: confirm you can restore a Neon branch, and keep monthly exports of orders for your records.
- [ ] Review **Admin → Audit log** regularly, and remove staff access as soon as someone leaves.
- [ ] If a personal data breach happens, follow your incident plan: contain it, assess it, and notify affected users and the authorities as required by the DPDP Act / CERT-In directions (CERT-In requires reporting certain incidents within 6 hours).

## Supported versions

Only the latest deployment of the `main` branch receives security fixes.
