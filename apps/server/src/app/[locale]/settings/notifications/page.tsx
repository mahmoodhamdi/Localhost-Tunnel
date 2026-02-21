'use client';

import dynamic from 'next/dynamic';

const NotificationSettings = dynamic(
  () => import('@/components/notifications/NotificationSettings').then(m => m.NotificationSettings),
  { ssr: false }
);

export default function NotificationSettingsPage() {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <NotificationSettings />
    </div>
  );
}
