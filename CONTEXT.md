# Prokuer Domain Glossary

This file records domain concepts used in module names and interfaces. Update when a new term enters the codebase.

## Core Entities

**Tender** — a government procurement announcement (`TenderStatus`: open | closing_soon | closed). Sourced from Thai public agencies. Vendors apply via assisted submission.

**Project** — a private-sector work opportunity posted by a Buyer (`ProjectStatus`: open | in_progress | completed). Vendors submit sealed bids.

**Buyer** — the organisation or individual posting a Project or awarding a Tender.

**Vendor** — a verified supplier/contractor who submits bids or applies to Tenders. Verification tier: new | verified | verified_pro.

**Bid** — a sealed price proposal submitted by a Vendor for a Project. Bids are hidden from other Vendors until the deadline.

**Escrow** — payment held by Prokuer and released only on milestone completion (`StatusValue`: escrow_held | escrow_released).

## Filter Concepts

**TenderFilters / ProjectFilters** — the set of user-controlled filter + sort state passed to `filterAndSortTenders` / `filterAndSortProjects` in `lib/filters.ts`.

**FilterSection** — a collapsible sidebar accordion wrapping a single filter dimension. Lives in `components/ui/FilterSection.tsx`.

## Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Status config | `lib/status.ts` | Maps `StatusValue` → display styles + translation key |
| Format utils | `lib/format.ts` | Thai-locale budget, date, initials formatting |
| Filter logic | `lib/filters.ts` | Pure filter + sort for Tenders and Projects |
| Data utils | `lib/data-utils.ts` | Derives filter options from data; exports all 77 Thai provinces |
| Translations | `lib/translations/` | One file per namespace; merged in `index.ts` |
