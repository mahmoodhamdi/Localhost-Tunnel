/**
 * Distributed Tracing Module
 * Provides trace context propagation and span management
 * Compatible with W3C Trace Context standard
 */

import crypto from 'crypto';

// Trace context header names (W3C Trace Context standard)
export const TRACE_PARENT_HEADER = 'traceparent';
export const TRACE_STATE_HEADER = 'tracestate';

// Custom headers for additional context
export const TRACE_ID_HEADER = 'x-trace-id';
export const SPAN_ID_HEADER = 'x-span-id';
export const PARENT_SPAN_ID_HEADER = 'x-parent-span-id';
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Trace context containing all tracing identifiers
 */
export interface TraceContext {
  // W3C Trace Context format: 32 hex characters
  traceId: string;
  // Span ID: 16 hex characters
  spanId: string;
  // Parent span ID (if exists)
  parentSpanId?: string;
  // Sampling decision
  sampled: boolean;
  // Trace state (vendor-specific key-value pairs)
  traceState?: string;
}

/**
 * Span represents a single operation within a trace
 */
export interface Span {
  // Unique span identifier
  spanId: string;
  // Trace this span belongs to
  traceId: string;
  // Parent span (if any)
  parentSpanId?: string;
  // Operation name
  operationName: string;
  // Service name
  serviceName: string;
  // Start timestamp
  startTime: number;
  // End timestamp (set when span is finished)
  endTime?: number;
  // Duration in milliseconds
  duration?: number;
  // Span status
  status: 'ok' | 'error' | 'unset';
  // Span kind
  kind: 'server' | 'client' | 'producer' | 'consumer' | 'internal';
  // Attributes/tags
  attributes: Record<string, string | number | boolean>;
  // Events/logs within the span
  events: SpanEvent[];
  // Error details if status is 'error'
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Event within a span
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  // Sample rate (0.0 to 1.0)
  rate: number;
  // Always sample errors
  alwaysSampleErrors: boolean;
  // Sample specific operations
  operationRules: Map<string, number>;
}

// Default sampling config
const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  rate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
  alwaysSampleErrors: true,
  operationRules: new Map(),
};

// Active spans storage (for async context tracking)
const activeSpans = new Map<string, Span>();

// Maximum span age before automatic cleanup (5 minutes)
const MAX_SPAN_AGE_MS = 5 * 60 * 1000;

// Cleanup interval (1 minute)
const SPAN_CLEANUP_INTERVAL_MS = 60 * 1000;

// Span export callback
let spanExporter: ((span: Span) => void) | null = null;

// Cleanup abandoned spans to prevent memory leaks
function cleanupAbandonedSpans(): void {
  const now = Date.now();
  const spansToDelete: string[] = [];

  for (const [spanId, span] of activeSpans) {
    if (now - span.startTime > MAX_SPAN_AGE_MS) {
      spansToDelete.push(spanId);
      // End the span with error status
      span.endTime = now;
      span.duration = now - span.startTime;
      span.status = 'error';
      span.error = { message: 'Span abandoned (timeout)' };

      // Still export abandoned spans for debugging
      if (spanExporter) {
        spanExporter(span);
      }
    }
  }

  for (const spanId of spansToDelete) {
    activeSpans.delete(spanId);
  }

  if (spansToDelete.length > 0) {
    console.warn(`Cleaned up ${spansToDelete.length} abandoned spans`);
  }
}

// Start periodic cleanup (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupAbandonedSpans, SPAN_CLEANUP_INTERVAL_MS);
}

/**
 * Generate a trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a span ID (16 hex characters)
 */
export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Parse W3C traceparent header
 * Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
export function parseTraceParent(header: string | null): TraceContext | null {
  if (!header) return null;

  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, parentId, flags] = parts;

  // Validate version (only 00 is currently supported)
  if (version !== '00') return null;

  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === '0'.repeat(32)) return null;

  // Validate parent ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/.test(parentId) || parentId === '0'.repeat(16)) return null;

  // Validate flags (2 hex chars)
  if (!/^[0-9a-f]{2}$/.test(flags)) return null;

  // Check sampled flag (bit 0)
  const sampled = (parseInt(flags, 16) & 0x01) === 1;

  return {
    traceId,
    spanId: generateSpanId(),
    parentSpanId: parentId,
    sampled,
  };
}

/**
 * Create traceparent header value
 */
export function createTraceParent(context: TraceContext): string {
  const flags = context.sampled ? '01' : '00';
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(headers: Headers): TraceContext {
  // Try W3C Trace Context first
  const traceparent = headers.get(TRACE_PARENT_HEADER);
  const parsedContext = parseTraceParent(traceparent);

  if (parsedContext) {
    parsedContext.traceState = headers.get(TRACE_STATE_HEADER) || undefined;
    return parsedContext;
  }

  // Try custom headers
  const traceId = headers.get(TRACE_ID_HEADER);
  const parentSpanId = headers.get(SPAN_ID_HEADER);

  // Create new trace context
  return {
    traceId: traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parentSpanId || undefined,
    sampled: shouldSample(),
  };
}

/**
 * Inject trace context into outgoing request headers
 */
export function injectTraceContext(context: TraceContext, headers: Headers): void {
  // Set W3C Trace Context
  headers.set(TRACE_PARENT_HEADER, createTraceParent(context));

  if (context.traceState) {
    headers.set(TRACE_STATE_HEADER, context.traceState);
  }

  // Set custom headers for compatibility
  headers.set(TRACE_ID_HEADER, context.traceId);
  headers.set(SPAN_ID_HEADER, context.spanId);

  if (context.parentSpanId) {
    headers.set(PARENT_SPAN_ID_HEADER, context.parentSpanId);
  }
}

/**
 * Determine if a trace should be sampled
 */
export function shouldSample(
  operationName?: string,
  config: SamplingConfig = DEFAULT_SAMPLING_CONFIG
): boolean {
  // Check operation-specific rules
  if (operationName && config.operationRules.has(operationName)) {
    const rate = config.operationRules.get(operationName)!;
    return Math.random() < rate;
  }

  // Use default rate
  return Math.random() < config.rate;
}

/**
 * Start a new span
 */
export function startSpan(
  operationName: string,
  options: {
    kind?: Span['kind'];
    parentContext?: TraceContext;
    attributes?: Record<string, string | number | boolean>;
    serviceName?: string;
  } = {}
): Span {
  const {
    kind = 'internal',
    parentContext,
    attributes = {},
    serviceName = process.env.SERVICE_NAME || 'localhost-tunnel',
  } = options;

  const span: Span = {
    spanId: generateSpanId(),
    traceId: parentContext?.traceId || generateTraceId(),
    parentSpanId: parentContext?.spanId,
    operationName,
    serviceName,
    startTime: Date.now(),
    status: 'unset',
    kind,
    attributes,
    events: [],
  };

  activeSpans.set(span.spanId, span);

  return span;
}

/**
 * Add an event to a span
 */
export function addSpanEvent(
  span: Span,
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  span.events.push({
    name,
    timestamp: Date.now(),
    attributes,
  });
}

/**
 * Set span attributes
 */
export function setSpanAttributes(
  span: Span,
  attributes: Record<string, string | number | boolean>
): void {
  Object.assign(span.attributes, attributes);
}

/**
 * Set span status
 */
export function setSpanStatus(
  span: Span,
  status: 'ok' | 'error',
  errorMessage?: string
): void {
  span.status = status;

  if (status === 'error' && errorMessage) {
    span.error = { message: errorMessage };
  }
}

/**
 * End a span
 */
export function endSpan(span: Span, status?: 'ok' | 'error'): void {
  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;

  if (status) {
    span.status = status;
  } else if (span.status === 'unset') {
    span.status = 'ok';
  }

  activeSpans.delete(span.spanId);

  // Export span
  if (spanExporter) {
    spanExporter(span);
  }
}

/**
 * Create a child span
 */
export function createChildSpan(
  parentSpan: Span,
  operationName: string,
  options: {
    kind?: Span['kind'];
    attributes?: Record<string, string | number | boolean>;
  } = {}
): Span {
  return startSpan(operationName, {
    ...options,
    parentContext: {
      traceId: parentSpan.traceId,
      spanId: parentSpan.spanId,
      sampled: true,
    },
  });
}

/**
 * Wrap an async function with tracing
 */
export async function withSpan<T>(
  operationName: string,
  fn: (span: Span) => Promise<T>,
  options: {
    kind?: Span['kind'];
    parentContext?: TraceContext;
    attributes?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  const span = startSpan(operationName, options);

  try {
    const result = await fn(span);
    endSpan(span, 'ok');
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    span.error = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    };
    endSpan(span, 'error');
    throw error;
  }
}

/**
 * Set the span exporter
 */
export function setSpanExporter(exporter: (span: Span) => void): void {
  spanExporter = exporter;
}

/**
 * Get trace context for a span
 */
export function getSpanContext(span: Span): TraceContext {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    sampled: true,
  };
}

/**
 * Create a trace context from trace ID
 */
export function createTraceContext(traceId?: string): TraceContext {
  return {
    traceId: traceId || generateTraceId(),
    spanId: generateSpanId(),
    sampled: shouldSample(),
  };
}

/**
 * Console span exporter (for development)
 */
export function consoleSpanExporter(span: Span): void {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const output = {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    operationName: span.operationName,
    serviceName: span.serviceName,
    duration: span.duration,
    status: span.status,
    kind: span.kind,
    attributes: span.attributes,
    events: span.events.length > 0 ? span.events : undefined,
    error: span.error,
  };

  if (isDevelopment) {
    const statusEmoji = span.status === 'error' ? '❌' : '✓';
    console.log(
      `[TRACE] ${statusEmoji} ${span.operationName} (${span.duration}ms) trace=${span.traceId.slice(0, 8)}... span=${span.spanId.slice(0, 8)}...`
    );
    if (span.error) {
      console.log(`[TRACE]   Error: ${span.error.message}`);
    }
  } else {
    console.log(JSON.stringify({ type: 'span', ...output }));
  }
}

/**
 * HTTP request tracing attributes
 */
export function getHttpAttributes(request: Request): Record<string, string | number | boolean> {
  const url = new URL(request.url);

  return {
    'http.method': request.method,
    'http.url': request.url,
    'http.host': url.host,
    'http.path': url.pathname,
    'http.scheme': url.protocol.replace(':', ''),
    'http.user_agent': request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Set HTTP response attributes
 */
export function setHttpResponseAttributes(
  span: Span,
  statusCode: number,
  contentLength?: number
): void {
  span.attributes['http.status_code'] = statusCode;

  if (contentLength !== undefined) {
    span.attributes['http.response_content_length'] = contentLength;
  }

  // Set status based on HTTP status code
  if (statusCode >= 500) {
    span.status = 'error';
  } else {
    span.status = 'ok';
  }
}

/**
 * Database tracing attributes
 */
export function getDbAttributes(
  operation: string,
  table: string,
  statement?: string
): Record<string, string | number | boolean> {
  return {
    'db.system': 'prisma',
    'db.operation': operation,
    'db.table': table,
    ...(statement && process.env.NODE_ENV !== 'production'
      ? { 'db.statement': statement }
      : {}),
  };
}

// Initialize console exporter in development
if (process.env.NODE_ENV !== 'production' && !spanExporter) {
  setSpanExporter(consoleSpanExporter);
}

export type { SamplingConfig };
