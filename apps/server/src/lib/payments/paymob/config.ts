/**
 * Paymob Configuration (Egypt)
 * https://developers.paymob.com/egypt/
 */

export const paymobConfig = {
  apiKey: process.env.PAYMOB_API_KEY || '',
  integrationIds: {
    card: parseInt(process.env.PAYMOB_INTEGRATION_ID_CARD || '0'),
    wallet: parseInt(process.env.PAYMOB_INTEGRATION_ID_WALLET || '0'),
    kiosk: parseInt(process.env.PAYMOB_INTEGRATION_ID_KIOSK || '0'),
  },
  hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
  iframe: {
    card: process.env.PAYMOB_IFRAME_ID_CARD || '',
    wallet: process.env.PAYMOB_IFRAME_ID_WALLET || '',
  },
  baseUrl: 'https://accept.paymob.com/api',
};

// Validate configuration
export function validatePaymobConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!paymobConfig.apiKey) {
    errors.push('PAYMOB_API_KEY is required');
  }

  if (!paymobConfig.integrationIds.card) {
    errors.push('PAYMOB_INTEGRATION_ID_CARD is required');
  }

  if (!paymobConfig.hmacSecret) {
    errors.push('PAYMOB_HMAC_SECRET is required for webhook verification');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Check if Paymob is configured
export function isPaymobConfigured(): boolean {
  return !!paymobConfig.apiKey && !!paymobConfig.integrationIds.card;
}
