# Team Management Feature Plan

## Overview

Implement team collaboration features to allow users to:
- Create and manage teams
- Invite team members
- Share tunnels with team members
- Role-based access control

## Database Schema

### New Models

```prisma
model Team {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  image       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ownerId String
  owner   User   @relation("TeamOwner", fields: [ownerId], references: [id])

  members     TeamMember[]
  invitations TeamInvitation[]
  tunnels     Tunnel[]

  @@index([slug])
  @@index([ownerId])
}

model TeamMember {
  id        String   @id @default(cuid())
  role      String   @default("MEMBER") // OWNER, ADMIN, MEMBER
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  teamId String
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
}

model TeamInvitation {
  id        String   @id @default(cuid())
  email     String
  role      String   @default("MEMBER")
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  teamId    String
  team      Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  invitedById String
  invitedBy   User   @relation(fields: [invitedById], references: [id])

  @@index([teamId])
  @@index([email])
  @@index([token])
}
```

### Updated Models

```prisma
model User {
  // ... existing fields

  ownedTeams      Team[]           @relation("TeamOwner")
  teamMemberships TeamMember[]
  sentInvitations TeamInvitation[]
}

model Tunnel {
  // ... existing fields

  teamId String?
  team   Team?   @relation(fields: [teamId], references: [id], onDelete: SetNull)
}
```

## API Endpoints

### Teams
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create a new team
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team (owner only)

### Team Members
- `GET /api/teams/:id/members` - List team members
- `DELETE /api/teams/:id/members/:userId` - Remove member

### Team Invitations
- `POST /api/teams/:id/invitations` - Send invitation
- `GET /api/teams/:id/invitations` - List pending invitations
- `DELETE /api/teams/:id/invitations/:invitationId` - Cancel invitation
- `POST /api/invitations/:token/accept` - Accept invitation
- `POST /api/invitations/:token/decline` - Decline invitation

### Team Tunnels
- `GET /api/teams/:id/tunnels` - List team tunnels
- `POST /api/tunnels/:id/transfer` - Transfer tunnel to team

## Roles & Permissions

| Permission | Owner | Admin | Member |
|------------|-------|-------|--------|
| View team | ✅ | ✅ | ✅ |
| View tunnels | ✅ | ✅ | ✅ |
| Create tunnels | ✅ | ✅ | ✅ |
| Edit own tunnels | ✅ | ✅ | ✅ |
| Edit all tunnels | ✅ | ✅ | ❌ |
| Delete tunnels | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Edit team settings | ✅ | ✅ | ❌ |
| Delete team | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |

## Pages

### New Pages
- `/teams` - List user's teams
- `/teams/new` - Create new team
- `/teams/:id` - Team dashboard
- `/teams/:id/settings` - Team settings
- `/teams/:id/members` - Team members
- `/teams/:id/tunnels` - Team tunnels
- `/invitations/:token` - Accept/decline invitation

## Implementation Steps

### Step 1: Update Prisma Schema
Add Team, TeamMember, TeamInvitation models and update User/Tunnel

### Step 2: Create Team API Routes
- Teams CRUD
- Member management
- Invitation system

### Step 3: Create Team UI Pages
- Team list page
- Create team form
- Team dashboard
- Member management
- Invitation handling

### Step 4: Update Tunnel System
- Add teamId to tunnels
- Filter tunnels by team
- Team-based access control

### Step 5: Add Email Notifications
- Invitation emails
- Member added/removed notifications

## Translations

Add to `en.json` and `ar.json`:
```json
{
  "teams": {
    "title": "Teams",
    "subtitle": "Collaborate with your team",
    "create": "Create Team",
    "noTeams": "No teams yet",
    "noTeamsDesc": "Create a team to collaborate with others",
    "name": "Team Name",
    "namePlaceholder": "My Team",
    "slug": "Team URL",
    "slugPlaceholder": "my-team",
    "description": "Description",
    "settings": "Team Settings",
    "members": "Members",
    "tunnels": "Team Tunnels",
    "roles": {
      "owner": "Owner",
      "admin": "Admin",
      "member": "Member"
    },
    "invite": {
      "title": "Invite Member",
      "email": "Email Address",
      "role": "Role",
      "send": "Send Invitation",
      "pending": "Pending Invitations",
      "cancel": "Cancel Invitation",
      "resend": "Resend"
    },
    "actions": {
      "leave": "Leave Team",
      "delete": "Delete Team",
      "transfer": "Transfer Ownership"
    },
    "confirmLeave": "Are you sure you want to leave this team?",
    "confirmDelete": "Are you sure you want to delete this team? This action cannot be undone."
  },
  "invitations": {
    "title": "Team Invitation",
    "accept": "Accept Invitation",
    "decline": "Decline",
    "expired": "This invitation has expired",
    "invalid": "Invalid invitation"
  }
}
```

## File Structure

```
apps/server/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── teams/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── members/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── invitations/
│   │   │   │       │   └── route.ts
│   │   │   │       └── tunnels/
│   │   │   │           └── route.ts
│   │   │   └── invitations/
│   │   │       └── [token]/
│   │   │           └── route.ts
│   │   └── [locale]/
│   │       ├── teams/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/
│   │       │       ├── page.tsx
│   │       │       ├── settings/page.tsx
│   │       │       └── members/page.tsx
│   │       └── invitations/
│   │           └── [token]/page.tsx
└── __tests__/
    ├── unit/
    │   └── teams.test.ts
    └── integration/
        └── teams.test.ts
```

## Testing Plan

### Unit Tests
- Team slug generation
- Role permission checking
- Invitation token generation
- Expiration date validation

### Integration Tests
- Team CRUD operations
- Member management
- Invitation flow
- Access control

### E2E Tests
- Create team journey
- Invite and accept flow
- Team tunnel sharing
