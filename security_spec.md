# Firebase Security Specification

## Data Invariants
- A user document must have a valid `accountID` (numeric string, max 10 chars).
- User status can only be `pending`, `approved`, or `rejected`.
- Predictions must follow the `m1-m50` schema.
- Timestamps must be server-validated.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Spoofing**: Creating a user with a different `accountID` than the document ID.
2. **Schema Poisoning**: Adding a `role` field to a user document.
3. **Invalid State Transition**: User attempting to self-approve.
4. **Invalid Type**: Sending a boolean for `accountID`.
5. **Denial of Wallet**: Enormous string in status field.
6. **Value Poisoning**: Sending a 1MB string in prediction data.
7. **Timestamp Fraud**: Sending a future date for `updatedAt`.
8. **Unauthorized List**: Attempting to list all users.
9. **Deletion Attempt**: User attempting to delete their own account.
10. **ID Poisoning**: Injecting 1KB document ID.
11. **Grid Corruption**: Sending prediction data without all `m1-m50` keys.
12. **Malicious Override**: Overwriting the `updatedAt` with an old timestamp.

## Test Runner (Draft)
A `firestore.rules.test.ts` will be created to verify these rejections.
