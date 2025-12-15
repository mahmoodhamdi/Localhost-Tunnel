'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Search,
  Trash2,
  RefreshCw,
  Loader2,
  Circle,
  Download,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface RequestLog {
  id: string;
  tunnelId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  query: string | null;
  statusCode: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responseTime: number | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function InspectorPage() {
  const t = useTranslations();
  const params = useParams();
  const tunnelId = params.id as string;

  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLive, setIsLive] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (methodFilter !== 'all') params.set('method', methodFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/tunnels/${tunnelId}/requests?${params}`);
      const data = await response.json();

      if (data.success) {
        setRequests(data.data.requests);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load requests');
      }
    } catch (err) {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [tunnelId, methodFilter, statusFilter]);

  // Auto-refresh when live
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [isLive, tunnelId, methodFilter, statusFilter]);

  const clearRequests = async () => {
    try {
      setClearing(true);
      const response = await fetch(`/api/tunnels/${tunnelId}/requests`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setRequests([]);
        setSelectedRequest(null);
      } else {
        toast.error(data.error?.message || t('inspector.clearFailed'));
      }
    } catch {
      toast.error(t('inspector.clearFailed'));
    } finally {
      setClearing(false);
    }
  };

  const exportRequests = (format: 'json' | 'har') => {
    let data: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      data = JSON.stringify(requests, null, 2);
      filename = `requests-${tunnelId}-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      // HAR format
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Localhost Tunnel', version: '1.0' },
          entries: requests.map((r) => ({
            startedDateTime: r.createdAt,
            time: r.responseTime || 0,
            request: {
              method: r.method,
              url: r.path,
              headers: Object.entries(r.headers).map(([name, value]) => ({ name, value })),
              queryString: r.query ? r.query.split('&').map((q) => {
                const [name, value] = q.split('=');
                return { name, value: value || '' };
              }) : [],
              bodySize: r.body?.length || 0,
              postData: r.body ? { mimeType: 'application/json', text: r.body } : undefined,
            },
            response: {
              status: r.statusCode || 0,
              statusText: '',
              headers: r.responseHeaders
                ? Object.entries(r.responseHeaders).map(([name, value]) => ({ name, value }))
                : [],
              bodySize: r.responseBody?.length || 0,
              content: r.responseBody
                ? { size: r.responseBody.length, text: r.responseBody }
                : { size: 0, text: '' },
            },
            timings: { send: 0, wait: r.responseTime || 0, receive: 0 },
          })),
        },
      };
      data = JSON.stringify(har, null, 2);
      filename = `requests-${tunnelId}-${Date.now()}.har`;
      mimeType = 'application/json';
    }

    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredRequests = requests.filter((r) =>
    r.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMethodColor = (method: string): string => {
    switch (method) {
      case 'GET': return 'bg-green-500';
      case 'POST': return 'bg-blue-500';
      case 'PUT': return 'bg-yellow-500';
      case 'PATCH': return 'bg-orange-500';
      case 'DELETE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: number | null): string => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-blue-500';
    if (status >= 400 && status < 500) return 'text-yellow-500';
    if (status >= 500) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString();
  };

  if (loading && requests.length === 0) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/tunnels/${tunnelId}`}>
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('inspector.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('inspector.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            <Circle className={`h-2 w-2 mr-2 rtl:ml-2 rtl:mr-0 ${isLive ? 'fill-current animate-pulse' : ''}`} />
            {isLive ? t('inspector.live') : t('inspector.paused')}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select
            value="export"
            onValueChange={(value) => {
              if (value === 'json' || value === 'har') exportRequests(value);
            }}
          >
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('inspector.export')}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="export" disabled>{t('inspector.export')}</SelectItem>
              <SelectItem value="json">{t('inspector.exportJson')}</SelectItem>
              <SelectItem value="har">{t('inspector.exportHar')}</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('inspector.clear')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('inspector.clear')}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all logged requests for this tunnel. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={clearRequests} disabled={clearing}>
                  {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            placeholder={t('inspector.searchPlaceholder')}
            className="pl-10 rtl:pl-4 rtl:pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('inspector.filterMethod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inspector.allMethods')}</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('inspector.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inspector.allStatus')}</SelectItem>
            <SelectItem value="2xx">{t('inspector.statusCodes.2xx')}</SelectItem>
            <SelectItem value="3xx">{t('inspector.statusCodes.3xx')}</SelectItem>
            <SelectItem value="4xx">{t('inspector.statusCodes.4xx')}</SelectItem>
            <SelectItem value="5xx">{t('inspector.statusCodes.5xx')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request List */}
        <Card className="h-[600px] overflow-hidden flex flex-col">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{t('inspector.requestCount', { count: requests.length })}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                {isLive && <Loader2 className="h-8 w-8 animate-spin mb-4" />}
                <p>{isLive ? t('inspector.waitingForRequests') : t('inspector.noRequests')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedRequest?.id === request.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getMethodColor(request.method)} text-white text-xs`}>
                          {request.method}
                        </Badge>
                        <span className="font-mono text-sm truncate max-w-[200px]">
                          {request.path}
                        </span>
                      </div>
                      <span className={`font-mono text-sm ${getStatusColor(request.statusCode)}`}>
                        {request.statusCode || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(request.createdAt)}</span>
                      {request.responseTime && <span>{request.responseTime}ms</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Detail */}
        <Card className="h-[600px] overflow-hidden flex flex-col">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{t('inspector.detail.title')}</CardTitle>
            {selectedRequest && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {selectedRequest ? (
              <Tabs defaultValue="general" className="h-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="general">{t('inspector.detail.general')}</TabsTrigger>
                  <TabsTrigger value="headers">{t('inspector.detail.headers')}</TabsTrigger>
                  <TabsTrigger value="body">{t('inspector.detail.body')}</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Method</label>
                    <p className="font-mono">{selectedRequest.method}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Path</label>
                    <p className="font-mono break-all">{selectedRequest.path}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <p className={`font-mono ${getStatusColor(selectedRequest.statusCode)}`}>
                      {selectedRequest.statusCode || 'Pending'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Response Time</label>
                    <p className="font-mono">{selectedRequest.responseTime ? `${selectedRequest.responseTime}ms` : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">IP Address</label>
                    <p className="font-mono">{selectedRequest.ip || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Time</label>
                    <p className="font-mono">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                  </div>
                </TabsContent>

                <TabsContent value="headers" className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">{t('inspector.detail.requestHeaders')}</label>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(selectedRequest.headers, null, 2)}
                    </pre>
                  </div>
                  {selectedRequest.responseHeaders && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">{t('inspector.detail.responseHeaders')}</label>
                      <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                        {JSON.stringify(selectedRequest.responseHeaders, null, 2)}
                      </pre>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="body" className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">{t('inspector.detail.requestBody')}</label>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                      {selectedRequest.body || 'No body'}
                    </pre>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">{t('inspector.detail.responseBody')}</label>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                      {selectedRequest.responseBody || 'No body'}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a request to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
