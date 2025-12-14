/**
 * Authentication Middleware Wrapper
 * Provides reusable auth checking for API routes
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Logger, createLogger } from './logger';
import { ApiException, error as errorResponse, ApiResponse } from './withApiHandler';

// Session user type
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string;
}

// Auth context passed to handlers
export interface AuthContext {
  user: SessionUser;
  logger: Logger;
  params: Record<string, string>;
}

// Handler types
export type RouteParams = { params: Promise<Record<string, string>> };

export type AuthenticatedHandler<T = unknown> = (
  request: Request,
  context: AuthContext
) => Promise<NextResponse<ApiResponse<T>>>;

// Role-based access options
export interface AuthOptions {
  // Required roles (any of these roles will be accepted)
  roles?: string[];
  // If true, requires admin role
  adminOnly?: boolean;
}

/**
 * Wrap an API handler with authentication
 * Automatically checks for valid session and extracts user info
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options: AuthOptions = {}
) {
  return async (
    request: Request,
    routeParams?: RouteParams
  ): Promise<NextResponse<ApiResponse<T>>> => {
    const logger = createLogger(request);

    try {
      // Get session
      const session = await auth();

      // Check if authenticated
      if (!session?.user?.id) {
        logger.warn('Unauthorized access attempt');
        return errorResponse(
          'UNAUTHORIZED',
          'Not authenticated',
          401
        ) as NextResponse<ApiResponse<T>>;
      }

      const user: SessionUser = {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name,
        image: session.user.image,
        role: (session.user as { role?: string }).role,
      };

      // Check admin requirement
      if (options.adminOnly && user.role !== 'ADMIN') {
        logger.warn('Admin access required', { userId: user.id });
        return errorResponse(
          'FORBIDDEN',
          'Admin access required',
          403
        ) as NextResponse<ApiResponse<T>>;
      }

      // Check role requirements
      if (options.roles && options.roles.length > 0) {
        if (!user.role || !options.roles.includes(user.role)) {
          logger.warn('Insufficient role', { userId: user.id, userRole: user.role, requiredRoles: options.roles });
          return errorResponse(
            'FORBIDDEN',
            'Insufficient permissions',
            403
          ) as NextResponse<ApiResponse<T>>;
        }
      }

      // Resolve params if provided
      const params = routeParams?.params ? await routeParams.params : {};

      // Update logger with user context
      const userLogger = createLogger(request, user.id);

      // Execute handler
      return await handler(request, {
        user,
        logger: userLogger,
        params,
      });
    } catch (err) {
      if (err instanceof ApiException) {
        return errorResponse(
          err.code,
          err.message,
          err.statusCode,
          err.details
        ) as NextResponse<ApiResponse<T>>;
      }

      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error('Auth middleware error', errorObj);

      return errorResponse(
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : errorObj.message,
        500
      ) as NextResponse<ApiResponse<T>>;
    }
  };
}

/**
 * Shorthand for admin-only routes
 */
export function withAdminAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
  return withAuth(handler, { adminOnly: true });
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(user: SessionUser, roles: string[]): boolean {
  return !!user.role && roles.includes(user.role);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}
