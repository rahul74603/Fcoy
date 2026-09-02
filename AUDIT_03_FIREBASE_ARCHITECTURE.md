# FCOY ERP — FIREBASE ARCHITECTURE

## PROJECT CONFIGURATION

| Item | Value |
|------|-------|
| Firebase Project | `training-command-erp` |
| `.firebaserc` default | `training-command-erp` |
| Hosting URL | `https://training-command-erp.web.app` |
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Firebase Cloud Functions (Gen2, Node 20) |
| Database | Firestore |
| Storage | Firebase Storage |
| Auth | Firebase Authentication (email/password) |
| Region | `us-central1` |

## FIREBASE SERVICES USED

| Service | Used? | Purpose |
|---------|-------|---------|
| Firebase Auth | ✅ YES | Email/password login, 5 roles |
| Firestore | ✅ YES | Primary database, 44 collections |
| Firebase Storage | ✅ YES | Document uploads (Aadhaar, certificates) |
| Cloud Functions | ✅ YES | AI proxy (Groq/Gemini), staff provisioning |
| Firebase Hosting | ✅ YES | SPA deployment |
| Cloud Messaging | ❌ NO | No push notifications |
| Remote Config | ❌ NO | Not used |
| Analytics | ❌ NO | Not used |
| Crashlytics | ❌ NO | Not used |
| Realtime Database | ❌ NO | Not used |
| App Check | ❌ NO | Not used |

## CLOUD FUNCTIONS (5 callables)

| Function | Purpose | Auth | Secrets |
|----------|---------|------|---------|
| `aiGroq` | Groq chat completions proxy | CC role check | GROQ_API_KEY (×3) |
| `aiGemini` | Gemini generate content proxy | CC role check | GEMINI_API_KEY (×2) |
| `aiPineconeQuery` | Pinecone vector query (RAG) | CC role check | PINECONE_API_KEY, PINECONE_HOST |
| `aiPineconeUpsert` | Pinecone vector upsert | CC role check | PINECONE_API_KEY, PINECONE_HOST |
| `createStaffAccount` | Create Auth + Firestore profile | CC role check (Admin SDK) | None |

## FIRESTORE COLLECTIONS (44)

### Trainee Domain
`trainees`, `absentRecords`, `medicalRecords`, `fptRecords`, `weeklyTestRecords`

### Staff Domain
`staff`, `staff_attendance`, `staff_leave`, `staff_duty`, `staff_subjects`, `deputation_records`, `udhariRecords`

### Training Domain
`training_schedule`, `weeklyPrograms`, `subject_master`, `training_tests`

### Finance Domain
`mess_fund_collections`, `mess_fund_expenses`, `training_fund_collections`, `training_fund_expenses`, `training_fund_recoveries`, `general_fund_collections`, `general_fund_expenses`, `company_assets_collections`, `company_assets_expenses`, `company_assets_custom_items`, `training_custom_items`, `mess_custom_categories`, `collections`, `expenses`, `fund_transfers`, `recoveries`

### Inventory Domain
`item_master`, `issue_records`, `stock_ledgers`, `bills`, `vendors`, `vendor_entries`, `vendor_payments`

### Inspection Domain
`inspections`, `findings`

### System Domain
`users`, `config`, `unitConfig`, `batches`, `subscription`, `subscriptionPlans`, `subscriptionHistory`, `customers`, `customerSubscriptions`, `companyBridges`, `activity_logs`, `devTools`, `notifications`, `ustads`, `leave_types`, `duty_types`, `mess_boys`, `mess_boy_salaries`

## EXTERNAL APIs

| Service | Used By | Purpose | Auth |
|---------|---------|---------|------|
| Groq API | Cloud Functions | LLM chat completions | API key (server-side) |
| Gemini API | Cloud Functions | LLM content generation | API key (server-side) |
| Pinecone | Cloud Functions | Vector search (RAG) | API key (server-side) |
| TensorFlow USE | Frontend | Text embeddings for RAG | None (client-side model) |

## DEPLOYMENT PIPELINE

```
Push to main
  ↓
GitHub Actions (deploy.yml)
  ↓
npm ci → TypeScript check → Vite build
  ↓
Cloud Functions deploy (firebase deploy --only functions)
  ↓
Firebase Hosting deploy (FirebaseExtended/action-hosting-deploy)
  ↓
Live at https://training-command-erp.web.app
```

PR Preview also configured (`preview.yml`) — temporary URLs for PRs.
