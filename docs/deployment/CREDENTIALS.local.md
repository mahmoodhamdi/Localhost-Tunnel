# Deployment Credentials Template

> **Warning:** This file is a TEMPLATE. Copy it to `.env` and fill in your actual values.
> **تحذير:** هذا الملف قالب فقط. انسخه إلى `.env` واملأ القيم الفعلية.

---

## Required Environment Variables

### Core Application

```env
# Node Environment
NODE_ENV=production

# Database
DATABASE_URL="file:./data/tunnel.db"

# Application URL
AUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### Authentication (NextAuth v5)

```env
# Auth Secret - يجب أن يكون 32 حرف على الأقل
# Generate: openssl rand -base64 32
AUTH_SECRET="your-32-character-secret-key-here-replace-me"

# GitHub OAuth (Optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### Tunnel Configuration

```env
# Domain for tunnel URLs (e.g., tunnels.yourdomain.com)
TUNNEL_DOMAIN="tunnels.your-domain.com"
NEXT_PUBLIC_TUNNEL_DOMAIN="tunnels.your-domain.com"

# WebSocket Server Port
TUNNEL_PORT=7000
```

### Security

```env
# Encryption Master Key - Required in production
# Generate: openssl rand -base64 32
ENCRYPTION_MASTER_KEY="your-32-character-encryption-key-here"

# CORS Configuration
CORS_ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"
```

### Data Retention (Optional)

```env
# Days to retain different data types
RETENTION_REQUEST_LOGS=30
RETENTION_HEALTH_RESULTS=7
RETENTION_AUDIT_LOGS=90
RETENTION_INACTIVE_TUNNELS=30
RETENTION_RATE_LIMIT_HITS=1
RETENTION_EXPIRED_SESSIONS=7
RETENTION_EXPIRED_INVITATIONS=7
RETENTION_EXPIRED_ENCRYPTION_KEYS=30
```

### Email (Optional - for Team Invitations)

```env
# SMTP Configuration
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@your-domain.com"
```

---

## Docker Environment Variables

عند استخدام Docker، أضف هذه المتغيرات في docker-compose.yml:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_URL=file:./data/tunnel.db
  - AUTH_SECRET=your-secret-here
  - AUTH_URL=https://your-domain.com
  - TUNNEL_DOMAIN=tunnels.your-domain.com
  - TUNNEL_PORT=7000
  - ENCRYPTION_MASTER_KEY=your-encryption-key
```

---

## Production Checklist

قبل النشر، تأكد من:

- [ ] تغيير `AUTH_SECRET` إلى قيمة عشوائية قوية
- [ ] تغيير `ENCRYPTION_MASTER_KEY` إلى قيمة عشوائية قوية
- [ ] تحديث `AUTH_URL` و `TUNNEL_DOMAIN` للدومين الصحيح
- [ ] تكوين OAuth providers إذا كنت ستستخدمها
- [ ] تكوين SMTP إذا كنت ستستخدم دعوات الفريق
- [ ] تأكد من أن قاعدة البيانات في مجلد آمن مع نسخ احتياطية

---

## Security Notes

1. **لا ترفع هذا الملف إلى Git** - أضفه إلى .gitignore
2. **استخدم قيم عشوائية قوية** للمفاتيح السرية
3. **قم بتدوير المفاتيح بانتظام** في الإنتاج
4. **استخدم HTTPS** في الإنتاج
5. **قيّد CORS_ALLOWED_ORIGINS** للدومينات الموثوقة فقط

---

## Generate Secrets

لإنشاء مفاتيح سرية آمنة:

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

**ملاحظة:** احتفظ بنسخة احتياطية آمنة من هذه المعلومات في مكان آمن (مثل password manager).
