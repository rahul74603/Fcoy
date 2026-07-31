# Cloudinary Document Upload — Implementation Report (31-July-2026)

## Task (owner decision)
Firebase Storage ka naya bucket Blaze (card) plan maangta hai (Google policy change 30-Oct-2024) — Spark par provision hi nahi hota, isliye document-upload feature kabhi production me chala hi nahi. Owner ne **Cloudinary free plan (no card)** choose kiya, with: ① purane batch ka data **kabhi delete nahi** ② photo **aur** PDF dono ka compressor.

## Files Changed (Rule-4)
| File | Change | Kyun |
|---|---|---|
| ➕ `src/features/students/cloudinaryUpload.ts` | NEW — unsigned-preset upload client (`/auto/upload`, images+PDF same endpoint) + `isCloudinaryConfigured()` guard | Firebase Storage ka free replacement |
| ➕ `src/features/students/fileCompress.ts` | NEW — `prepareFileForUpload()`: photo canvas-compress (max 1600px, JPEG q0.78, skip <300KB), PDF raster-rebuild (max 1500px/page, JPEG q0.62, skip <1.2MB, ≤50 pages) | Free quota bachana + fast app |
| 🔄 `src/features/students/DocumentVerificationScreen.tsx` | Sirf upload internals: firebase/storage import → 2 naye utils; loop me compress→upload; env-missing guard; error message me asli reason; input cap 500KB → 20MB (compressor ke bharose); hint text update | Feature revive, UX honest |
| 🔄 `src/vite-env.d.ts` | `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` typings | TS strict |
| 🔄 `.env.example` | 2 blank keys + comments (real values sirf local `.env` me — gitignored) | Convention |
| 🔄 `package.json` + lock | `pdf-lib ^1.17.1`, `pdfjs-dist ^4.10.38` | PDF compressor engine |

## Data-model impact: ZERO
`FileInfo { fileName, fileUrl, fileSize, fileType, uploadedAt }` same raha — Cloudinary ki `secure_url` wahi `fileUrl` field me aati hai. Koi Firestore schema/view/download/preview change nahi. Koi existing feature remove/change nahi hua (Golden Rule).

## No-Delete Design (owner rule ①)
- Code me Cloudinary **delete API hai hi nahi** — app se koi bhi file server se delete kar hi nahi sakta.
- UI se file-entry hatane par sirf Firestore record hatta hai; actual file Cloudinary me **hamesha salamat** (manual cleanup kabhi chahiye to sirf owner dashboard se).

## Compressor Safety Rules
1. Chhoti file (photo <300KB, PDF <1.2MB) = asli pass-through.
2. Compressed output asli se **badi** ho = asli pass-through.
3. Koi bhi compressor error (corrupt PDF/HEIC) = asli pass-through (upload kabhi block nahi).
4. `pdfjs-dist`/`pdf-lib` **lazy dynamic-import** — sirf PDF compress karte waqt load; main bundle same.

## Verification
- `tsc --noEmit` → PASS (0 errors)
- `vite build` → PASS (12.94s); chunks: `pdf-*.js 365KB` + `pdf.worker 1.37MB` (dono lazy, on-demand)

## Security Notes (unsigned preset model)
- API secret client me **kabhi nahi** aata. Cloud name + preset secret nahi hain — unse sirf **upload** possible hai (read/delete nahi).
- Preset restrictions (neeche Step-5 me) abuse ko practically neuter karte hain: format whitelist + size cap + overwrite off.
- `.env` kabhi commit nahi hoti (gitignore line 40-42).

## Rollback
`git revert <this-commit>` — Firebase Storage code wapas aa jayega. Cloudinary me padi files unaffected. (Production rollback active tabhi meaningful jab deploy ho.)

---

## 🔧 STEP-5: OWNER SETUP (5 minute — ek hi baar)
1. **https://cloudinary.com/users/register_free** kholo → apna `trainingcommand.erp@gmail.com` se free account banao (koi card nahi maangega).
2. Dashboard kholo → upar **Cloud Name** dikhega (jaise `dxyz123ab`) — note kar lo.
3. Left me **Settings (gear)** → **Upload** tab → **Upload presets** section → **"Add upload preset"**:
   - **Signing Mode: `Unsigned`** ⚠️ (sabse zaroori — warna browser upload fail hoga)
   - **Folder:** `fcoy-documents`
   - **Use filename / Unique filename:** Yes / **Overwrite:** No
   - **Allowed formats:** `jpg, png, webp, pdf`
   - **Max file size:** `10485760` (10MB)
   - Save → preset ka **naam** note kar lo (jaise `fcoy_unsigned_docs`)
4. Apni machine par `Fcoy/.env` file me 2 lines daalo (duplicate na ho):
   ```
   VITE_CLOUDINARY_CLOUD_NAME=tumhara-cloud-name
   VITE_CLOUDINARY_UPLOAD_PRESET=tumhara-preset-naam
   ```
5. `npm run dev` restart → Trainee Documents screen → ek photo/PDF upload karke test. Console me file ka Cloudinary URL dikhega; Cloudinary dashboard → Media Library me `fcoy-documents` folder me file aana chahiye.

## Test Checklist (owner ke saath)
- [ ] Photo 3–8MB upload → ~100–300KB ban ke upload (message me final size dekho)
- [ ] Scan PDF 5–10MB → compress hoke upload (first time 2–4s extra — engine load hota hai)
- [ ] `.env` khali ho to click par hi clear setup-error aaye (partial fail nahi)
- [ ] Upload ke baad preview (Eye) + new-tab (ExternalLink) dono khulein
- [ ] **Deploy note:** hosting redeploy (`npm run build` + `firebase deploy --only hosting`) ke baad live par bhi yehi `.env` values build me shamil hongi — verify ek upload live par bhi.

## Known Limitation
- Text-heavy digital PDFs compress karne par image-PDF ban jaati hain (selectable text khatam). Hamara use-case scans hai, isliye acceptable. Chhoti PDFs untouched rehti hain.
