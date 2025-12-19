/**
 * PayTabs Configuration (MENA Region)
 * https://site.paytabs.com/en/pt2-api-endpoints/
 */

export const paytabsConfig = {
  profileId: process.env.PAYTABS_PROFILE_ID || '',
  serverKey: process.env.PAYTABS_SERVER_KEY || '',
  region: (process.env.PAYTABS_REGION || 'SAU') as 'SAU' | 'ARE' | 'EGY' | 'OMN' | 'JOR' | 'GLO',

  // Base URLs by region
  baseUrls: {
    SAU: 'https://secure.paytabs.sa',
    ARE: 'https://secure.paytabs.com',
    EGY: 'https://secure-egypt.paytabs.com',
    OMN: 'https://secure-oman.paytabs.com',
    JOR: 'https://secure-jordan.paytabs.com',
    GLO: 'https://secure-global.paytabs.com',
  } as Record<string, string>,
};

// Get base URL for configured region
export function getPaytabsBaseUrl(): string {
  return paytabsConfig.baseUrls[paytabsConfig.region] || paytabsConfig.baseUrls.GLO;
}

// Validate configuration
export function validatePaytabsConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!paytabsConfig.profileId) {
    errors.push('PAYTABS_PROFILE_ID is required');
  }

  if (!paytabsConfig.serverKey) {
    errors.push('PAYTABS_SERVER_KEY is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Check if PayTabs is configured
export function isPaytabsConfigured(): boolean {
  return !!paytabsConfig.profileId && !!paytabsConfig.serverKey;
}
