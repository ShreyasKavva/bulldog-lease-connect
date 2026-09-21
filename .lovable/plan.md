# Full backend + UI audit with 10 test accounts

A systematic sweep of every flow on the site, driven by 10 separate throwaway accounts running against the live app in the sandbox, plus direct database checks behind each action.

## Accounts

10 accounts, auto-confirmed, mixed on purpose so the checks cover real differences:
- 4 with school (.edu) emails at different schools — should get the verified badge and the right school
- 3 with plain (non-.edu) emails — should get no badge and no school assigned
- 2 that go through Roommate Search only
- 1 admin-privileged account for the admin screens

All accounts and every row they create get deleted at the end. Real listings and the real users' data are never touched.

## What gets checked

**Accounts and sign-in**
Sign up, sign out, sign back in, wrong password, password reset, Google button present, onboarding refusing to finish without a school, editing name and university afterwards, verified badge granted only for .edu.

**Posting a sublease**
Every field and every button in the post flow: photos, price, dates, bedrooms, amenities, roommate preferences. Bad input rejected (negative or zero price, end date before start, blank title). Edit, bump, mark filled/sold, deactivate, re-activate, delete.

**Browsing and finding**
Home rails (recently viewed, near you, school-scoped rows), Explore campuses, the Filters button, /browse grid / list / map, every filter and the zero-result recovery, sort, search, campus pages, the schools directory, saved searches.

**Saving**
Heart from every surface, count moves exactly one each way, never negative, Saved page, unsave.

**Messaging**
Start a conversation from a listing, from a profile, from a roommate post; send, read receipts, unread badge, notifications, the composer on mobile, no duplicate-conversation errors, and that messaging stays free.

**Roommate Search**
Post, edit, close, upvote (no double counting), express interest, campus filter across all schools, closed posts hidden from everyone but the author.

**Tours, reviews, reports**
Book and cancel a tour, owner-only availability, review only after real contact, report a listing, admin sees the report.

**Admin**
Admin screens load, ban/unban works, non-admin accounts cannot reach any of it.

**Security probes (the point of using separate accounts)**
Each account tries to touch another account's data directly: edit someone else's listing, read someone else's messages, self-grant the verified badge, self-feature a listing, type its own view/save counts, insert a notify signup with someone else's email. Every one must be refused.

## Known issue already on the list

The `campus_notify_signups` insert policy accepts any email and any account with no ownership check. It is confirmed and still open. I will re-confirm it in this sweep and include the fix in the report rather than patching silently.

## Output

A single report: what passed, every bug found with the exact reproduction, severity, and the fix. I will not ship fixes without showing you the list first, unless the issue is a live security hole — those I will name clearly and ask before changing anything that affects who can read or write data.

## Technical notes

- Playwright against the sandbox dev server at localhost:8080 for every click; direct SQL for the state behind each click.
- Accounts created through the auth admin API with auto-confirm, named with a shared prefix so cleanup is complete.
- Cleanup order matters: conversations and messages tied to test rows go first, then the rows, then the accounts.
- No schema, RLS, or policy change is made during the audit itself.
