# ⚠️ SETUP FOLDER — Ek Baar Ka Kaam

Yahan **GitHub Actions workflow files** rakhi hain jo auto-deploy
chalu karengi.

## Ye yahan kyun hain?

GitHub ki security policy hai: automated agents (jaise Arena) seedhe
`.github/workflows/` folder me file nahi bana sakte.

Ye jaan-boojh kar hai — warna koi bhi bot aapke repo me apna code
chala sakta tha. Isliye ye aakhri step aapko khud karna hoga.

## Kya karna hai

`setup/workflows/` ki dono files ko `.github/workflows/` me le jaana hai.

**PC se:**

```powershell
cd C:\Users\Rahul\Fcoy
git pull origin main

mkdir .github\workflows
move setup\workflows\deploy.yml  .github\workflows\
move setup\workflows\preview.yml .github\workflows\
rmdir setup\workflows
rmdir setup

git add -A
git commit -m "ci: activate deploy workflows"
git push origin main
```

**Ya GitHub website se** — DEPLOY_GUIDE.md me Tarika B dekhein.

## Uske baad

`DEPLOY_GUIDE.md` kholein → STEP 1 aur STEP 2 karein
(Firebase service account + secrets).

Phir hamesha ke liye automatic. 🚀
