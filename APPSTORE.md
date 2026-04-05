# App Store Submission Checklist — ZERO

Everything below requires human action (Mac, Xcode, Apple/Google accounts).
Code changes are already done — this is the deployment playbook.

---

## Prerequisites

- [ ] Apple Developer Program membership ($99/year) — [developer.apple.com](https://developer.apple.com)
- [ ] Mac with Xcode 15+ installed (free on Mac App Store)
- [ ] Node.js 18+ installed (`node -v`)
- [ ] Vercel account + project deployed (`debt-killer.vercel.app` or your domain)
- [ ] RevenueCat account — [app.revenuecat.com](https://app.revenuecat.com) (free to start)

---

## Step 1 — Environment Setup

```bash
cd /path/to/Debt-killer
npm install
```

---

## Step 2 — Gemini API Key (AI Advisor)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API key" → Create free key
3. In Vercel dashboard → your project → Settings → Environment Variables
4. Add: `GEMINI_API_KEY` = `AIza...`
5. Redeploy (Vercel auto-deploys on push, or trigger manually)

The AI advisor will now work for all premium users at $0/month until you hit the free tier limits (1M tokens/day).

---

## Step 3 — App Icon

The App Store requires a 1024×1024 PNG icon (no transparency, no rounded corners — Apple adds those).

```bash
# Resize your existing icon to 1024x1024
# Option A: macOS sips
sips -z 1024 1024 icons/icon-512.png --out icons/icon-1024.png

# Option B: ImageMagick
convert icons/icon-512.png -resize 1024x1024 icons/icon-1024.png
```

Then generate all required icon sizes:
```bash
# Place icon-1024.png in the root, then:
npx @capacitor/assets generate --ios --android
# This creates ios/App/App/Assets.xcassets/AppIcon.appiconset/ with all sizes
```

---

## Step 4 — Capacitor iOS Setup

```bash
# Add iOS platform (one-time)
npx cap add ios

# Copy web assets to native project
npx cap sync ios

# Open in Xcode
npx cap open ios
```

---

## Step 5 — Xcode Configuration

In Xcode (App > Signing & Capabilities tab):

- [ ] **Bundle Identifier:** `com.zerodebt.app`
- [ ] **Team:** Select your Apple Developer account
- [ ] **Deployment Target:** iOS 16.0+
- [ ] **Version:** `1.0`  **Build:** `1`
- [ ] Enable **Push Notifications** capability (optional, for future use)
- [ ] Enable **In-App Purchase** capability ← **required for RevenueCat**

In `Info.plist` (App > Info tab), add:
- `NSUserTrackingUsageDescription` — not needed (we don't track)
- `ITSAppUsesNonExemptEncryption` → `NO` (we use standard HTTPS only)

---

## Step 6 — RevenueCat + In-App Purchase

### 6A. Create product in App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → your app → Subscriptions
2. Create Subscription Group: "ZERO Pro"
3. Create product:
   - **Product ID:** `com.zerodebt.pro.monthly`
   - **Type:** Auto-Renewable Subscription
   - **Price:** $4.99/month
   - **Display Name:** "ZERO Pro"
   - **Description:** "AI debt advisor, premium guides, and more."

### 6B. Configure RevenueCat

1. In RevenueCat dashboard → New Project → "ZERO"
2. Add iOS app → paste App Store Connect API key
3. Create Entitlement: `pro`
4. Create Offering: `default` → add product `com.zerodebt.pro.monthly`
5. Copy your **RevenueCat Public App Key** (starts with `appl_`)

### 6C. Wire up purchase() in index.html

In `index.html`, find these constants near the top of the premium section:
```js
const RC_API_KEY    = '';   // ← paste your RevenueCat Public App Key here
const RC_PRODUCT_ID = '';   // ← paste 'com.zerodebt.pro.monthly'
```

Then in the `purchase()` function, uncomment the RevenueCat Purchases.js section
and remove the dev stub (the `isPremium = true; localStorage...` block).

For Capacitor (native), use `@revenuecat/purchases-capacitor` instead:
```js
import { Purchases } from '@revenuecat/purchases-capacitor';
await Purchases.configure({ apiKey: RC_API_KEY });
const result = await Purchases.purchaseStoreProduct({ product });
```

---

## Step 7 — App Store Connect Listing

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → New App
   - Platform: iOS
   - Bundle ID: `com.zerodebt.app`
   - SKU: `zero-debt-app`

2. **App Information:**
   - Name: `ZERO — Debt Elimination Engine`
   - Subtitle: `Pay off debt faster with AI`
   - Category: Finance
   - Content Rights: No third-party content

3. **Privacy Policy URL:** `https://debt-killer.vercel.app/privacy.html`

4. **App Description** (suggested):
   ```
   ZERO shows you exactly when you'll be debt-free — then our AI advisor helps you get there faster.

   ADD YOUR DEBTS
   Enter any debt: credit cards, student loans, car payments, medical bills. ZERO calculates your payoff date instantly.

   SEE YOUR PATH
   Watch the ring fill as you increase your monthly payment. See exactly how many months — and how many dollars — each extra payment saves.

   TWO PROVEN STRATEGIES
   Smart Pay (avalanche): attack the highest interest rate first. Saves the most money mathematically.
   Quick Wins (snowball): pay off smallest balances first. Proven to keep you motivated.

   ZERO PRO — AI DEBT ADVISOR
   Ask our AI anything about your debts. It knows your exact balances, rates, and payoff timeline. Get personalized advice in seconds.
   Includes: Balance Transfer Playbook, Rate Negotiation Scripts, Credit Score Accelerator.

   100% PRIVATE
   Your debt data never leaves your device. No account required. No ads. Ever.
   ```

5. **Keywords** (100 chars max):
   `debt payoff,debt tracker,loan payoff,credit card debt,debt free,avalanche,snowball,financial freedom`

6. **Screenshots** — Required sizes:
   - 6.7" iPhone (1290×2796): 3–10 screenshots
   - 6.1" iPhone (1179×2556): 3–10 screenshots
   
   Suggested shots (see Marketability section in plan):
   1. Mission ring with debt-free date
   2. Slider showing time saved
   3. Debt list
   4. Strategy toggle comparison
   5. Upgrade sheet
   6. AI chat with personalized advice

---

## Step 8 — Build & Submit

```bash
# Final sync before build
npx cap sync ios
```

In Xcode:
1. Select "Any iOS Device (arm64)" as the target
2. Product → Archive
3. Window → Organizer → Distribute App → App Store Connect
4. Upload (automatic signing recommended)

In App Store Connect:
1. Select the uploaded build
2. Fill in "What's New" (first version: leave blank or write brief intro)
3. Submit for Review

**Review time:** typically 24–48 hours for first submission.

---

## Step 9 — Android (Optional, future)

```bash
npx cap add android
npx cap sync android
npx cap open android   # Opens Android Studio
```

Android requires:
- Google Play Developer account ($25 one-time)
- Replace RevenueCat Capacitor config with Play billing product IDs
- Keystore for signing (keep this file safe — you can never change it)

---

## Quick Reference

| Item | Value |
|---|---|
| Bundle ID | `com.zerodebt.app` |
| App Name | `ZERO — Debt Elimination Engine` |
| Subtitle | `Pay off debt faster with AI` |
| Privacy URL | `https://debt-killer.vercel.app/privacy.html` |
| Price | Free + $4.99/month Pro |
| IAP Product ID | `com.zerodebt.pro.monthly` |
| Min iOS | 16.0 |
