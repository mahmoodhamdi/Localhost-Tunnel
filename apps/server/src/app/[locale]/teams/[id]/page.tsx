'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Settings, Globe, UserPlus, MoreVertical } from 'lucide-react';
import { Link } from '@/i18n/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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

interface TeamTunnel {
  id: string;
  subdomain: string;
  localPort: number;
  localHost: string;
  isActive: boolean;
  createdBy: {
    id: string;
    name: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  members: TeamMember[];
  tunnelCount: number;
  pendingInvitations: number;
  userRole: string;
  createdAt: string;
}

export default function TeamDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const teamId = params.id as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [tunnels, setTunnels] = useState<TeamTunnel[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchTeam();
    fetchTunnels();
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

  async function fetchTunnels() {
    try {
      const res = await fetch(`/api/teams/${teamId}/tunnels`);
      const data = await res.json();
      if (data.success) {
        setTunnels(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tunnels:', error);
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberToRemove.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast.success(t('teams.memberRemoved'));
        // Update team members list
        if (team) {
          setTeam({
            ...team,
            members: team.members.filter(m => m.id !== memberToRemove.id),
          });
        }
      } else {
        toast.error(data.error?.message || t('common.error'));
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(t('common.error'));
    } finally {
      setIsUpdating(false);
      setMemberToRemove(null);
    }
  }

  async function handleChangeRole() {
    if (!memberToChangeRole || !newRole) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberToChangeRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(t('teams.roleUpdated'));
        // Update team members list
        if (team) {
          setTeam({
            ...team,
            members: team.members.map(m =>
              m.id === memberToChangeRole.id ? { ...m, role: newRole } : m
            ),
          });
        }
      } else {
        toast.error(data.error?.message || t('common.error'));
      }
    } catch (error) {
      console.error('Failed to change role:', error);
      toast.error(t('common.error'));
    } finally {
      setIsUpdating(false);
      setMemberToChangeRole(null);
      setNewRole('');
    }
  }

  function openChangeRoleDialog(member: TeamMember) {
    setMemberToChangeRole(member);
    setNewRole(member.role);
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
      <div className="container mx-auto px-4 py-8">
        {/* Back link skeleton */}
        <Skeleton className="h-4 w-16 mb-6" />

        {/* Header skeleton */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-64 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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

  const isOwnerOrAdmin = team.userRole === 'OWNER' || team.userRole === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/teams" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back')}
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {team.image ? (
            <img
              src={team.image}
              alt={team.name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{team.name}</h1>
              <span className={`text-sm px-2 py-1 rounded-full ${getRoleBadgeColor(team.userRole)}`}>
                {t(`teams.roles.${team.userRole.toLowerCase()}`)}
              </span>
            </div>
            <p className="text-muted-foreground">/{team.slug}</p>
            {team.description && (
              <p className="text-muted-foreground mt-1">{team.description}</p>
            )}
          </div>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-2">
            <Link href={`/teams/${team.id}/members`}>
              <Button variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('teams.invite.title')}
              </Button>
            </Link>
            <Link href={`/teams/${team.id}/settings`}>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('teams.members')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{team.members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('teams.tunnels')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{team.tunnelCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('teams.invite.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{team.pendingInvitations}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            {t('teams.members')}
          </TabsTrigger>
          <TabsTrigger value="tunnels">
            <Globe className="h-4 w-4 mr-2" />
            {t('teams.tunnels')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('teams.members')}</CardTitle>
              <CardDescription>
                {team.members.length} {t('teams.memberCount')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
                            <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {team.userRole === 'OWNER' && (
                              <DropdownMenuItem onClick={() => openChangeRoleDialog(member)}>
                                {t('teams.actions.changeRole')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setMemberToRemove(member)}
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
        </TabsContent>

        <TabsContent value="tunnels" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('teams.tunnels')}</CardTitle>
              <CardDescription>
                {tunnels.length} {t('teams.tunnelCount')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tunnels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('tunnels.noTunnels')}
                </div>
              ) : (
                <div className="space-y-4">
                  {tunnels.map((tunnel) => (
                    <div
                      key={tunnel.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${tunnel.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <p className="font-medium">{tunnel.subdomain}</p>
                          <p className="text-sm text-muted-foreground">
                            {tunnel.localHost}:{tunnel.localPort}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {tunnel.createdBy && (
                          <span className="text-sm text-muted-foreground">
                            {tunnel.createdBy.name || 'Unknown'}
                          </span>
                        )}
                        <Link href={`/tunnels/${tunnel.id}`}>
                          <Button variant="outline" size="sm">
                            {t('common.view')}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('teams.actions.removeMember')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('teams.confirmRemove')}
              {memberToRemove && (
                <span className="block mt-2 font-medium">
                  {memberToRemove.user.name || memberToRemove.user.email}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating ? t('common.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={!!memberToChangeRole} onOpenChange={(open) => !open && setMemberToChangeRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('teams.actions.changeRole')}</DialogTitle>
            <DialogDescription>
              {t('teams.changeRoleDesc')}
              {memberToChangeRole && (
                <span className="block mt-2 font-medium text-foreground">
                  {memberToChangeRole.user.name || memberToChangeRole.user.email}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="role-select">{t('teams.invite.role')}</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger id="role-select" className="mt-2">
                <SelectValue placeholder={t('teams.invite.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{t('teams.roles.admin')}</SelectItem>
                <SelectItem value="MEMBER">{t('teams.roles.member')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToChangeRole(null)} disabled={isUpdating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeRole} disabled={isUpdating || !newRole}>
              {isUpdating ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
