# ZERO — Debt Elimination Engine

A mobile-first PWA and native iOS/Android app that gives users a day-by-day debt payoff plan, an AI advisor, and a real freedom date.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Single-page PWA (`index.html`) — HTML/CSS/JS, no framework |
| AI proxy | Vercel Edge Function (`api/chat.js`) → Google Gemini |
| Hosting | Vercel |
| Native wrapper | Capacitor v6 (iOS + Android) |
| Payments | RevenueCat + Apple/Google IAP |

## Local Development

```bash
npm install
npx vercel dev      # starts local dev server with Edge Function support
```

Open `http://localhost:3000`.

## Environment Variables

Set these in the Vercel dashboard (Settings → Environment Variables):

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key — get free at [aistudio.google.com](https://aistudio.google.com) |
| `ALLOWED_ORIGIN` | CORS allowed origin, e.g. `https://debt-killer.vercel.app` (defaults to that if unset) |

## In-App Configuration

Two constants in `index.html` must be set before payments work:

```js
// around line 2077
const RC_API_KEY    = '';  // RevenueCat public app key
const RC_PRODUCT_ID = '';  // Product ID, e.g. 'dk_pro_monthly'
```

And for the human counseling CTA:

```js
// around line 2429
const BOOKING_URL = '';    // Calendly / Cal.com link
```

## Regenerating Splash Screens

If you update the app icon (`icons/icon-1024.png`), regenerate all iOS splash PNGs:

```bash
node scripts/gen-splash.js
```

Outputs 9 PNG files to `/icons/splash-*.png` covering iPhone SE through 15 Pro Max.

## Native iOS / Android Build

See **[APPSTORE.md](./APPSTORE.md)** for the full step-by-step guide, including:
- Xcode setup and code signing
- RevenueCat + In-App Purchase configuration
- App Store Connect listing and submission

Quick reference:
```bash
npx cap add ios          # first-time iOS setup (requires Mac + Xcode 15+)
npx cap sync ios         # sync web assets to native project
npx cap open ios         # open in Xcode
```

## Project Structure

```
/
├── index.html          # entire app (HTML + CSS + JS)
├── api/chat.js         # Vercel Edge Function — Gemini proxy
├── sw.js               # Service worker (cache-first PWA shell)
├── manifest.json       # PWA manifest
├── offline.html        # Offline fallback page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── icons/              # App icons + iOS splash screens
├── scripts/
│   └── gen-splash.js   # Generates iOS splash PNGs using sharp
├── capacitor.config.json
├── package.json
└── APPSTORE.md         # Native build + App Store submission guide
```
