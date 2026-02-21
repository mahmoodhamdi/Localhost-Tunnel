import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  const locale = await getLocale();

  if (!session || session.user?.role !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations('admin');

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar t={t} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
