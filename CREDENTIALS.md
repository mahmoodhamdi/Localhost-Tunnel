# Credentials & Environment Variables Guide

This document lists all credentials and environment variables needed for the Localhost Tunnel project, including what should be configured in GitHub Secrets for CI/CD.

## Required Credentials Overview

### 1. Database
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `DATABASE_URL` | SQLite database path | Yes | Use `file:./dev.db` for development |

### 2. Authentication
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `AUTH_SECRET` | NextAuth.js session encryption key | Yes | Generate with: `openssl rand -base64 32` |
| `AUTH_URL` | Base URL for auth callbacks | Yes | Your app URL (e.g., `https://tunnels.example.com`) |

### 3. OAuth Providers (Optional)
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | No | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | No | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |

### 4. Tunnel Configuration
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `TUNNEL_DOMAIN` | Domain for tunnel URLs | Yes | Your domain (e.g., `tunnels.example.com`) |
| `TUNNEL_PORT` | WebSocket server port | Yes | Default: `7000` |
| `NEXT_PUBLIC_TUNNEL_DOMAIN` | Client-side tunnel domain | Yes | Same as `TUNNEL_DOMAIN` |

### 5. Firebase / FCM (Optional - for push notifications)

#### Server-side (Firebase Admin SDK)
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON string of service account | No* | Firebase Console > Project Settings > Service Accounts |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON file | No* | For development only |

\* One of these is required if you want push notifications

#### Client-side (Firebase Web App)
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | No | Firebase Console > Project Settings > General |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push VAPID key | No | Firebase Console > Project Settings > Cloud Messaging |

### 6. Security (Production)
| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `ENCRYPTION_MASTER_KEY` | Master key for encrypting sensitive data | Prod only | Generate with: `openssl rand -hex 32` (64 chars) |

---

## GitHub Secrets for CI/CD

Add these secrets to your GitHub repository: **Settings > Secrets and variables > Actions**

### Required Secrets

```
AUTH_SECRET          # NextAuth.js secret (min 32 chars)
DATABASE_URL         # Production database URL
TUNNEL_DOMAIN        # Production tunnel domain
TUNNEL_PORT          # WebSocket port (default: 7000)
```

### Optional Secrets (OAuth)

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

### Optional Secrets (Firebase/FCM)

```
FIREBASE_SERVICE_ACCOUNT    # Full JSON string of service account key
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
```

### Optional Secrets (Security)

```
ENCRYPTION_MASTER_KEY       # 64 hex chars for encryption
```

---

## How to Get Firebase Credentials

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name and follow setup wizard

### 2. Get Service Account Key (Server-side)
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Navigate to **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. For GitHub Secrets, convert to a single-line JSON string:
   ```bash
   cat firebase-service-account.json | jq -c .
   ```

### 3. Get Web App Config (Client-side)
1. In Firebase Console, go to **Project Settings**
2. Under **Your apps**, click **Web app** (</>) icon
3. Register your app if not already done
4. Copy the `firebaseConfig` values

### 4. Get VAPID Key (Web Push)
1. In Firebase Console, go to **Project Settings**
2. Navigate to **Cloud Messaging** tab
3. Under **Web Push certificates**, click **Generate key pair**
4. Copy the key pair (public key)

---

## Environment File Template

Create `.env` file in `apps/server/`:

```env
# =============================================================================
# Required
# =============================================================================
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-secret-key-min-32-chars-here"
AUTH_URL="http://localhost:3000"
TUNNEL_DOMAIN="localhost"
TUNNEL_PORT=7000
NEXT_PUBLIC_TUNNEL_DOMAIN="localhost:3000"

# =============================================================================
# OAuth (Optional)
# =============================================================================
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# =============================================================================
# Firebase (Optional)
# =============================================================================
# Server-side - use ONE of these:
# FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'
FIREBASE_SERVICE_ACCOUNT_PATH="../../localhosttunnel-firebase-adminsdk-fbsvc-4975484751.json"

# Client-side
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID="localhosttunnel"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""
NEXT_PUBLIC_FIREBASE_VAPID_KEY=""

# =============================================================================
# Production Only
# =============================================================================
# ENCRYPTION_MASTER_KEY=""  # 64 hex chars

# =============================================================================
# Development
# =============================================================================
NODE_ENV="development"
```

---

## Security Notes

1. **Never commit credentials** to version control
2. Use **GitHub Secrets** for CI/CD pipelines
3. **Rotate secrets regularly** in production
4. Firebase service account JSON is **already in .gitignore**
5. Use **environment-specific** credentials (dev vs prod)
6. The `NEXT_PUBLIC_*` variables are exposed to the browser - they should only contain public Firebase config
