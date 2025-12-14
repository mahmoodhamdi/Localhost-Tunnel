import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

// Create the internationalization middleware
const intlMiddleware = createIntlMiddleware(routing);

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
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url)
    );
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && sessionToken) {
    const locale = pathname.match(/^\/(en|ar)/)?.[1] || 'en';
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return response;
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ar|en)/:path*'],
};
