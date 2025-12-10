import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Zap,
  Shield,
  Search,
  Tag,
  Wifi,
  Gift,
  Terminal,
  ArrowRight,
} from 'lucide-react';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  const features = [
    {
      icon: Zap,
      title: t('home.features.instant'),
      description: t('home.features.instantDesc'),
    },
    {
      icon: Shield,
      title: t('home.features.secure'),
      description: t('home.features.secureDesc'),
    },
    {
      icon: Search,
      title: t('home.features.inspect'),
      description: t('home.features.inspectDesc'),
    },
    {
      icon: Tag,
      title: t('home.features.custom'),
      description: t('home.features.customDesc'),
    },
    {
      icon: Wifi,
      title: t('home.features.websocket'),
      description: t('home.features.websocketDesc'),
    },
    {
      icon: Gift,
      title: t('home.features.free'),
      description: t('home.features.freeDesc'),
    },
  ];

  const quickStartSteps = [
    { step: '01', title: t('home.quickStart.step1'), code: 'npm install -g @localhost-tunnel/cli' },
    { step: '02', title: t('home.quickStart.step2'), code: 'npm run dev' },
    { step: '03', title: t('home.quickStart.step3'), code: 'lt --port 3000' },
    { step: '04', title: t('home.quickStart.step4'), code: 'https://your-tunnel.example.com' },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {t('home.title')}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              {t('home.subtitle')}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/tunnels/new">
                  {t('home.cta')}
                  <ArrowRight className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0 rtl:rotate-180" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs">
                  <Terminal className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                  {t('home.ctaCli')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-none bg-background">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-12">
              {t('home.quickStart.title')}
            </h2>
            <div className="space-y-6">
              {quickStartSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-2">{step.title}</p>
                    <code className="block p-3 bg-background rounded-md text-sm font-mono overflow-x-auto">
                      {step.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold mb-4">
              {t('home.tryOnline')}
            </h2>
            <p className="text-lg opacity-90 mb-8">
              {t('home.subtitle')}
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/tunnels/new">
                {t('home.cta')}
                <ArrowRight className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
