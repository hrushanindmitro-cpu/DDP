# Backend setup (Supabase)

1. Create a Supabase project. Choose an EU region (Frankfurt) because the platform targets EU factories.
2. SQL editor: run `supabase/migrations/0001_core_auth_orgs.sql` once.
3. Authentication > URL configuration: set Site URL to your deployed address (and `http://localhost:3000` for development).
4. Authentication > Providers > Email: keep email confirmation ON for production. Set minimum password length to 10.
5. Settings > API: copy Project URL and the anon public key into `.env.local` (see `.env.example`) and into Vercel environment variables. Do not use the service_role key anywhere in this app.
6. On a DEV project only, run `supabase/tests/isolation.sql` in the SQL editor. It must end with the notice "isolation checks passed" and rolls everything back.
7. `npm install && npm run build && npm run dev`, open `/signup`, create an account, then create an organization.

## What is enforced where
- Database (Row Level Security): organization isolation, member management rules, append-only audit log, at least one owner per organization.
- Server code: `requirePermission()` in `lib/auth/permissions.js` must be called at the start of every server action or route that touches protected data.
- Hiding a button in the UI is never treated as protection.

## Not done yet
- Inviting other users to an organization (needs email delivery); until then every organization has its owner only.
- Switching between several organizations (Enterprise).
- Plans and limits are task 5.

## Plans (migration 0002)
Run `supabase/migrations/0002_plans.sql` after 0001. Existing organizations are put on Start with status `manual`.

Change an organization's plan by hand (billing is not connected). Find the id in Table Editor > organizations, then in SQL editor:
```sql
update public.organization_subscriptions set plan_key = 'professional', status = 'manual' where org_id = 'ID-ОРГАНИЗАЦИИ';
```
Change prices or limits (NULL = unlimited):
```sql
update public.plans set price_monthly_eur = 149 where key = 'start';
update public.plan_limits set value = 200 where plan_key = 'start' and limit_key = 'passports';
```
Plan changes are written to the audit log. Downgrading never deletes data: when a limit is exceeded only creating new items is blocked.

## Price list and Add-on Packs (migration 0003)
Run `supabase/migrations/0003_plan_matrix.sql` after 0002. Plans become FREE / LITE / BASE / FACTORY / EXPORT; existing organizations move to FREE. Limits for users, suppliers, storage and AI operations are placeholders, edit them with `update public.plan_limits ...`.

Grant a paid pack by hand (payment is not connected):
```sql
insert into public.organization_credits (org_id, pack_key, credits, note) values ('ID-ОРГАНИЗАЦИИ', 'pack_100', 100, 'оплата получена вручную');
```

## Catalog (migration 0004)
Run `supabase/migrations/0004_catalog.sql` after 0003. Adds collections and products with soft delete, organization isolation and audit entries. Run `npm test` for the validation tests (GTIN check digit, HS code, country).

## Suppliers, sites, materials, lots (migration 0005)
Run `supabase/migrations/0005_suppliers_lots.sql` after 0004. It also lets the roles Employee, Passport author and Document specialist manage suppliers and lots. The supplier limit of the plan is enforced in the database too.

## Documents (migration 0006)
Run `supabase/migrations/0006_documents.sql` after 0005. It creates the private Storage bucket `documents` (20 MB per file, only PDF, JPG, PNG, WEBP, XLSX, XLS, DOCX) and its access policies. Check in Supabase: Storage > documents > the bucket must be marked Private.
Limitations: there is no antivirus scan (type, real content and Office macros are checked); a file that was uploaded but never registered (browser closed in the middle) stays in the bucket as an orphan until a cleanup job exists.

## Price list v2, add-ons, UA2026 (migration 0007)
Run `supabase/migrations/0007_plans_v2_addons_promo.sql` after 0006. FREE becomes view-only, so to keep working with your own organization give it a paid plan (SQL editor):
```sql
update public.organization_subscriptions set plan_key = 'export', status = 'manual' where org_id = 'ID-ОРГАНИЗАЦИИ';
```
Turn on an add-on by hand:
```sql
insert into public.organization_addons (org_id, addon_key, note) values ('ID-ОРГАНИЗАЦИИ', 'qr_analytics', 'оплата получена вручную');
```
Verify a Ukrainian business after you checked it (the discount then starts with the first payment):
```sql
update public.organization_promotions set status = 'verified', verified_at = now(), verification_note = 'ЄДР проверен' where org_id = 'ID-ОРГАНИЗАЦИИ';
```

## Passports (migration 0008)
Run `supabase/migrations/0008_passports.sql` after 0007. Creates passports (drafts), composition rows, production stages, and `create_passport()`, which checks rights, plan and the monthly quota in one transaction (plan limit first, then purchased credits; deleted drafts still count). Passports can only be created through that function. Needs an organization on LITE or higher (FREE is view-only).
Document links can now point to a passport.
Old demo flow: `/passports/legacy` keeps the first MVP form (data only in the browser, still has its demo "Paga" button). It is not part of the new flow and is to be removed.

## Approval policy (migration 0009)
Run `supabase/migrations/0009_approval_policy.sql` after 0008. Each organization now has a policy: one responsible person (`same_person`) or a compiler and a different approver (`separate`). Existing organizations get the owner's name as the responsible person; change it in Settings > Organization.
The policy is set at registration and changed only through `set_approval_policy()` (audited); direct updates of the organization are limited to name and country.
`can_approve_passport()` is ready for the approval step. In `separate` mode the account that created or submitted a passport can never approve it. The names are records for the approval document, they are not linked to accounts yet (that comes with member invitations) and are not shown publicly.
Consequence: in `separate` mode one account cannot approve anything. A second user is needed, so employee invitations must be built before that mode is usable.

## Invitations (migration 0010)
Run `supabase/migrations/0010_invitations.sql` after 0009. Settings > Team (owner and administrators) creates a personal link per invited e-mail and role; send it by any channel (e-mails are not sent yet). Only a SHA-256 hash of the token is stored, the link is shown once, valid for 7 days, and can be accepted only by an account whose e-mail equals the invited address.
- Keep **Confirm email** ON in Supabase Auth in production. With it off, anyone could register with a foreign address and accept an invitation.
- The plan's user limit counts members plus open invitations. Only the owner can invite administrators; the owner role cannot be invited.
- A person can belong to several organizations; the sidebar then shows an organization switcher (cookie `dpp_org`).
- Not done: invitation e-mails (needs a mail provider), rate limiting of the accept link, linking the approval-policy names to accounts.
- To test the "separate approver" mode: invite a second address (a second mailbox of yours) with the role Approver, open the link in another browser profile, sign up with that address.

## Mail through Brevo (task 10a)
Brevo free plan: 300 e-mails a day, SMTP relay included, no card. Each registration uses about two e-mails (confirmation to the user, notice to you). Check in the Brevo dashboard whether free-plan e-mails carry a "Sent with Brevo" line and whether that matters for you; removing it is a paid option.

1. Create a Brevo account. In Senders, domains and dedicated IPs add your sending domain (best a subdomain such as `mail.<your domain>`) and add the DNS records Brevo shows: the ownership code, DKIM, and a DMARC record (start with `p=none`). Wait until Brevo marks the domain as authenticated.
2. SMTP & API > SMTP: create an SMTP key. Host `smtp-relay.brevo.com`, port `587`, login = the SMTP login shown on that page, password = the SMTP key (not the account password). **Never paste the key into the chat or the code.**
3. Supabase > Project Settings > Authentication > SMTP Settings: enable custom SMTP, sender e-mail on your verified domain (for example `no-reply@mail.<your domain>`), sender name `DPP Tessile`, host, port, login, key.
4. Supabase > Authentication > URL Configuration: Site URL = your address; Redirect URLs must contain `http://localhost:3000/**` and your production address with `/**`. Without this the links in e-mails do not return to our `/auth/callback`.
5. Confirm email stays ON in Authentication > Providers > Email.
6. `.env.local` and Vercel variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `OPERATOR_EMAIL` (your own address; leave empty to switch the notification off). Run `npm install` (new package nodemailer).
7. Test: sign up with a second address, confirm through the e-mail, try "Forgot password", register an organization and check that the notification arrives at `OPERATOR_EMAIL`. If the mail goes to spam, check SPF, DKIM, DMARC in the Brevo domain page.
If SMTP variables are missing the app still works: registration is not blocked, the notification is simply skipped.
