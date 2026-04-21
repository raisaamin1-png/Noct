# noct · sleep tracker

A personal sleep tracker built as a React PWA. Runs in your browser, installs to iPhone Home Screen, stores data locally on your device.

---

## 📱 Get it on your iPhone (the full guide)

### Step 1 — Deploy it to the web (free, ~10 min)

You'll use **Vercel**, which hosts small sites for free. No credit card needed.

**1a. Create a GitHub account** if you don't have one at [github.com](https://github.com).

**1b. Create a new repository:**
- Click the **+** in the top-right → **New repository**
- Name it `noct-sleep-tracker`
- Keep it public (or private, both work)
- Click **Create repository**

**1c. Upload these files to the repo:**
- On the new repo page, click **uploading an existing file**
- Drag the entire unzipped `noct-app` folder contents into the browser
- Scroll down, click **Commit changes**

**1d. Deploy via Vercel:**
- Go to [vercel.com](https://vercel.com) → **Sign up with GitHub**
- Click **Add New** → **Project**
- Find `noct-sleep-tracker` in the list → **Import**
- Leave all settings as-is (Vercel auto-detects Vite)
- Click **Deploy**
- Wait ~1 minute. You'll get a URL like `noct-sleep-tracker-abc.vercel.app`

### Step 2 — Add to iPhone Home Screen

1. Open the Vercel URL **in Safari** (this is important — Chrome won't work for home-screen installs on iOS)
2. Tap the **Share** button (the square with an arrow, bottom center)
3. Scroll down → **Add to Home Screen**
4. Tap **Add**

Done. You now have a 🌙 icon on your home screen. When you tap it:
- Opens full-screen with no browser bars
- Works offline after first load
- Your sleep data persists on your phone
- Feels like a native app

### Step 3 — Use it

- **Tap the icon** before bed → tap "start sleeping" → answer the 3 quick questions → timer starts
- Leave your phone on overnight (the timer keeps running even if you close the app)
- **Tap the icon** when you wake up → tap "wake up" → answer 2 morning questions
- Check the **insights** tab for your sleep debt, rhythm chart, and analysis

---

## 💡 Tips for reliable iPhone use

**Timer keeps running even if you close the app** — bedtime is stored, duration is calculated from the stored start time. No background process needed.

**Data stays on your phone.** It's stored in Safari's localStorage for the app. It won't sync across devices, but it also won't leak anywhere.

**If you clear Safari data, you'll lose your logs.** If this matters to you, use the history tab occasionally to note your patterns elsewhere.

**To update the app later:** push changes to GitHub — Vercel auto-redeploys within 30 seconds, and your installed home-screen icon automatically gets the new version.

---

## 🛠 Running locally (optional)

```bash
npm install
npm run dev
```

Then open the `http://localhost:5173` URL on your phone (phone must be on same Wi-Fi). Go to that URL in Safari and Add to Home Screen for dev-mode use.

## Build for production

```bash
npm run build
```

Output is in `dist/` — deploy that folder anywhere (Vercel, Netlify, Cloudflare Pages, GitHub Pages all work).

---

## Alternative: deploy via Netlify

If you prefer Netlify over Vercel:
1. Go to [netlify.com](https://netlify.com) → sign up with GitHub
2. **Add new site** → **Import from Git** → pick your repo
3. Build command: `npm run build`, Publish directory: `dist`
4. Deploy

Same result — you get a URL you can open in Safari and add to Home Screen.
