'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  userRole: string;
}

export default function TeamSettingsPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
  });

  useEffect(() => {
    fetchTeam();
  }, [teamId]);

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();
      if (data.success) {
        setTeam(data.data);
        setFormData({
          name: data.data.name,
          description: data.data.description || '',
          image: data.data.image || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t('teams.updateSuccess'));
        setTeam((prev) => prev ? { ...prev, ...formData } : null);
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success(t('teams.deleteSuccess'));
        router.push('/teams');
      } else {
        toast.error(data.error?.message || t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Back link skeleton */}
        <Skeleton className="h-4 w-16 mb-6" />

        <div className="space-y-6">
          {/* Settings card skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-24" />
            </CardContent>
          </Card>

          {/* Danger zone skeleton */}
          <Card className="border-destructive">
            <CardHeader>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link
        href={`/teams/${teamId}`}
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back')}
      </Link>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('teams.settings')}</CardTitle>
            <CardDescription>{t('teams.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('teams.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('teams.namePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('teams.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('teams.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">{t('teams.image')}</Label>
                <Input
                  id="image"
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="https://example.com/image.png"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !formData.name}>
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {isOwner && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('teams.deleteTeam')}
              </CardTitle>
              <CardDescription>
                {t('teams.confirmDelete')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('teams.deleteTeam')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('teams.deleteTeam')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('teams.confirmDelete')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? t('common.loading') : t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
