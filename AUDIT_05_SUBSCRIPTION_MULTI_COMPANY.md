# FCOY ERP — SUBSCRIPTION & MULTI-COMPANY

## MULTI-COMPANY ARCHITECTURE

### Model: Project-Level Isolation

Each company = separate Firebase project. Master app (`training-command-erp`) is the owner/billing console.

| Aspect | Implementation | Status |
|--------|---------------|--------|
| Company identity | `unitConfig/main` document | ✅ |
| Data isolation | Separate Firebase projects | ✅ |
| Cross-company access | Impossible | ✅ |
| Company creation | `customers.api.ts` | ✅ |
| Company bridge | `companyBridge.api.ts` | ✅ |
| Company deletion | NOT IMPLEMENTED | ❌ |
| Company suspension | NOT IMPLEMENTED | ❌ |

## SUBSCRIPTION SYSTEM

### Document Path
`subscription/current` → one per Firebase project (per company).

### Company-Level: YES
All roles (CC/Clerk/QM/Ustad/SO) share ONE subscription per company.

### Who Can Do What

| Action | Who | Enforcement |
|--------|-----|-------------|
| View | All staff | Firestore rules |
| Assign/renew | CC only | Firestore rules |
| Cancel | CC only | Firestore rules |
| Modify plans | CC only | Firestore rules |
| Renew via owner key | Owner (lock screen) | Client-side |
| Push to company app | CC (via bridge) | Bridge API |

### Enforcement: CLIENT-SIDE ONLY
SubscriptionGate.tsx is a React component. Server-side enforcement (Firestore rules checking subscription) is NOT implemented. Bypassable by modifying JS.

### SO and Subscription
SO has NO subscription authority. Only CC manages subscriptions.
