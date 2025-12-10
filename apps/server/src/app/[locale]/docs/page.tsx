import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Book, Code, Terminal, HelpCircle } from 'lucide-react';

export default function DocsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('docs.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('docs.subtitle')}</p>
      </div>

      <Tabs defaultValue="getting-started" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="getting-started" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span className="hidden sm:inline">{t('docs.gettingStarted.title')}</span>
          </TabsTrigger>
          <TabsTrigger value="guides" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">{t('docs.guides.title')}</span>
          </TabsTrigger>
          <TabsTrigger value="reference" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="hidden sm:inline">{t('docs.reference.title')}</span>
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('docs.troubleshooting.title')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="getting-started" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.gettingStarted.intro')}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Localhost Tunnel allows you to expose your local development server to the internet.
                This is useful for testing webhooks, sharing your work with teammates, or accessing
                your local server from mobile devices.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('docs.gettingStarted.installation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{t('cli.install.npm')}</h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>npm install -g @localhost-tunnel/cli</code>
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">{t('cli.install.yarn')}</h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>yarn global add @localhost-tunnel/cli</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('docs.gettingStarted.quickStart')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Start your local server and create a tunnel to expose it:
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`# Start your local server
npm run dev

# Create a tunnel (in another terminal)
lt --port 3000

# Output: https://happy-tunnel-123.example.com`}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.guides.webDev')}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Use Localhost Tunnel during web development to share your work with teammates,
                test on different devices, or show progress to clients.
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`# Create a tunnel with a custom subdomain
lt --port 3000 --subdomain my-project

# Your URL: https://my-project.example.com`}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('docs.guides.webhooks')}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Testing webhooks locally is easy with Localhost Tunnel. Create a tunnel and use
                the public URL as your webhook endpoint.
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`# Create a tunnel for webhook testing
lt --port 3000 --inspect

# View incoming requests in real-time at
# https://happy-tunnel-123.example.com/inspect`}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reference" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.reference.cli')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt --port &lt;port&gt;</h4>
                <p className="text-muted-foreground text-sm">
                  Create a tunnel to the specified local port
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt --subdomain &lt;name&gt;</h4>
                <p className="text-muted-foreground text-sm">
                  Request a specific subdomain
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt --password &lt;password&gt;</h4>
                <p className="text-muted-foreground text-sm">
                  Protect your tunnel with a password
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt --tcp</h4>
                <p className="text-muted-foreground text-sm">
                  Create a TCP tunnel instead of HTTP
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt status</h4>
                <p className="text-muted-foreground text-sm">
                  Show all active tunnels
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-mono text-sm">lt stop &lt;id&gt;</h4>
                <p className="text-muted-foreground text-sm">
                  Stop a running tunnel
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.troubleshooting.connection')}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h4>Connection Timeout</h4>
              <p>If your tunnel times out, check that:</p>
              <ul>
                <li>Your local server is running and accessible</li>
                <li>The port number is correct</li>
                <li>No firewall is blocking the connection</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('docs.troubleshooting.performance')}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h4>Slow Response Times</h4>
              <p>If requests are slow:</p>
              <ul>
                <li>Check your internet connection</li>
                <li>Reduce payload sizes when possible</li>
                <li>Use a server closer to your location</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
