/**
 * Paddle Configuration (EU - Merchant of Record)
 * https://developer.paddle.com/
 */

export const paddleConfig = {
  vendorId: parseInt(process.env.PADDLE_VENDOR_ID || '0'),
  apiKey: process.env.PADDLE_API_KEY || '',
  publicKey: process.env.PADDLE_PUBLIC_KEY || '',
  webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',
  sandbox: process.env.PADDLE_SANDBOX === 'true',

  // Product/Price IDs
  prices: {
    starter: {
      monthly: process.env.PADDLE_PRICE_STARTER_MONTHLY || '',
      yearly: process.env.PADDLE_PRICE_STARTER_YEARLY || '',
    },
    pro: {
      monthly: process.env.PADDLE_PRICE_PRO_MONTHLY || '',
      yearly: process.env.PADDLE_PRICE_PRO_YEARLY || '',
    },
    enterprise: {
      monthly: process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY || '',
      yearly: process.env.PADDLE_PRICE_ENTERPRISE_YEARLY || '',
    },
  },
};

// Get base URL (sandbox or production)
export function getPaddleBaseUrl(): string {
  return paddleConfig.sandbox
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com';
}

// Validate configuration
export function validatePaddleConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!paddleConfig.vendorId) {
    errors.push('PADDLE_VENDOR_ID is required');
  }

  if (!paddleConfig.apiKey) {
    errors.push('PADDLE_API_KEY is required');
  }

  if (!paddleConfig.webhookSecret) {
    errors.push('PADDLE_WEBHOOK_SECRET is required for webhook verification');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Check if Paddle is configured
export function isPaddleConfigured(): boolean {
  return !!paddleConfig.vendorId && !!paddleConfig.apiKey;
}
