# DPP Tessile: development plan

Rule of work: one task at a time. Status "done" means written and covered by tests where logic allows; database migrations,
build and screens are checked by the owner on their machine. Last update: 2026-10-28.

## Done
| # | Task | Notes |
|---|------|-------|
| 1 | CLAUDE.md, project rules | |
| 2-3 | Audit of the MVP and application shell | RU interface, EN base |
| 4 | Database, sign-in, organizations, roles | migrations 0001 |
| 5 | Plans and server-side limits | 0002, 0003, 0007 (FREE, LITE, BASE, FACTORY, EXPORT, add-ons, UA2026) |
| 6 | Products and collections | 0004 |
| 7 | Suppliers, sites, materials, lots | 0005, generic CRUD in `lib/crud` |
| 8 | Documents and private file storage | 0006 |
| 8a | Approval policy at registration (one person or two) | 0009 |
| 9 | Passport wizard, 5 steps, drafts, quota | 0008 |
| 9a | Employee invitations by link | 0010 |

## Next
| # | Task | Notes |
|---|------|-------|
| 10 | Approval, immutable version with hash, publication | uses `can_approve_passport`; approval and publication are separate actions; names of approvers recorded |
| **10a** | **Mail (SMTP) via Brevo free plan: account e-mails and notifications about new organizations** | **code written, waits for the owner's Brevo setup (docs/backend-setup.md); scope narrowed by the owner** |
| 11 | Trust Page `/p/{id}` and QR | green "Verified" only after human approval; hash status honest; public PDF button (LITE and up) |
| 12 | PDF: internal documents and public Trust Page PDF | server templates, public one has public fields only |
| 13 | Dashboard tasks, expiring certificates, notifications | partly done (real counts); notifications need 10a |

## Later
14 Checks and audit module, export dossier. 15 Import PDF, Excel, scans (BASE and up). 16 AI assistant and regulatory knowledge base with sources.
17 Supply chain traceability and recalls. 18 Supplier portal by link, files go to an inbox for human acceptance (FACTORY and up).
19 Backups and restore test. 20 Blockchain hash and Polygon (FACTORY and up). 21 API, webhooks, ERP/Shopify (EXPORT).
22 Unstable internet. 23 Languages: 12 interface languages, then auto-translation to 24 (list of 24 needed). 24 Final check.
Owner's backlog (see BACKLOG.md): custom field builder, QR analytics, CO2 calculator, AI repair and disposal, marketplaces API, custom domain,
ESPR rule updates with human review. To remove: `/passports/legacy` (first MVP demo with its fake payment button).

---

## Task 10a: Mail (SMTP) for account registration and notifications

**Decision 2026-10-28 (owner):** own SMTP at **Brevo**, free plan (300 e-mails a day, SMTP relay included), needed only for registration:
sign-up confirmation, password reset, and a notification to the operator about every new organization. Everything below beyond that
(invitation e-mails, passport and certificate notifications, outbox, bounce handling) is postponed until it is needed; the same Brevo account can carry it later.

**Already written:** `lib/mail.js` (generic SMTP sender, honest "not configured"), operator notification on organization registration
(`OPERATOR_EMAIL`, with a UA2026 review hint), forgot password, set new password, resend confirmation, `/auth/callback` for e-mail links.
**Owner's part:** Brevo account, sender domain with SPF/DKIM/DMARC, SMTP key, Supabase Custom SMTP, Vercel variables, test.

### Original wider scope (kept for later)

**Why now.** Without it, Supabase sends sign-up confirmation and reset e-mails through its built-in test mailer: not meant for
production, strict hourly limit (a third-party guide says 2 per hour, check the current figure in Supabase docs), and poor deliverability.
Our invitation security needs **Confirm email = ON**, which is impossible to run for real users on the test mailer.
Also missing in the app today: "forgot password", password reset and resend confirmation pages.

**Scope**
1. **Provider and domain.** Choose an SMTP provider by: EU region or EU data processing, SPF/DKIM/DMARC support, bounce and complaint
   handling, SMTP plus HTTP API, price at our volume, logs. Candidates to compare: Amazon SES (EU region), Resend, Postmark, Brevo, Mailgun (EU).
   Send from a dedicated subdomain (for example `mail.<our domain>`), sender `no-reply@`, reply-to `support@`.
   DNS: SPF, DKIM, DMARC (start with `p=none`, move to `quarantine` after clean reports).
2. **Supabase Auth through custom SMTP** (Project Settings, Auth, SMTP Settings): confirmation, password reset, e-mail change.
   Review Auth rate limits, e-mail expiry, Site URL and redirect URLs. Edit the templates (RU first, EN base; all 12 languages in the translation task).
3. **Auth pages in the app:** forgot password, set new password, resend confirmation, clear messages for unconfirmed accounts.
4. **Application e-mails** (sent by our server, not by Supabase): invitation e-mail with the link (the manual copy of the link stays as fallback),
   notification that a passport waits for approval, certificate expiry reminders (task 13), supplier requests (task 18).
   - One sender module with templates (RU and EN), plain-text part, no secrets in the body except the one-time invitation link.
   - Invitation e-mails are sent at the moment of creation, so the token is never stored in readable form. On failure the page shows the link to copy.
   - Other e-mails go through an **outbox table** (queued, sent, failed, attempts, last error, no personal data beyond the address and template parameters),
     processed by a scheduled job with retries and back-off.
   - Limits: per organization and per recipient rate limits, suppression list fed by bounce and complaint webhooks (never mail an address that bounced).
   - Every send of a significant e-mail is written to the audit log (type, organization, time; not the content).
5. **Secrets and config:** SMTP credentials only in the Supabase dashboard and in Vercel environment variables
   (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`), documented in `.env.example` without values. Nothing in the repository or the browser.
6. **Honest states:** when SMTP is not configured the app says so (no fake "e-mail sent") and falls back to showing the invitation link.

**Done when**
- A new user receives the confirmation e-mail in the inbox (not spam) from our domain, confirms, signs in. SPF, DKIM, DMARC pass in a header check.
- Password reset works end to end.
- An invitation e-mail arrives; accepting it with another address is refused.
- A bounced address is suppressed and shown as such in the team page.
- Tests cover templates, the suppression and rate-limit rules and the outbox retry logic; a staging test with the real provider is done by the owner.

**Decisions needed from the owner**
- Sending domain and who manages its DNS.
- Provider preference (EU data residency required or only preferred?).
- Expected volume in the first year (to compare prices).
