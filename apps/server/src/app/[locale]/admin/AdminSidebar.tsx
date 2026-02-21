'use client';

import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Globe,
  Shield,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface AdminSidebarProps {
  t: (key: string) => string;
}

export default function AdminSidebar({ t }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      href: '/admin' as const,
      label: t('nav.overview'),
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/admin/users' as const,
      label: t('nav.users'),
      icon: Users,
      exact: false,
    },
    {
      href: '/admin/tunnels' as const,
      label: t('nav.tunnels'),
      icon: Globe,
      exact: false,
    },
    {
      href: '/admin/audit' as const,
      label: t('nav.audit'),
      icon: Shield,
      exact: false,
    },
    {
      href: '/admin/settings' as const,
      label: t('nav.settings'),
      icon: Settings,
      exact: false,
    },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{t('title')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle admin navigation"
          aria-expanded={mobileOpen}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform',
              mobileOpen ? 'rotate-90' : ''
            )}
          />
        </Button>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden absolute top-[8rem] left-0 right-0 z-40 bg-card border-b shadow-lg">
          <nav className="container py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r bg-card flex-shrink-0">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-semibold">{t('title')}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1" aria-label="Admin navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
