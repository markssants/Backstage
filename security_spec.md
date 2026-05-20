# Security Specification for Backstage

## Data Invariants
1. A user can only see their own profile.
2. Designers and Contractors can only see events they are part of.
3. Arts, DJ Assets, Documents, and Payments are sub-collections of an Event. Access is inherited from the Event membership.
4. Only the Designer of an event can update Art status, but the Contractor can create Art requests.
5. Payments can only be viewed by the Contractor and Designer of that event.

## The Dirty Dozen (Potential Attacks)
1. User A tries to read User B's profile.
2. User A tries to link an Event to User B as a designer without permission.
3. User A tries to delete an Event created by the admin or another designer.
4. User A tries to create an Art document for an Event they don't belong to.
5. User A tries to change the `paid` status of a payment they don't own.
6. User A injects a 1MB string into the `musicName` of a DJ Asset.
7. User A tries to set their role to `admin` if such role existed (not in current scope, but should be blocked).
8. User A tries to move an Art from `done` to `todo` after completion if locked.
9. User A tries to read all documents in `events` collection without being a member.
10. User A tries to overwrite the `logoUrl` of a party they aren't part of.
11. User A tries to spoof `createdAt` to a date in the past.
12. User A tries to list all `users` to scrape emails.

## Test Runner (Draft)
```typescript
// firestore.rules.test.ts (conceptual)
// Test 1: Deny unauthorized read of user profile
// Test 2: Deny list of events if not signed in
// Test 3: Deny creation of art if eventId is not authorized
```
