# Little Monkey Cafe Dining — Upstash Redis Free-Tier Setup Guide

## 1. Overview

Little Monkey Cafe Dining uses **Upstash Redis** as its production shared state layer on Vercel. Upstash provides a serverless Redis database accessible via a stateless HTTPS REST API, which eliminates TCP connection pool exhaustion and fits Vercel's serverless scaling.

The Upstash Free Tier is 100% free forever and provides:
- **Storage**: 256 MB (Little Monkey Dining uses < 1 MB)
- **Commands**: 500,000 commands per month (16,000/day)
- **Bandwidth**: 10 GB per month
- **Throughput**: Up to 10,000 requests per second burst limit
- **Cost**: $0.00 / month with no credit card required for sign-up

---

## 2. Step-by-Step Account and Database Creation

### Step 1: Sign Up for Upstash
1. Open your web browser and navigate to:
   `https://console.upstash.com`
2. Sign up using GitHub, Google, or your email address.
3. Complete email verification if prompted.

### Step 2: Create a Redis Database
1. Once in the Upstash Console, click the **Create Database** button.
2. In the configuration modal, set the following:
   - **Name**: `little-monkey-dining-prod`
   - **Type**: Select **Regional** (standard lowest latency for a single geographical market).
   - **Region**: Choose the region closest to Little Monkey Cafe in Warangal, Telangana, India and your Vercel deployment region:
     - **Recommended**: `AWS ap-south-1 (Mumbai)`
     - Alternative (if deploying Vercel in US): `AWS us-east-1 (N. Virginia)`
   - **Primary Store**: In-Memory (default)
   - **Persistence**: Enabled (AOF / disk backup, default)
   - **TLS (SSL)**: Enabled (mandatory for HTTPS REST API)
   - **Eviction**: Leave disabled or volatile-lru (the application sets explicit TTLs on all keys).
3. Click **Create**. Your database is provisioned instantly (under 5 seconds).

### Step 3: Copy REST API Credentials
1. On your newly created database dashboard, scroll down to the **REST API** section.
2. Ensure the **JavaScript (Fetch)** tab is selected.
3. You will see two configuration values:
   - `UPSTASH_REDIS_REST_URL`: e.g. `https://crisp-fawn-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN`: e.g. `AX...your_secret_token...`
4. Copy these two values securely. Do not share them publicly or commit them to source control.

---

## 3. Configuring Vercel Environment Variables

When deploying the application to Vercel:

1. Open your project in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings** -> **Environment Variables**.
3. Add the following two environment variables for **Production** (and **Preview** if desired):

| Variable Name | Value | Environments | Notes |
| :--- | :--- | :--- | :--- |
| `UPSTASH_REDIS_REST_URL` | `https://crisp-fawn-12345.upstash.io` | Production, Preview | Upstash HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | `AX...your_secret_token...` | Production, Preview | Upstash bearer token |
| `STORAGE_PROVIDER` | `auto` (or `redis`) | Production, Preview | Storage provider selection |

4. Ensure your Vercel Serverless Function region is set to **Mumbai (bom1 / ap-south-1)** to minimize round-trip latency to Upstash:
   - In `vercel.json` (or Project Settings -> Functions): `regions: ["bom1"]`.
   - Typical latency between Vercel `bom1` and Upstash `ap-south-1` is 2ms - 6ms.

---

## 4. Local Development Configuration (Optional)

In local development, the application automatically uses `FileStorageProvider` (`.dining_sessions.json` and in-memory caches) so that developers can run and test offline without needing an active internet connection.

If you wish to test directly against your Upstash Redis database locally:
1. Open `.env` in `C:\Users\chava\.gemini\antigravity\scratch\dine-in\.env`.
2. Add your Upstash credentials:
   ```env
   UPSTASH_REDIS_REST_URL=https://crisp-fawn-12345.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AX...your_secret_token...
   STORAGE_PROVIDER=redis
   ```
3. Run the automated test suite to verify live connectivity:
   ```powershell
   node --experimental-strip-types scripts/test_redis_storage_suite.mjs
   ```

---

## 5. Free-Tier Monitoring and Usage Tracking

### Daily Command Budget
- Free tier limit: 500,000 commands/month (~16,000 commands/day).
- Estimated Little Monkey Cafe daily usage:
  - 10 tables * 4 turns per day = 40 dining sessions.
  - Per session commands:
    - 1 `SET NX` (proof consumption)
    - 1 `SET EX` (session creation)
    - ~10 `GET` (session validation on menu/order actions)
    - 1 `LPUSH` + 1 `LTRIM` (audit logging)
  - Total per session: ~14 Redis commands.
  - 40 sessions * 14 commands = **560 commands/day** (under 3.5% of free tier daily limit).

### Viewing Usage in Upstash Console
1. Open `https://console.upstash.com`.
2. Click your database `little-monkey-dining-prod`.
3. The dashboard displays real-time charts:
   - **Daily Command Count**: Tracks daily calls against the 500k monthly limit.
   - **Data Size**: Storage in bytes (typically under 200 KB for Little Monkey Cafe).
   - **Throughput & Latency**: P99 and P50 roundtrip response times.

### Free-Tier Protections Built Into Code
1. **Explicit Key TTLs**: Every session key expires in 900 seconds; every spent proof token expires in 300 seconds. No old keys accumulate over time.
2. **Capped Audit Logs**: The audit log list is capped at 1,000 entries using atomic `LTRIM 0 999` on every append, preventing unbounded storage growth.
3. **No Polling Loops**: Frontend uses client-side timer countdowns rather than constant server polling.
