'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';

interface Invitation {
  email: string;
  role: string;
  expiresAt: string;
  team: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  };
  invitedBy: {
    name: string | null;
    email: string;
  };
}

export default function InvitationPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = params.token as string;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  async function fetchInvitation() {
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json();

      if (data.success) {
        setInvitation(data.data);
      } else {
        setError(data.error?.code === 'EXPIRED' ? t('invitations.expired') : t('invitations.invalid'));
      }
    } catch (error) {
      setError(t('invitations.invalid'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'accept' | 'decline') {
    if (!session) {
      router.push(`/auth/login?callbackUrl=/invitations/${token}`);
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (data.success) {
        if (action === 'accept') {
          toast.success(t('invitations.acceptSuccess'));
          router.push(`/teams/${data.data.team.id}`);
        } else {
          toast.success(t('invitations.declineSuccess'));
          router.push('/teams');
        }
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setProcessing(false);
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

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('invitations.title')}</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/teams">
              <Button variant="outline">
                {t('common.back')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {invitation.team.image ? (
              <img
                src={invitation.team.image}
                alt={invitation.team.name}
                className="h-16 w-16 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle>{t('invitations.title')}</CardTitle>
          <CardDescription>{t('invitations.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('teams.title')}</span>
              <span className="font-medium">{invitation.team.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invitations.role')}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(invitation.role)}`}>
                {t(`teams.roles.${invitation.role.toLowerCase()}`)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invitations.from')}</span>
              <span className="text-sm">{invitation.invitedBy.name || invitation.invitedBy.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('invitations.expires')}</span>
              <span className="text-sm flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {!session && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Please sign in to accept this invitation
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAction('decline')}
              disabled={processing}
            >
              {processing ? t('invitations.declining') : t('invitations.decline')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleAction('accept')}
              disabled={processing}
            >
              {processing ? t('invitations.accepting') : t('invitations.accept')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
