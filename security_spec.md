# Firestore Security Specification — Mistrz Tabliczki

## 1. Data Invariants
1. **Verified User Only**: Every read/write requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Private User Pointers**: `/users/{userId}` can only be read (`get`) or written by `request.auth.uid == userId`. Collection `list` on `/users` is strictly denied (`false`) to prevent user enumeration.
3. **Master Gate Membership**: Access to `/groups/{groupId}`, `/groups/{groupId}/profiles/{profileId}`, and `/groups/{groupId}/feed/{feedId}` requires an active membership document at `/groups/{groupId}/members/$(request.auth.uid)`.
4. **No Blanket List Scraping**: Collection-wide `list` is disabled (`false`) across `/users`, `/groups`, `/groups/{groupId}/members`, `/groups/{groupId}/profiles`, `/groups/{groupId}/feed`, `/joinCodes`, and `/schoolDirectory`. Clients resolve exact document paths via `/users/{uid}`, `groups/{groupId}.profileIds` (max 50 entries), and `/schoolDirectory/global` (non-PII school + class names only).
5. **Privilege Escalation Prevention**: A member document with `role == 'owner'` can only be created atomically alongside `/groups/{groupId}` where `ownerUid == request.auth.uid`. Any user joining an existing group via `/joinCodes/{code}` can only create a `role == 'member'` record for their own `request.auth.uid`.
6. **Temporal Integrity & Immutability**: `createdAt`, `joinedAt`, and `updatedAt` are strictly validated against `request.time`. `ownerUid`, `uid`, `groupId`, and `createdAt` are immutable after creation.
7. **Volumetric & Schema Enforcement**: All IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), strings are length-bounded (`schoolName <= 64`, `className <= 24`), arrays (`profileIds <= 50`, `sessions <= 40`, `items <= 40`, `customThemes <= 20`) are strictly bounded, and `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)` block shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated read** of `/users/u1` (`request.auth == null`).
2. **Unverified email write** creating `/users/u1` when `email_verified == false`.
3. **Cross-user read/spoof** reading or writing `/users/victimUid` while signed in as `attackerUid`.
4. **Blanket collection list** on `/groups` or `/groups/grp1/profiles`.
5. **Non-member read** of `/groups/grp1/profiles/user-1` when `/groups/grp1/members/attackerUid` does not exist.
6. **Self-assigned owner escalation**: creating `/groups/grp1/members/attackerUid` with `{ role: 'owner' }` on an existing group owned by `victimUid`.
7. **Shadow field ("ghost field") injection**: creating `/users/u1` with `{ ..., isAdmin: true }`.
8. **Backdated timestamp**: writing `/groups/grp1/profiles/user-1` with `updatedAt` != `request.time`.
9. **ID poisoning**: writing `/groups/../../../../etc` or a 1,500-char `profileId`.
10. **Owner hijack update**: updating `/groups/grp1` to change `ownerUid` from `victimUid` to `attackerUid`.
11. **Oversized/corrupt XP or sessions array**: updating `/groups/grp1/profiles/user-1` with `xp: -500` or `sessions` array > 40 items.
12. **Join code enumeration**: attempting a `list` query on `/joinCodes`.
