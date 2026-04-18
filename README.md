# 🫀 Fatty Liver

Scan your meals with AI. Track cholesterol over time. Save your liver.

A camera-based nutrition scanner that uses Claude's vision to estimate cholesterol and other nutritional values from food photos, with persistent logging and 14-day trend tracking.

---

## Deploy to your phone in 5 minutes

### What you need

1. A **GitHub** account → [github.com](https://github.com) (free)
2. A **Vercel** account → [vercel.com](https://vercel.com) (free, sign up with GitHub)
3. An **Anthropic API key** → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (pay-as-you-go, each scan costs ~$0.01)

### Step 1: Get the code onto GitHub

1. Go to [github.com/new](https://github.com/new)
2. Name the repo `fatty-liver`, set it to **Public** (so your friend can fork it too), click **Create repository**
3. On your computer, open Terminal and run:

```bash
cd ~/Downloads/fatty-liver
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fatty-liver.git
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your actual GitHub username)*

### Step 2: Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `fatty-liver` repo
3. Under **Framework Preset**, select **Vite**
4. Click **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your API key (starts with `sk-ant-`)
5. Click **Deploy**

Vercel will give you a URL like `fatty-liver-abc123.vercel.app` — that's your app!

### Step 3: Install on your phone

1. Open the Vercel URL on your phone's browser (Safari on iPhone, Chrome on Android)
2. **iPhone**: Tap the Share button → "Add to Home Screen"
3. **Android**: Tap the three-dot menu → "Add to Home screen" or "Install app"

It now works like a native app — full screen, no browser bar.

### Share with a friend

Just send them the Vercel URL. They open it, add to home screen, and they have their own independent tracker. Each person's data stays on their own phone (stored in their browser's localStorage).

---

## How it works

- **Scan**: Take a photo or upload one from your gallery
- **Analyse**: Claude's vision identifies the foods and estimates nutritional values
- **Track**: Cholesterol is the hero metric, colour-coded green/amber/red
- **Trend**: 14-day chart shows your daily totals against the 300mg recommended limit
- **Streak**: Consecutive days under the cholesterol limit are counted

## Cost

Each meal scan calls the Anthropic API once. At current Sonnet pricing, each scan costs roughly **€0.01–0.02**. Logging 3 meals a day would cost about **€1–2/month**.

---

## Development

To run locally:

```bash
npm install
cp .env.example .env.local    # then add your API key
npm run dev
```

The dev server runs at `http://localhost:5173`. The Vite config proxies `/api` calls to the Vercel serverless function (which only works in production). For local dev, you can temporarily modify `src/App.jsx` to call the Anthropic API directly with your key in the request headers.

## Tech stack

- **React 18** + **Vite** (fast, simple build)
- **Recharts** (trend chart)
- **Vercel** (hosting + serverless API proxy)
- **Claude Sonnet** (vision-based nutrition analysis)
- **PWA** (installable on phone, works offline for viewing history)
- **localStorage** (all data stays on the user's device)
