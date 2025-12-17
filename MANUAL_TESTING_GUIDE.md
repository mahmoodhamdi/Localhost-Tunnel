# Manual Testing Guide - Localhost Tunnel

This guide covers all features in the Localhost Tunnel project for comprehensive manual testing.

## Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npm run db:generate

# 3. Push database schema
npm run db:push

# 4. Build shared package
cd packages/shared && npm run build && cd ../..

# 5. Start development server (Terminal 1)
npm run dev

# 6. Start WebSocket server for CLI (Terminal 2)
cd apps/server && node dev-ws-server.js
```

**URLs:**
- Web Dashboard: http://localhost:3000
- WebSocket Server: ws://localhost:7000

---

## 1. Authentication

### 1.1 Registration
1. Go to http://localhost:3000/en/auth/register
2. Fill the form:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `Test123456!`
   - Confirm Password: `Test123456!`
3. Click "Register"
4. **Expected:** Redirect to dashboard or login page

### 1.2 Login
1. Go to http://localhost:3000/en/auth/login
2. Enter credentials:
   - Email: `test@example.com`
   - Password: `Test123456!`
3. Click "Login"
4. **Expected:** Redirect to dashboard

### 1.3 Forgot Password
1. Go to http://localhost:3000/en/auth/forgot-password
2. Enter email: `test@example.com`
3. Click "Send Reset Link"
4. **Expected:** Success message (email won't send without SMTP config)

### 1.4 OAuth Login (Optional - requires config)
1. Click "Login with GitHub" or "Login with Google"
2. **Expected:** Redirect to OAuth provider

### 1.5 Logout
1. Click user avatar in header
2. Click "Logout"
3. **Expected:** Redirect to home page

---

## 2. Dashboard

### 2.1 View Dashboard
1. Login and go to http://localhost:3000/en/dashboard
2. **Verify:**
   - [ ] Statistics cards (Active Tunnels, Total Requests, Bandwidth, Avg Response Time)
   - [ ] Recent activity section
   - [ ] Quick actions (Create Tunnel button)

---

## 3. Tunnels (Web Dashboard)

### 3.1 View Tunnels List
1. Go to http://localhost:3000/en/tunnels
2. **Expected:** List of tunnels (empty if none created)

### 3.2 Create HTTP Tunnel
1. Go to http://localhost:3000/en/tunnels/new
2. Fill the form:
   - Subdomain: `mytest`
   - Local Port: `8080`
   - Local Host: `localhost`
   - Password: (optional) `secret123`
   - IP Whitelist: (optional) `192.168.1.1, 10.0.0.0/24`
   - Expiration: (optional) select time
3. Click "Create Tunnel"
4. **Expected:** Tunnel created, redirect to tunnel details

### 3.3 View Tunnel Details
1. Click on a tunnel from the list
2. **Verify:**
   - [ ] Public URL displayed
   - [ ] Status (Active/Inactive)
   - [ ] Statistics (requests, bytes)
   - [ ] Configuration details

### 3.4 Request Inspector
1. Go to tunnel details, click "Inspector" tab or link
2. Open another terminal and run:
   ```bash
   # Start a local server first
   npx http-server -p 8080

   # Or use Python
   python -m http.server 8080
   ```
3. Make requests to the public URL
4. **Verify:**
   - [ ] Requests appear in real-time
   - [ ] Method, path, status code visible
   - [ ] Can click to see headers and body

### 3.5 Replay Request
1. In Request Inspector, click on a request
2. Click "Replay" button
3. **Expected:** Request is replayed, new entry appears

### 3.6 Delete Tunnel
1. Go to tunnel details
2. Click "Delete" button
3. Confirm deletion
4. **Expected:** Tunnel removed from list

---

## 4. CLI Testing

### 4.1 Build and Link CLI
```bash
cd apps/cli
npm run build
npm link
```

### 4.2 Start WebSocket Server (Required for CLI)
```bash
# In a separate terminal
cd apps/server
node dev-ws-server.js
```
**Expected:** Server running on ws://localhost:7000/tunnel

### 4.3 Create HTTP Tunnel via CLI
```bash
# Start a local server first (in another terminal)
npx http-server -p 3001

# Create tunnel (specify server for development)
lt --port 3001 --server http://localhost:7000

# With custom subdomain
lt --port 3001 --subdomain myapp --server http://localhost:7000

# With password
lt --port 3001 --password secret123 --server http://localhost:7000
```
**Expected:**
- Connection success message
- Public URL displayed
- Requests are forwarded to local server

### 4.3 Create TCP Tunnel via CLI
```bash
# For SSH (if SSH server running on 22)
lt --port 22 --tcp

# For database (e.g., PostgreSQL on 5432)
lt --port 5432 --tcp
```
**Expected:**
- TCP port allocated and displayed
- Connections forwarded to local port

### 4.4 CLI Configuration
```bash
# Set default server
lt config --server https://your-server.com

# Set default port
lt config --port 8080

# View current config
lt config --list
```

### 4.5 View CLI Status
```bash
lt status
```
**Expected:** List of active tunnels

### 4.6 CLI Help
```bash
lt --help
```
**Expected:** Help message with all options

---

## 5. Teams

### 5.1 Create Team
1. Go to http://localhost:3000/en/teams
2. Click "Create Team"
3. Fill form:
   - Name: `My Team`
   - Description: `Test team for development`
4. Click "Create"
5. **Expected:** Team created, redirect to team page

### 5.2 View Team Details
1. Click on team from list
2. **Verify:**
   - [ ] Team name and description
   - [ ] Member list
   - [ ] Team tunnels

### 5.3 Invite Member
1. Go to team page
2. Click "Invite Member"
3. Enter email: `teammate@example.com`
4. Select role: `Member` or `Admin`
5. Click "Send Invitation"
6. **Expected:** Invitation sent (check console for invitation link)

### 5.4 Accept Invitation
1. Get invitation link from console/database
2. Go to http://localhost:3000/en/invitations/{token}
3. **Expected:** Invitation accepted, added to team

### 5.5 Manage Members
1. Go to team → Members
2. **Verify:**
   - [ ] Can change member role
   - [ ] Can remove member

### 5.6 Team Settings
1. Go to team → Settings
2. **Verify:**
   - [ ] Can update team name
   - [ ] Can update description
   - [ ] Can delete team (owner only)

### 5.7 Create Team Tunnel
1. Go to tunnel creation
2. Select team from dropdown
3. **Expected:** Tunnel associated with team

---

## 6. API Keys

### 6.1 View API Keys
1. Go to http://localhost:3000/en/settings/api-keys
2. **Expected:** List of API keys (empty if none)

### 6.2 Create API Key
1. Click "Create API Key"
2. Enter name: `My API Key`
3. Set expiration (optional)
4. Click "Create"
5. **Important:** Copy the key immediately (shown only once)
6. **Expected:** Key created, prefix shown in list

### 6.3 Test API Key
```bash
# List tunnels with API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/tunnels

# Create tunnel with API key
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"localPort": 3001, "subdomain": "api-test"}' \
  http://localhost:3000/api/tunnels
```

### 6.4 Delete API Key
1. Click delete icon on API key
2. Confirm deletion
3. **Expected:** Key removed, no longer works

---

## 7. Settings

### 7.1 Profile Settings
1. Go to http://localhost:3000/en/settings
2. **Verify:**
   - [ ] Can update name
   - [ ] Can update email
   - [ ] Can change password

### 7.2 Notification Settings
1. Go to Settings → Notifications
2. **Verify:**
   - [ ] Toggle email notifications
   - [ ] Toggle push notifications

### 7.3 Application Settings (Admin)
1. As admin user, check settings
2. **Verify:**
   - [ ] Can change default port
   - [ ] Can change rate limits
   - [ ] Can change history retention

---

## 8. Analytics

### 8.1 View Analytics
1. Go to http://localhost:3000/en/analytics
2. **Verify:**
   - [ ] Total requests chart
   - [ ] Bandwidth usage chart
   - [ ] Response time chart
   - [ ] Top paths
   - [ ] Status code distribution
   - [ ] Request methods distribution

### 8.2 Filter Analytics
1. Select date range
2. Select specific tunnel (if applicable)
3. **Expected:** Charts update with filtered data

---

## 9. Security Features

### 9.1 Password Protected Tunnel
1. Create tunnel with password
2. Access public URL in browser
3. **Expected:** Password prompt appears
4. Enter correct password
5. **Expected:** Request forwarded

### 9.2 IP Whitelist
1. Create tunnel with IP whitelist: `127.0.0.1`
2. Access from whitelisted IP
3. **Expected:** Request allowed
4. Access from non-whitelisted IP
5. **Expected:** Request blocked (403)

### 9.3 Rate Limiting
1. Go to Security settings
2. Create rate limit rule:
   - Requests per minute: 10
   - Burst limit: 5
3. Make rapid requests to tunnel
4. **Expected:** Requests blocked after limit exceeded

### 9.4 Geo Rules (if configured)
1. Create geo rule:
   - Mode: ALLOW or BLOCK
   - Countries: US, UK
2. **Expected:** Requests filtered by country

### 9.5 View Audit Logs
1. Go to Security → Audit Logs
2. **Verify:**
   - [ ] Login events logged
   - [ ] Tunnel create/delete logged
   - [ ] Settings changes logged

### 9.6 Export Audit Logs
1. Click "Export" button
2. **Expected:** CSV/JSON file downloaded

---

## 10. Health Checks

### 10.1 System Health
```bash
curl http://localhost:3000/api/health
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 12345,
    "database": "connected",
    "memory": { "used": "...", "total": "..." }
  }
}
```

### 10.2 Create Health Check
1. Create a health check for a tunnel
2. **Verify:**
   - [ ] Check runs on schedule
   - [ ] Status updates (HEALTHY/UNHEALTHY)
   - [ ] Alerts triggered on failure

### 10.3 Manual Health Check Run
1. Click "Run Now" on a health check
2. **Expected:** Check executes immediately, results displayed

---

## 11. Internationalization (i18n)

### 11.1 Switch to Arabic
1. Click language switcher in header
2. Select "العربية" (Arabic)
3. **Verify:**
   - [ ] URL changes to `/ar/...`
   - [ ] Text is in Arabic
   - [ ] Layout is RTL (right-to-left)

### 11.2 Switch to English
1. Click language switcher
2. Select "English"
3. **Verify:**
   - [ ] URL changes to `/en/...`
   - [ ] Text is in English
   - [ ] Layout is LTR (left-to-right)

---

## 12. Theme

### 12.1 Toggle Dark Mode
1. Click theme toggle in header
2. **Verify:**
   - [ ] Colors switch to dark theme
   - [ ] Preference saved (persists on refresh)

### 12.2 Toggle Light Mode
1. Click theme toggle again
2. **Verify:**
   - [ ] Colors switch to light theme

---

## 13. Responsive Design

### 13.1 Mobile View
1. Open browser DevTools (F12)
2. Toggle device toolbar
3. Select mobile device (iPhone, Pixel)
4. Navigate through pages
5. **Verify:**
   - [ ] Mobile navigation works
   - [ ] Forms are usable
   - [ ] Tables scroll horizontally
   - [ ] Buttons are tappable

### 13.2 Tablet View
1. Select tablet device in DevTools
2. **Verify:**
   - [ ] Layout adapts properly
   - [ ] Sidebar behavior correct

---

## 14. API Endpoints Testing

### 14.1 Tunnels API
```bash
# List tunnels
curl http://localhost:3000/api/tunnels

# Get tunnel by ID
curl http://localhost:3000/api/tunnels/{id}

# Create tunnel
curl -X POST -H "Content-Type: application/json" \
  -d '{"localPort": 3001, "subdomain": "test"}' \
  http://localhost:3000/api/tunnels

# Delete tunnel
curl -X DELETE http://localhost:3000/api/tunnels/{id}

# Get tunnel requests
curl http://localhost:3000/api/tunnels/{id}/requests
```

### 14.2 Teams API
```bash
# List teams
curl http://localhost:3000/api/teams

# Create team
curl -X POST -H "Content-Type: application/json" \
  -d '{"name": "Test Team", "description": "Testing"}' \
  http://localhost:3000/api/teams

# Get team
curl http://localhost:3000/api/teams/{id}

# Delete team
curl -X DELETE http://localhost:3000/api/teams/{id}
```

### 14.3 Dashboard Stats API
```bash
curl http://localhost:3000/api/dashboard/stats
```

### 14.4 Analytics API
```bash
curl "http://localhost:3000/api/analytics?from=2024-01-01&to=2024-12-31"
```

### 14.5 Settings API
```bash
# Get settings
curl http://localhost:3000/api/settings

# Update settings
curl -X PUT -H "Content-Type: application/json" \
  -d '{"defaultPort": 8080}' \
  http://localhost:3000/api/settings
```

---

## 15. Push Notifications (Optional - requires Firebase)

### 15.1 Enable Push Notifications
1. Go to Settings → Notifications
2. Click "Enable Push Notifications"
3. Allow browser notification permission
4. **Expected:** FCM token registered

### 15.2 Test Push Notification
```bash
curl -X POST http://localhost:3000/api/notifications/test
```
**Expected:** Notification appears in browser

---

## 16. Documentation Pages

### 16.1 User Documentation
1. Go to http://localhost:3000/en/docs
2. **Verify:**
   - [ ] Quick start guide
   - [ ] CLI usage examples
   - [ ] Feature explanations

### 16.2 API Documentation
1. Go to http://localhost:3000/en/api-docs
2. **Verify:**
   - [ ] Endpoint list
   - [ ] Request/response examples
   - [ ] Authentication info

---

## 17. Error Handling

### 17.1 404 Page
1. Go to http://localhost:3000/en/nonexistent
2. **Expected:** Custom 404 page

### 17.2 Auth Error Page
1. Go to http://localhost:3000/en/auth/error
2. **Expected:** Error page with message

### 17.3 API Error Responses
```bash
# Invalid tunnel ID
curl http://localhost:3000/api/tunnels/invalid-id
# Expected: 404 Not Found

# Missing required field
curl -X POST -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3000/api/tunnels
# Expected: 400 Bad Request

# Unauthorized
curl http://localhost:3000/api/settings
# Expected: 401 Unauthorized (if not logged in)
```

---

## 18. WebSocket Testing

### 18.1 Connect to WebSocket
```javascript
// In browser console or Node.js
const ws = new WebSocket('ws://localhost:7000/tunnel');

ws.onopen = () => {
  console.log('Connected');
  // Register tunnel
  ws.send(JSON.stringify({
    type: 'register',
    payload: {
      localPort: 3001,
      subdomain: 'ws-test'
    }
  }));
};

ws.onmessage = (event) => {
  console.log('Message:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('Error:', error);
};
```

### 18.2 Verify Ping/Pong
1. Connect to WebSocket
2. Wait 30 seconds
3. **Expected:** Connection stays alive (ping/pong working)

---

## 19. Encryption (if enabled)

### 19.1 Enable Tunnel Encryption
```bash
curl -X POST http://localhost:3000/api/tunnels/{id}/encryption \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "mode": "E2E"}'
```

### 19.2 Rotate Encryption Key
```bash
curl -X POST http://localhost:3000/api/tunnels/{id}/encryption/rotate
```

---

## 20. Data Retention (Admin)

### 20.1 Check Retention Settings
```bash
curl http://localhost:3000/api/admin/retention
```

### 20.2 Trigger Retention Cleanup
```bash
curl -X POST http://localhost:3000/api/admin/retention
```

---

## Quick Checklist

### Core Features
- [ ] User registration works
- [ ] User login works
- [ ] Dashboard loads with stats
- [ ] Can create HTTP tunnel from web
- [ ] Can create HTTP tunnel from CLI
- [ ] Can create TCP tunnel from CLI
- [ ] Request inspector shows requests
- [ ] Can replay requests
- [ ] Can delete tunnels

### Teams
- [ ] Can create team
- [ ] Can invite members
- [ ] Can manage team settings
- [ ] Can create team tunnels

### Security
- [ ] Password protection works
- [ ] IP whitelist works
- [ ] Rate limiting works
- [ ] Audit logs recorded

### UI/UX
- [ ] Arabic translation works
- [ ] RTL layout correct
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] All pages load without errors

### API
- [ ] All endpoints return proper responses
- [ ] Authentication required where expected
- [ ] Error responses are formatted correctly

---

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
netstat -ano | findstr :3000
netstat -ano | findstr :7000

# Kill process if needed
taskkill /PID <PID> /F
```

### Database issues
```bash
# Reset database
cd apps/server
rm prisma/dev.db
npm run db:push
```

### CLI not connecting
```bash
# Check WebSocket server is running
curl http://localhost:7000

# Check CLI is using correct server
lt config --list
```

### Prisma client issues
```bash
npm run db:generate
```
