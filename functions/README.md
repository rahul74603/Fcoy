# FCOY — Server-side AI proxy (Cloud Functions)

The browser calls Firebase **Callable Functions** in this folder. Cloud-AI
secrets (Groq / Gemini / Pinecone) live **only here**, in Google Secret
Manager — they are never shipped to the browser.

## What the functions do

| Callable       | Forwards to          | Input (validated)                                  | Output (no secrets)        |
|----------------|----------------------|----------------------------------------------------|----------------------------|
| `aiGroq`       | Groq Chat Completions| `{ messages, temperature?, maxTokens?, responseFormat? }` | `{ content, model }` |
| `aiGemini`     | Gemini generateContent | `{ contents, generationConfig?, systemInstruction? }` | provider JSON body |
| `aiPineconeQuery` | Pinecone `/query` | `{ vector: number[], topK? }`                       | `{ matches[] }` (metadata only) |
| `aiPineconeUpsert`| Pinecone `/vectors/upsert` | `{ vectors[] }`                            | `{ upserted }`           |

Every function:

1. requires a signed-in Firebase user (`request.auth.uid`),
2. reads the user's `users/{uid}` Firestore doc **server-side** with Admin SDK,
3. rejects deactivated accounts,
4. enforces that the role is **Company Commander** (configurable via the
   `AI_ALLOWED_ROLE` env var),
5. only forwards to the external AI provider — it is **not** a Firestore or
   database proxy. All client database access still goes through the client
   SDK and is governed by `firestore.rules`.

## Deployment (run on a machine with firebase-tools + billing/Blaze for outbound calls)

```bash
# one-time: install
cd functions && npm install

# set secrets (prompts for the value; stored encrypted in Secret Manager)
firebase functions:secrets:set GROQ_API_KEY
firebase functions:secrets:set GEMINI_API_KEY        # optional
firebase functions:secrets:set PINECONE_API_KEY      # optional, RAG
firebase functions:secrets:set PINECONE_HOST         # optional, RAG, e.g. https://index-xxx.svc.pinecone.io

# optional non-secret config
firebase functions:secrets:set GROQ_MODEL            # default llama-3.3-70b-versatile
firebase functions:secrets:set GEMINI_MODEL          # default gemini-flash-latest

# deploy
firebase deploy --only functions
```

After deploy, the frontend automatically uses the functions (region
`us-central1` by default; override with the public, non-secret
`VITE_FUNCTIONS_REGION` if you deploy elsewhere).

### Local emulation

```bash
# root
firebase emulators:start --only functions,firestore,storage,auth
# in another shell, run the app against the emulator with:
#   VITE_USE_FUNCTIONS_EMULATOR=true
```

## Frontend behavior

- **Production:** the app calls the deployed callables. No Groq/Gemini/Pinecone
  key is present in the browser bundle. If functions aren't reachable, the
  built-in **local ERP** command engine still answers queries without any cloud
  key.
- **Dev only:** a Vite dev server may opt into bundled keys by setting
  `VITE_AI_ALLOW_BROWSER_KEYS=true` *and* running `vite` dev
  (`import.meta.env.DEV`). This path is never compiled into a production
  build. Pinecone never accepts a browser key.

## Security rule tests (runtime)

The emulator test suites live in `functions/test/`. They require Java +
firebase-tools and are run later on the office machine:

```bash
cd functions && npm install
firebase emulators:exec --project fcoy-test 'npm test'
```

They are **prepared here, not executed** in this environment.
