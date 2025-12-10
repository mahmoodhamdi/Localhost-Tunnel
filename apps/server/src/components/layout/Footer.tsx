'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Heart, Github, Mail, Phone } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">LT</span>
              </div>
              <span className="font-bold text-xl">Localhost Tunnel</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Share your localhost with the world - securely and instantly.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/tunnels" className="hover:text-foreground transition-colors">
                  Tunnels
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="hover:text-foreground transition-colors">
                  API Reference
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">{t('contact')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center space-x-2 rtl:space-x-reverse">
                <Mail className="h-4 w-4" />
                <a
                  href="mailto:mwm.softwars.solutions@gmail.com"
                  className="hover:text-foreground transition-colors"
                >
                  mwm.softwars.solutions@gmail.com
                </a>
              </li>
              <li className="flex items-center space-x-2 rtl:space-x-reverse">
                <Mail className="h-4 w-4" />
                <a
                  href="mailto:hmdy7486@gmail.com"
                  className="hover:text-foreground transition-colors"
                >
                  hmdy7486@gmail.com
                </a>
              </li>
              <li className="flex items-center space-x-2 rtl:space-x-reverse">
                <Phone className="h-4 w-4" />
                <a
                  href="tel:+201019793768"
                  className="hover:text-foreground transition-colors"
                >
                  +201019793768
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="font-semibold">Connect</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://github.com/mahmoodhamdi/Localhost-Tunnel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 rtl:space-x-reverse hover:text-foreground transition-colors"
                >
                  <Github className="h-4 w-4" />
                  <span>{t('github')}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {year} {t('copyright')}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {t('madeWith')} <Heart className="h-4 w-4 text-red-500 fill-red-500" /> {t('by')}{' '}
            MWM Software Solutions
          </p>
        </div>
      </div>
    </footer>
  );
}
