'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Check, Loader2, User } from 'lucide-react';
import Image from 'next/image';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: string;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const { data: session, update: updateSession } = useSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete account state
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setName(data.data.name || '');
      }
    } catch {
      // silently fail; the user still sees empty fields
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    try {
      setSaving(true);
      setProfileError(null);

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (data.success) {
        setProfile(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        // Refresh session so the header updates
        await updateSession();
      } else {
        setProfileError(data.error?.message || 'Failed to update profile');
      }
    } catch {
      setProfileError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }

    try {
      setPasswordSaving(true);

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSaved(true);
        setTimeout(() => setPasswordSaved(false), 3000);
      } else {
        const code = data.error?.code;
        if (code === 'INCORRECT_PASSWORD') {
          setPasswordError(t('incorrectPassword'));
        } else {
          setPasswordError(data.error?.message || 'Failed to change password');
        }
      }
    } catch {
      setPasswordError('Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setDeleting(true);

      const res = await fetch('/api/profile', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        await signOut({ callbackUrl: '/' });
      }
    } catch {
      // noop
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-8 max-w-2xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      <div className="space-y-6">
        {/* Profile Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('editProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {profile?.image || session?.user?.image ? (
                <Image
                  src={(profile?.image || session?.user?.image) as string}
                  alt={profile?.name || session?.user?.name || 'User'}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium">{profile?.name || session?.user?.name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{profile?.email || session?.user?.email}</p>
              </div>
            </div>

            {/* Error */}
            {profileError && (
              <p className="text-sm text-destructive">{profileError}</p>
            )}

            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name')}
              />
            </div>

            {/* Email field (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || session?.user?.email || ''}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                    {t('save')}
                  </>
                ) : saved ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500 rtl:ml-2 rtl:mr-0" />
                    {t('saved')}
                  </>
                ) : (
                  t('save')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('changePassword')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error */}
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                    {t('changePassword')}
                  </>
                ) : passwordSaved ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500 rtl:ml-2 rtl:mr-0" />
                    {t('passwordChanged')}
                  </>
                ) : (
                  t('changePassword')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account Section */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t('deleteAccount')}</CardTitle>
            <CardDescription>{t('deleteConfirm')}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                  ) : null}
                  {t('deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteAccount')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('deleteAccount')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
