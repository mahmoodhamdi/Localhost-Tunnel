'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Users, ArrowRight, Settings } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Skeleton } from '@/components/ui/skeleton';

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
  memberCount: number;
  tunnelCount: number;
  role: string;
  createdAt: string;
}

export default function TeamsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (data.success) {
        setTeams(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
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
      <div className="container mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('teams.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('teams.subtitle')}</p>
        </div>
        <Link href="/teams/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('teams.create')}
          </Button>
        </Link>
      </div>

      {teams.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">{t('teams.noTeams')}</h3>
            <p className="text-muted-foreground mb-4">{t('teams.noTeamsDesc')}</p>
            <Link href="/teams/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('teams.create')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {team.image ? (
                      <img
                        src={team.image}
                        alt={team.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">/{team.slug}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(team.role)}`}>
                    {t(`teams.roles.${team.role.toLowerCase()}`)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <CardDescription className="mb-4 line-clamp-2">
                    {team.description}
                  </CardDescription>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span>{team.memberCount} {t('teams.memberCount')}</span>
                  <span>{team.tunnelCount} {t('teams.tunnelCount')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/teams/${team.id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      {t('teams.viewTeam')}
                      <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                    </Button>
                  </Link>
                  {(team.role === 'OWNER' || team.role === 'ADMIN') && (
                    <Link href={`/teams/${team.id}/settings`}>
                      <Button variant="ghost" size="icon" aria-label={t('teams.settings')}>
                        <Settings className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
