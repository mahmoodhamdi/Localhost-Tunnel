/**
 * Unit tests for distributed tracing module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  parseTraceParent,
  createTraceParent,
  extractTraceContext,
  injectTraceContext,
  shouldSample,
  startSpan,
  endSpan,
  addSpanEvent,
  setSpanAttributes,
  setSpanStatus,
  createChildSpan,
  withSpan,
  setSpanExporter,
  getSpanContext,
  createTraceContext,
  getHttpAttributes,
  setHttpResponseAttributes,
  getDbAttributes,
  TRACE_PARENT_HEADER,
  TRACE_STATE_HEADER,
  TRACE_ID_HEADER,
  SPAN_ID_HEADER,
  PARENT_SPAN_ID_HEADER,
} from '@/lib/tracing';

describe('Tracing Module', () => {
  let exportedSpans: any[];

  beforeEach(() => {
    exportedSpans = [];
    setSpanExporter((span) => exportedSpans.push(span));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTraceId', () => {
    it('should generate 32 character hex string', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSpanId', () => {
    it('should generate 16 character hex string', () => {
      const spanId = generateSpanId();
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('parseTraceParent', () => {
    it('should parse valid traceparent header', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const context = parseTraceParent(header);

      expect(context).not.toBeNull();
      expect(context!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(context!.parentSpanId).toBe('00f067aa0ba902b7');
      expect(context!.sampled).toBe(true);
    });

    it('should parse unsampled trace', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00';
      const context = parseTraceParent(header);

      expect(context).not.toBeNull();
      expect(context!.sampled).toBe(false);
    });

    it('should return null for null input', () => {
      expect(parseTraceParent(null)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseTraceParent('invalid')).toBeNull();
      expect(parseTraceParent('00-abc-def-01')).toBeNull();
    });

    it('should return null for unsupported version', () => {
      const header = '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      expect(parseTraceParent(header)).toBeNull();
    });

    it('should return null for all-zero trace ID', () => {
      const header = '00-00000000000000000000000000000000-00f067aa0ba902b7-01';
      expect(parseTraceParent(header)).toBeNull();
    });

    it('should return null for all-zero parent ID', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01';
      expect(parseTraceParent(header)).toBeNull();
    });
  });

  describe('createTraceParent', () => {
    it('should create valid traceparent header for sampled trace', () => {
      const context = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        sampled: true,
      };

      const header = createTraceParent(context);
      expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    });

    it('should create valid traceparent header for unsampled trace', () => {
      const context = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        sampled: false,
      };

      const header = createTraceParent(context);
      expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
    });
  });

  describe('extractTraceContext', () => {
    it('should extract context from traceparent header', () => {
      const headers = new Headers({
        [TRACE_PARENT_HEADER]: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        [TRACE_STATE_HEADER]: 'vendor=value',
      });

      const context = extractTraceContext(headers);

      expect(context.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(context.parentSpanId).toBe('00f067aa0ba902b7');
      expect(context.traceState).toBe('vendor=value');
    });

    it('should extract context from custom headers', () => {
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      const headers = new Headers({
        [TRACE_ID_HEADER]: traceId,
        [SPAN_ID_HEADER]: spanId,
      });

      const context = extractTraceContext(headers);

      expect(context.traceId).toBe(traceId);
      expect(context.parentSpanId).toBe(spanId);
    });

    it('should create new context when no headers present', () => {
      const headers = new Headers();
      const context = extractTraceContext(headers);

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(context.parentSpanId).toBeUndefined();
    });
  });

  describe('injectTraceContext', () => {
    it('should inject W3C headers', () => {
      const context = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        sampled: true,
        traceState: 'vendor=value',
      };

      const headers = new Headers();
      injectTraceContext(context, headers);

      expect(headers.get(TRACE_PARENT_HEADER)).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
      expect(headers.get(TRACE_STATE_HEADER)).toBe('vendor=value');
      expect(headers.get(TRACE_ID_HEADER)).toBe(context.traceId);
      expect(headers.get(SPAN_ID_HEADER)).toBe(context.spanId);
    });

    it('should inject parent span ID when present', () => {
      const context = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        parentSpanId: 'aabbccddeeff0011',
        sampled: true,
      };

      const headers = new Headers();
      injectTraceContext(context, headers);

      expect(headers.get(PARENT_SPAN_ID_HEADER)).toBe('aabbccddeeff0011');
    });
  });

  describe('shouldSample', () => {
    it('should sample based on default rate', () => {
      // With rate 1.0, should always sample
      const config = {
        rate: 1.0,
        alwaysSampleErrors: true,
        operationRules: new Map(),
      };

      expect(shouldSample(undefined, config)).toBe(true);
    });

    it('should never sample with rate 0', () => {
      const config = {
        rate: 0,
        alwaysSampleErrors: true,
        operationRules: new Map(),
      };

      expect(shouldSample(undefined, config)).toBe(false);
    });

    it('should use operation-specific rules', () => {
      const config = {
        rate: 0,
        alwaysSampleErrors: true,
        operationRules: new Map([['test-op', 1.0]]),
      };

      expect(shouldSample('test-op', config)).toBe(true);
      expect(shouldSample('other-op', config)).toBe(false);
    });
  });

  describe('Span Management', () => {
    describe('startSpan', () => {
      it('should create span with default values', () => {
        const span = startSpan('test-operation');

        expect(span.operationName).toBe('test-operation');
        expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(span.status).toBe('unset');
        expect(span.kind).toBe('internal');
        expect(span.startTime).toBeLessThanOrEqual(Date.now());
      });

      it('should create span with parent context', () => {
        const parentContext = {
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          spanId: '00f067aa0ba902b7',
          sampled: true,
        };

        const span = startSpan('child-operation', { parentContext });

        expect(span.traceId).toBe(parentContext.traceId);
        expect(span.parentSpanId).toBe(parentContext.spanId);
      });

      it('should create span with custom attributes', () => {
        const span = startSpan('test-operation', {
          kind: 'server',
          attributes: { 'custom.attr': 'value' },
        });

        expect(span.kind).toBe('server');
        expect(span.attributes['custom.attr']).toBe('value');
      });
    });

    describe('endSpan', () => {
      it('should set end time and duration', () => {
        const span = startSpan('test-operation');

        // Wait a bit
        const start = Date.now();
        while (Date.now() - start < 10) {}

        endSpan(span);

        expect(span.endTime).toBeGreaterThan(span.startTime);
        expect(span.duration).toBeGreaterThanOrEqual(0);
        expect(span.status).toBe('ok');
      });

      it('should set error status', () => {
        const span = startSpan('test-operation');
        endSpan(span, 'error');

        expect(span.status).toBe('error');
      });

      it('should export span', () => {
        const span = startSpan('test-operation');
        endSpan(span);

        expect(exportedSpans).toHaveLength(1);
        expect(exportedSpans[0]).toBe(span);
      });
    });

    describe('addSpanEvent', () => {
      it('should add event to span', () => {
        const span = startSpan('test-operation');

        addSpanEvent(span, 'test-event', { key: 'value' });

        expect(span.events).toHaveLength(1);
        expect(span.events[0].name).toBe('test-event');
        expect(span.events[0].attributes).toEqual({ key: 'value' });
        expect(span.events[0].timestamp).toBeLessThanOrEqual(Date.now());
      });
    });

    describe('setSpanAttributes', () => {
      it('should set span attributes', () => {
        const span = startSpan('test-operation');

        setSpanAttributes(span, { key1: 'value1', key2: 123 });

        expect(span.attributes.key1).toBe('value1');
        expect(span.attributes.key2).toBe(123);
      });

      it('should merge with existing attributes', () => {
        const span = startSpan('test-operation', {
          attributes: { existing: 'value' },
        });

        setSpanAttributes(span, { new: 'attribute' });

        expect(span.attributes.existing).toBe('value');
        expect(span.attributes.new).toBe('attribute');
      });
    });

    describe('setSpanStatus', () => {
      it('should set ok status', () => {
        const span = startSpan('test-operation');
        setSpanStatus(span, 'ok');

        expect(span.status).toBe('ok');
        expect(span.error).toBeUndefined();
      });

      it('should set error status with message', () => {
        const span = startSpan('test-operation');
        setSpanStatus(span, 'error', 'Something went wrong');

        expect(span.status).toBe('error');
        expect(span.error).toEqual({ message: 'Something went wrong' });
      });
    });

    describe('createChildSpan', () => {
      it('should create child span with parent reference', () => {
        const parent = startSpan('parent-operation');
        const child = createChildSpan(parent, 'child-operation');

        expect(child.traceId).toBe(parent.traceId);
        expect(child.parentSpanId).toBe(parent.spanId);
        expect(child.operationName).toBe('child-operation');
      });
    });
  });

  describe('withSpan', () => {
    it('should wrap async function and end span on success', async () => {
      const result = await withSpan('test-operation', async (span) => {
        expect(span.operationName).toBe('test-operation');
        return 'success';
      });

      expect(result).toBe('success');
      expect(exportedSpans).toHaveLength(1);
      expect(exportedSpans[0].status).toBe('ok');
    });

    it('should wrap async function and set error on failure', async () => {
      const error = new Error('Test error');

      await expect(
        withSpan('test-operation', async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');

      expect(exportedSpans).toHaveLength(1);
      expect(exportedSpans[0].status).toBe('error');
      expect(exportedSpans[0].error?.message).toBe('Test error');
    });
  });

  describe('getSpanContext', () => {
    it('should return trace context from span', () => {
      const span = startSpan('test-operation');
      const context = getSpanContext(span);

      expect(context.traceId).toBe(span.traceId);
      expect(context.spanId).toBe(span.spanId);
      expect(context.sampled).toBe(true);
    });
  });

  describe('createTraceContext', () => {
    it('should create context with provided trace ID', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const context = createTraceContext(traceId);

      expect(context.traceId).toBe(traceId);
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should create context with generated trace ID', () => {
      const context = createTraceContext();

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('HTTP Attributes', () => {
    describe('getHttpAttributes', () => {
      it('should extract HTTP attributes from request', () => {
        const request = new Request('https://example.com/api/test?foo=bar', {
          method: 'POST',
          headers: { 'user-agent': 'test-agent' },
        });

        const attrs = getHttpAttributes(request);

        expect(attrs['http.method']).toBe('POST');
        expect(attrs['http.url']).toBe('https://example.com/api/test?foo=bar');
        expect(attrs['http.host']).toBe('example.com');
        expect(attrs['http.path']).toBe('/api/test');
        expect(attrs['http.scheme']).toBe('https');
        expect(attrs['http.user_agent']).toBe('test-agent');
      });
    });

    describe('setHttpResponseAttributes', () => {
      it('should set response attributes for success', () => {
        const span = startSpan('http-request');
        setHttpResponseAttributes(span, 200, 1024);

        expect(span.attributes['http.status_code']).toBe(200);
        expect(span.attributes['http.response_content_length']).toBe(1024);
        expect(span.status).toBe('ok');
      });

      it('should set error status for 5xx', () => {
        const span = startSpan('http-request');
        setHttpResponseAttributes(span, 500);

        expect(span.attributes['http.status_code']).toBe(500);
        expect(span.status).toBe('error');
      });
    });
  });

  describe('Database Attributes', () => {
    it('should return db attributes', () => {
      const attrs = getDbAttributes('findMany', 'users');

      expect(attrs['db.system']).toBe('prisma');
      expect(attrs['db.operation']).toBe('findMany');
      expect(attrs['db.table']).toBe('users');
    });
  });
});
