# Project Context

## Purpose and problem

Create a private, mobile-first monthly expense tracker for food-ingredient purchases and meals. The user needs a frictionless way to record only an item and its amount, then immediately see the total used for a selected month.

## Required deliverables

- A React mobile web app backed by Supabase with Google OAuth sign-in, approval-pending, blocked, and approved-user states.
- A monthly ledger that supports adding, editing, and deleting an item name and positive whole-won amount.
- Previous/next month navigation and an automatically calculated monthly total.
- A shared entry layer: the monthly-summary card's `+ 추가` button opens it for adding an item, and tapping an existing entry opens it for editing with a delete action.
- A Supabase `expense_entries` table with user-isolated RLS policies.
- Google OAuth login and logout; accounts become usable only after administrator approval.

## Completion criteria

- Unauthenticated visitors cannot read or change ledger data.
- An authenticated user sees only their own entries for the selected month.
- Create, edit, and delete operations update the displayed total accurately.
- Dates and food-purchase/meal categories are neither requested nor stored.
- The primary workflow is usable without horizontal scrolling on a small mobile viewport.

## Current phase

React shared-ledger page and Google OAuth access screens are complete. Google Provider credentials and redirect URLs still need Dashboard configuration.

## Confirmed product decisions

- Use Supabase for the database and accounts.
- Authentication uses email and password.
- Currency is KRW; amounts are positive integers and display with thousands separators plus `원`.
- Existing entries can be edited and deleted.
- The list itself has no persistent edit or delete buttons; tapping an entry opens its detail/edit layer.
- New entries are added from a compact `+ 추가` button inside the monthly summary card, not an always-visible inline form or a separate header button.
- The selected month is displayed prominently at the center of the header; smaller previous/next arrow controls flank it as secondary actions.
- Directly below the month header, show one emphasized summary card with a small `이번 달 사용 금액` label and a large KRW monthly total; do not add secondary statistics.
- Use a cool, modern navy/cobalt visual tone with a pale blue-gray background and white list surfaces; do not use an overall green/olive palette.
- Users navigate one month at a time using previous/next controls.
- Account scope includes logout and password reset, but excludes email change and account deletion.
- The app uses the Supabase project `ultrjuxpudxlfllovcqq`.
- The `account book.expense_entries` table is one shared ledger; it has no user ownership column.
- A Google OAuth user's first login automatically creates an `account book.members` row with `pending` status.
- Only members whose status is `active` may read or modify the shared ledger; `pending` and `blocked` users see access-state screens.

## Scope exclusions

- No transaction date, category, budget, analytics, multi-currency, receipt upload, email-change, or account-deletion feature in v1.

## Open items

- Configure the Google OAuth provider with its Client ID/Secret and add the application's local and production redirect URLs in the Supabase Dashboard.
- Manually change the two family members' `members.status` values to `active` after their first Google login.
- Decide deployment destination.

## Constraints

- Never expose Supabase service-role credentials in the client.
- Enable RLS for every exposed user-data table and enforce ownership with `auth.uid()`.
- Keep the experience focused on the monthly recording task rather than dashboard or marketing content.
- Preserve list density on mobile by placing secondary row actions in a modal layer, not beside every entry.
