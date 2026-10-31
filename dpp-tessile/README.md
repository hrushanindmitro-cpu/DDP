# DPP Tessile

```
cp .env.example .env.local
npm install
npm run i18n:check
npm run build
npm run dev
```

- Rules for Claude Code: `CLAUDE.md`. Design reference: `docs/design/mockup.png`.
- Layout: `app/(app)/` is the authenticated shell (sidebar + top bar). Public passport pages will get their own layout later.
- Strings: add keys to `lib/i18n/en.js` and use `t("key")`. The create-passport form (`app/(app)/passports/new`) is still hardcoded Italian from the MVP and must be moved to i18n.
- Plans/prices: `lib/plans.js`. Billing is not connected.
