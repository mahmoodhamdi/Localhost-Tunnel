import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';

export default function ApiDocsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations();

  const endpoints = [
    {
      method: 'GET',
      path: '/api/tunnels',
      description: 'List all tunnels',
      response: `{
  "success": true,
  "data": [
    {
      "id": "clxx...",
      "subdomain": "my-app",
      "localPort": 3000,
      "localHost": "localhost",
      "isActive": true,
      "totalRequests": 150,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/tunnels',
      description: 'Create a new tunnel',
      body: `{
  "localPort": 3000,
  "localHost": "localhost",
  "subdomain": "my-app",
  "protocol": "HTTP",
  "password": "optional-password",
  "ipWhitelist": "192.168.1.0/24",
  "expiresIn": 86400,
  "inspect": true
}`,
      response: `{
  "success": true,
  "data": {
    "id": "clxx...",
    "subdomain": "my-app",
    "publicUrl": "http://my-app.example.com",
    "localPort": 3000,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/tunnels/:id',
      description: 'Get tunnel details',
      response: `{
  "success": true,
  "data": {
    "id": "clxx...",
    "subdomain": "my-app",
    "publicUrl": "http://my-app.example.com",
    "localPort": 3000,
    "isActive": true,
    "totalRequests": 150,
    "totalBytes": 1048576
  }
}`,
    },
    {
      method: 'DELETE',
      path: '/api/tunnels/:id',
      description: 'Delete (deactivate) a tunnel',
      response: `{
  "success": true,
  "data": {
    "id": "clxx...",
    "message": "Tunnel deleted"
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/tunnels/:id/requests',
      description: 'List requests for a tunnel',
      parameters: [
        { name: 'method', type: 'string', description: 'Filter by HTTP method (GET, POST, etc.)' },
        { name: 'status', type: 'string', description: 'Filter by status (2xx, 4xx, 5xx)' },
        { name: 'limit', type: 'number', description: 'Max results (default: 100)' },
        { name: 'offset', type: 'number', description: 'Pagination offset' },
      ],
      response: `{
  "success": true,
  "data": {
    "requests": [...],
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/dashboard/stats',
      description: 'Get dashboard statistics',
      response: `{
  "success": true,
  "data": {
    "stats": {
      "activeTunnels": 5,
      "totalRequests": 1000,
      "totalBytes": 10485760,
      "uptime": 99
    },
    "recentActivity": [...]
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/analytics',
      description: 'Get analytics data',
      parameters: [
        { name: 'tunnelId', type: 'string', description: 'Filter by tunnel ID' },
        { name: 'range', type: 'string', description: '24h, 7d, or 30d' },
      ],
      response: `{
  "success": true,
  "data": {
    "metrics": {
      "totalRequests": 500,
      "uniqueIps": 25,
      "avgResponseTime": 150
    },
    "charts": {
      "requestsOverTime": [...],
      "requestsByMethod": [...],
      "requestsByStatus": [...]
    }
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/settings',
      description: 'Get application settings',
      response: `{
  "success": true,
  "data": {
    "defaultPort": 3000,
    "autoReconnect": true,
    "keepHistory": 7,
    "rateLimit": 100
  }
}`,
    },
    {
      method: 'PUT',
      path: '/api/settings',
      description: 'Update application settings',
      body: `{
  "defaultPort": 8080,
  "autoReconnect": true,
  "keepHistory": 30,
  "rateLimit": 200
}`,
      response: `{
  "success": true,
  "data": { ... }
}`,
    },
  ];

  const getMethodColor = (method: string): string => {
    switch (method) {
      case 'GET': return 'bg-green-500';
      case 'POST': return 'bg-blue-500';
      case 'PUT': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('apiDocs.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('apiDocs.subtitle')}</p>
      </div>

      {/* Introduction */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('apiDocs.introduction')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t('apiDocs.introText')}</p>
          <div>
            <h4 className="font-medium mb-2">{t('apiDocs.baseUrl')}</h4>
            <code className="bg-muted px-3 py-2 rounded-lg block">
              http://localhost:3000/api
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('apiDocs.authentication')}</h4>
            <p className="text-muted-foreground">{t('apiDocs.authText')}</p>
            <code className="bg-muted px-3 py-2 rounded-lg block mt-2">
              X-API-Key: your-api-key
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>{t('apiDocs.endpoints')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {endpoints.map((endpoint, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`${getMethodColor(endpoint.method)} text-white`}>
                    {endpoint.method}
                  </Badge>
                  <code className="font-mono text-sm">{endpoint.path}</code>
                </div>
                <p className="text-muted-foreground mb-4">{endpoint.description}</p>

                <Tabs defaultValue="response" className="w-full">
                  <TabsList>
                    {endpoint.body && <TabsTrigger value="body">{t('apiDocs.request')}</TabsTrigger>}
                    {endpoint.parameters && <TabsTrigger value="params">{t('apiDocs.parameters')}</TabsTrigger>}
                    <TabsTrigger value="response">{t('apiDocs.response')}</TabsTrigger>
                  </TabsList>

                  {endpoint.body && (
                    <TabsContent value="body">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        {endpoint.body}
                      </pre>
                    </TabsContent>
                  )}

                  {endpoint.parameters && (
                    <TabsContent value="params">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-start py-2">Name</th>
                            <th className="text-start py-2">{t('apiDocs.type')}</th>
                            <th className="text-start py-2">{t('apiDocs.description')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.parameters.map((param, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 font-mono">{param.name}</td>
                              <td className="py-2">{param.type}</td>
                              <td className="py-2 text-muted-foreground">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TabsContent>
                  )}

                  <TabsContent value="response">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      {endpoint.response}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('apiDocs.example')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>

            <TabsContent value="curl">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Create a tunnel
curl -X POST http://localhost:3000/api/tunnels \\
  -H "Content-Type: application/json" \\
  -d '{"localPort": 3000, "subdomain": "my-app"}'

# List tunnels
curl http://localhost:3000/api/tunnels

# Get tunnel details
curl http://localhost:3000/api/tunnels/clxx...

# Delete tunnel
curl -X DELETE http://localhost:3000/api/tunnels/clxx...`}
              </pre>
            </TabsContent>

            <TabsContent value="js">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Create a tunnel
const response = await fetch('http://localhost:3000/api/tunnels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    localPort: 3000,
    subdomain: 'my-app'
  })
});
const data = await response.json();
console.log(data.data.publicUrl);

// List tunnels
const tunnels = await fetch('http://localhost:3000/api/tunnels')
  .then(r => r.json());

// Get tunnel details
const tunnel = await fetch('http://localhost:3000/api/tunnels/clxx...')
  .then(r => r.json());`}
              </pre>
            </TabsContent>

            <TabsContent value="python">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

# Create a tunnel
response = requests.post('http://localhost:3000/api/tunnels', json={
    'localPort': 3000,
    'subdomain': 'my-app'
})
data = response.json()
print(data['data']['publicUrl'])

# List tunnels
tunnels = requests.get('http://localhost:3000/api/tunnels').json()

# Get tunnel details
tunnel = requests.get('http://localhost:3000/api/tunnels/clxx...').json()

# Delete tunnel
requests.delete('http://localhost:3000/api/tunnels/clxx...')`}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
