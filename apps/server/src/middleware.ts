import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

// CORS configuration
const CORS_CONFIG = {
  // Allowed origins (configure via environment variable in production)
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  // Allowed methods
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // Allowed headers
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  // Expose headers to client
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  // Max age for preflight cache (24 hours)
  maxAge: 86400,
  // Allow credentials
  credentials: true,
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests

  // Allow all origins in development
  if (process.env.NODE_ENV === 'development') return true;

  // Check against allowed origins
  return CORS_CONFIG.allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.startsWith('*.')) {
      // Wildcard subdomain matching
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin.endsWith(`.${domain}`);
    }
    return origin === allowed;
  });
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const allowedOrigin = isOriginAllowed(origin) ? (origin || '*') : '';

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', CORS_CONFIG.allowedMethods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', CORS_CONFIG.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Expose-Headers', CORS_CONFIG.exposedHeaders.join(', '));
    response.headers.set('Access-Control-Max-Age', CORS_CONFIG.maxAge.toString());

    if (CORS_CONFIG.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return response;
}

/**
 * Handle CORS preflight request
 */
function handlePreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin);
}

// Security headers for all responses
const securityHeaders: Record<string, string> = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Enable XSS filtering (for older browsers)
  'X-XSS-Protection': '1; mode=block',
  // Prevent DNS prefetching leaks
  'X-DNS-Prefetch-Control': 'off',
  // Prevent Adobe products from embedding content
  'X-Permitted-Cross-Domain-Policies': 'none',
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for Next.js
    "style-src 'self' 'unsafe-inline'", // Allow inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:", // Allow WebSocket connections
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  // Strict Transport Security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Permissions Policy (disable sensitive features)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()', // Disable FLoC
  ].join(', '),
};

// Create the internationalization middleware
const intlMiddleware = createIntlMiddleware(routing);

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Routes that require authentication
const protectedRoutes = ['/settings/api-keys'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/auth/login', '/auth/register'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle CORS preflight requests for API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api')) {
    const preflightResponse = handlePreflight(request);
    return addSecurityHeaders(preflightResponse);
  }

  // First, run the intl middleware
  const response = intlMiddleware(request);

  // Get session token from cookies (simple check)
  const sessionToken = request.cookies.get('authjs.session-token')?.value ||
                       request.cookies.get('__Secure-authjs.session-token')?.value;

  // Remove locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/(en|ar)/, '');

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // Check if it's an auth route
  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !sessionToken) {
    const locale = pathname.match(/^\/(en|ar)/)?.[1] || 'en';
    const redirectResponse = NextResponse.redirect(
      new URL(`/${locale}/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url)
    );
    addSecurityHeaders(redirectResponse);
    return addCorsHeaders(redirectResponse, origin);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && sessionToken) {
    const locale = pathname.match(/^\/(en|ar)/)?.[1] || 'en';
    const redirectResponse = NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    addSecurityHeaders(redirectResponse);
    return addCorsHeaders(redirectResponse, origin);
  }

  // Add security headers and CORS headers to the response
  addSecurityHeaders(response);

  // Add CORS headers for API routes
  if (pathname.startsWith('/api')) {
    addCorsHeaders(response, origin);
  }

  return response;
}

export const config = {
  // Match internationalized pathnames and API routes
  matcher: ['/', '/(ar|en)/:path*', '/api/:path*'],
};
