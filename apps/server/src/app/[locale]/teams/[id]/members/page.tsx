'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UserPlus, MoreVertical, Mail, X, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Team {
  id: string;
  name: string;
  userRole: string;
  members: TeamMember[];
}

export default function TeamMembersPage() {
  const t = useTranslations();
  const params = useParams();
  const teamId = params.id as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [changeRoleMember, setChangeRoleMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState('MEMBER');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'MEMBER',
  });

  useEffect(() => {
    fetchTeam();
    fetchInvitations();
  }, [teamId]);

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();
      if (data.success) {
        setTeam(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvitations() {
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`);
      const data = await res.json();
      if (data.success) {
        setInvitations(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t('teams.invite.success'));
        setShowInviteDialog(false);
        setInviteForm({ email: '', role: 'MEMBER' });
        fetchInvitations();
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setInviting(false);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations?invitationId=${invitationId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Invitation cancelled');
        fetchInvitations();
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  }

  async function handleRemoveMember() {
    if (!removeMember) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/members?userId=${removeMember.user.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Member removed');
        setRemoveMember(null);
        fetchTeam();
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  }

  async function handleChangeRole() {
    if (!changeRoleMember) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: changeRoleMember.user.id,
          role: newRole,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Role updated');
        setChangeRoleMember(null);
        fetchTeam();
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">{t('errors.tunnelNotFound')}</h3>
            <Link href="/teams">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = team.userRole === 'OWNER';
  const isOwnerOrAdmin = team.userRole === 'OWNER' || team.userRole === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href={`/teams/${teamId}`}
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back')}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('teams.members')}</h1>
          <p className="text-muted-foreground">
            {team.members.length} {t('teams.memberCount')}
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t('teams.invite.title')}
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('teams.members')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt={member.user.name || member.user.email}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {(member.user.name || member.user.email)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{member.user.name || member.user.email}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(member.role)}`}>
                      {t(`teams.roles.${member.role.toLowerCase()}`)}
                    </span>
                    {isOwnerOrAdmin && member.role !== 'OWNER' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isOwner && (
                            <DropdownMenuItem onClick={() => {
                              setChangeRoleMember(member);
                              setNewRole(member.role);
                            }}>
                              {t('teams.actions.changeRole')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setRemoveMember(member)}
                          >
                            {t('teams.actions.removeMember')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isOwnerOrAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('teams.invite.pending')}
              </CardTitle>
              <CardDescription>
                {invitations.length === 0
                  ? t('teams.invite.noPending')
                  : `${invitations.length} pending`}
              </CardDescription>
            </CardHeader>
            {invitations.length > 0 && (
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(invitation.role)}`}>
                          {t(`teams.roles.${invitation.role.toLowerCase()}`)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams.invite.title')}</DialogTitle>
            <DialogDescription>{t('teams.invite.subtitle')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('teams.invite.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder={t('teams.invite.emailPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t('teams.invite.role')}</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">{t('teams.roles.member')}</SelectItem>
                    {isOwner && (
                      <SelectItem value="ADMIN">{t('teams.roles.admin')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={inviting || !inviteForm.email}>
                {inviting ? t('teams.invite.sending') : t('teams.invite.send')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!removeMember} onOpenChange={() => setRemoveMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('teams.actions.removeMember')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('teams.confirmRemove')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={!!changeRoleMember} onOpenChange={() => setChangeRoleMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams.actions.changeRole')}</DialogTitle>
            <DialogDescription>
              Change role for {changeRoleMember?.user.name || changeRoleMember?.user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newRole">{t('teams.invite.role')}</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{t('teams.roles.member')}</SelectItem>
                <SelectItem value="ADMIN">{t('teams.roles.admin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleMember(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeRole}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
