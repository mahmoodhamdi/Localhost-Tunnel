# Credentials & Environment Variables Guide

This document lists all credentials and environment variables needed for the Localhost Tunnel project.

---

## Ready-to-Use Credentials

### Generated Secrets (Copy these!)

```env
# Authentication Secret (generated - ready to use)
AUTH_SECRET="XnkgMaETat0AYCjcK1sVAjJEw0HWGgOGjLlxJbxrVLk="

# Encryption Master Key (generated - ready to use, 64 hex chars)
ENCRYPTION_MASTER_KEY="8f2f3da484b62d7214e00614c6e38859713767680c5f128c7e67e687bee44951"
```

### Firebase Configuration (from your service account)

```env
# Firebase Project Info (from localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json)
NEXT_PUBLIC_FIREBASE_PROJECT_ID="localhosttunnel"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="localhosttunnel.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="localhosttunnel.appspot.com"

# Server-side Firebase (path to your service account file)
FIREBASE_SERVICE_ACCOUNT_PATH="../../localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json"
```

### Default Configuration

```env
# Database
DATABASE_URL="file:./dev.db"

# Tunnel
TUNNEL_DOMAIN="localhost"
TUNNEL_PORT=7000
NEXT_PUBLIC_TUNNEL_DOMAIN="localhost:3000"

# Auth URL
AUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

---

## What You Need to Get from Firebase Console

Go to [Firebase Console](https://console.firebase.google.com/) > Project **localhosttunnel** > Project Settings

### 1. Web App Config (General tab)
You need to register a Web App first, then copy these values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."           # Get from Firebase Console
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."   # Get from Firebase Console
NEXT_PUBLIC_FIREBASE_APP_ID="1:..."              # Get from Firebase Console
```

### 2. VAPID Key (Cloud Messaging tab)
Go to **Cloud Messaging** > **Web Push certificates** > Generate key pair

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY="BK..."           # Get from Firebase Console
```

---

## What You Need to Get from Google Cloud Console

For Google OAuth (optional), go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

```env
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

---

## What You Need to Get from GitHub

For GitHub OAuth (optional), go to [GitHub Developer Settings](https://github.com/settings/developers)

```env
GITHUB_CLIENT_ID="Iv1...."
GITHUB_CLIENT_SECRET="..."
```

---

## Complete .env File Template

Copy this to `apps/server/.env`:

```env
# =============================================================================
# Database (Required)
# =============================================================================
DATABASE_URL="file:./dev.db"

# =============================================================================
# Authentication (Required)
# =============================================================================
AUTH_SECRET="XnkgMaETat0AYCjcK1sVAjJEw0HWGgOGjLlxJbxrVLk="
AUTH_URL="http://localhost:3000"

# =============================================================================
# Tunnel Configuration (Required)
# =============================================================================
TUNNEL_DOMAIN="localhost"
TUNNEL_PORT=7000
NEXT_PUBLIC_TUNNEL_DOMAIN="localhost:3000"

# =============================================================================
# Encryption (Required in Production)
# =============================================================================
ENCRYPTION_MASTER_KEY="8f2f3da484b62d7214e00614c6e38859713767680c5f128c7e67e687bee44951"

# =============================================================================
# OAuth Providers (Optional)
# =============================================================================
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# =============================================================================
# Firebase - Server Side (Optional)
# =============================================================================
# Use file path for development:
FIREBASE_SERVICE_ACCOUNT_PATH="../../localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json"

# For production, use JSON string instead:
# FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"localhosttunnel",...}'

# =============================================================================
# Firebase - Client Side (Optional - Get from Firebase Console)
# =============================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="localhosttunnel.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="localhosttunnel"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="localhosttunnel.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""
NEXT_PUBLIC_FIREBASE_VAPID_KEY=""

# =============================================================================
# Environment
# =============================================================================
NODE_ENV="development"
```

---

## GitHub Secrets for CI/CD

Add these to **Settings > Secrets and variables > Actions** in your GitHub repo:

### Required Secrets

| Secret Name | Value | Status |
|-------------|-------|--------|
| `AUTH_SECRET` | `XnkgMaETat0AYCjcK1sVAjJEw0HWGgOGjLlxJbxrVLk=` | Ready |
| `DATABASE_URL` | `file:./dev.db` (or production DB URL) | Ready |
| `TUNNEL_DOMAIN` | Your production domain | Configure |
| `TUNNEL_PORT` | `7000` | Ready |
| `ENCRYPTION_MASTER_KEY` | `8f2f3da484b62d7214e00614c6e38859713767680c5f128c7e67e687bee44951` | Ready |

### Firebase Secrets (Optional)

| Secret Name | Value | Status |
|-------------|-------|--------|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON of service account | Need to convert |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console | Need to get |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `localhosttunnel.firebaseapp.com` | Ready |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `localhosttunnel` | Ready |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `localhosttunnel.appspot.com` | Ready |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console | Need to get |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase Console | Need to get |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | From Firebase Console | Need to get |

### OAuth Secrets (Optional)

| Secret Name | Value | Status |
|-------------|-------|--------|
| `GITHUB_CLIENT_ID` | From GitHub | Need to get |
| `GITHUB_CLIENT_SECRET` | From GitHub | Need to get |
| `GOOGLE_CLIENT_ID` | From Google Cloud | Need to get |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud | Need to get |

---

## Convert Firebase Service Account to Single-Line JSON

For `FIREBASE_SERVICE_ACCOUNT` GitHub Secret, run this command:

```bash
# On Linux/Mac
cat localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json | jq -c .

# On Windows PowerShell
Get-Content localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
```

Then copy the output as the secret value.

---

## Quick Setup Steps

1. **Copy `.env` template** above to `apps/server/.env`
2. **Get Firebase Web Config** from Firebase Console and fill in the missing values
3. **Add GitHub Secrets** from the table above
4. **Optional**: Set up OAuth providers if needed

---

## Security Notes

- Firebase service account file is in `.gitignore` (safe)
- Never commit `.env` files to git
- Rotate `AUTH_SECRET` and `ENCRYPTION_MASTER_KEY` periodically in production
- `NEXT_PUBLIC_*` variables are exposed to browser - they're meant to be public
