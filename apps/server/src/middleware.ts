import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

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
    return addSecurityHeaders(redirectResponse);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && sessionToken) {
    const locale = pathname.match(/^\/(en|ar)/)?.[1] || 'en';
    const redirectResponse = NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    return addSecurityHeaders(redirectResponse);
  }

  // Add security headers to the response
  return addSecurityHeaders(response);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ar|en)/:path*'],
};
