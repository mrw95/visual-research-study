# Vercel Deploy — Anuradhapura Survey

## 404 error (`DEPLOYMENT_NOT_FOUND`) — meka mokakda?

**Project eka deploy wela ne** — link eka thiyenawa ne nisa 404 enne.

GitHub repo eka check kara: `https://github.com/mrw95/visual-research-study` — **404** = repo create karala ne.

---

## Quick fix — `DEPLOY-NOW.bat` run karanna

1. `DEPLOY-NOW.bat` double-click
2. Steps A, B, C follow karanna (browser open wenne)

---

## Step 1 — GitHub repo (empty)

1. Browser: https://github.com/new
2. Repository name: **visual-research-study**
3. **Public** or Private — either OK
4. README add karanna **EPAA** — empty repo
5. **Create repository**

## Step 2 — Files upload karanna

**Option A — bat file (easy)**

1. `PUSH-TO-GITHUB.bat` double-click karanna
2. GitHub login ask unoth browser eken login karanna

**Option B — manual upload**

1. GitHub repo page → **Add file** → **Upload files**
2. Me folder eke **salli files** drag karanna (`visual-research-study` folder)
3. **Commit changes**

---

## Step 3 — Vercel deploy

1. https://vercel.com/login → GitHub account eken login
2. **Add New…** → **Project**
3. **visual-research-study** repo select karanna → **Import**
4. Settings default wadi — **Deploy** click karanna
5. 1–2 minutes wait karanna

**Link labenne:**
`https://visual-research-study.vercel.app/`  
(name change wenna puluwan)

---

## Step 4 — Responses save karanna (IMPORTANT)

Vercel eke deploy unama survey run wenne, eka **responses save wenne ne** Redis nathnam.

1. Vercel → project → **Storage** tab
2. **Create Database** → **Upstash Redis** → **Continue**
3. **Connect to visual-research-study** project
4. **Deployments** → latest → **⋯** → **Redeploy**

---

## Step 5 — Admin key (optional)

Vercel → **Settings** → **Environment Variables**

| Name | Value |
|------|-------|
| `ADMIN_KEY` | your-secret-password |

Redeploy karanna.

---

## Links

| Page | URL |
|------|-----|
| **Share karanna (participants)** | `https://YOUR-APP.vercel.app/` |
| **Results balanna (oya)** | `https://YOUR-APP.vercel.app/admin` |

Default admin key: **research2026**

---

## WhatsApp eken share karanna

```
වේගයෙන් සංවර්ධනය වන අනුරාධපුර නගරය — 
පහළ link එක open කරලා විකල්ප 3ක් තෝරන්න 👇
https://visual-research-study.vercel.app/
```

---

## Problems?

| Problem | Fix |
|---------|-----|
| Push failed | GitHub login / repo create karala thiyenawada check |
| Page blank | Vercel deploy complete wela thiyenawada check |
| Submit wenne ne | Upstash Redis connect + redeploy |
| Images penne ne | `images/` folder eke 1.png–6.png thiyenawada check |
