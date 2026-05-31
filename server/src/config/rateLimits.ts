export interface RateLimitTier {
  requests: number;
  window: number; // milliseconds
}

export interface RateLimitConfig {
  [key: string]: RateLimitTier;
}

export const RATE_LIMITS: RateLimitConfig = {
  REGISTER: {
    requests: parseInt(process.env.RATE_LIMIT_REGISTER_REQUESTS || '5', 10),
    window: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || '3600000', 10) // 1 hour
  },
  STANDARD: {
    requests: parseInt(process.env.RATE_LIMIT_STANDARD_REQUESTS || '100', 10),
    window: parseInt(process.env.RATE_LIMIT_STANDARD_WINDOW || '900000', 10) // 15 minutes
  },
  DETECTION: {
    requests: parseInt(process.env.RATE_LIMIT_DETECTION_REQUESTS || '10', 10),
    window: parseInt(process.env.RATE_LIMIT_DETECTION_WINDOW || '60000', 10) // 1 minute
  },
  BATCH: {
    requests: parseInt(process.env.RATE_LIMIT_BATCH_REQUESTS || '5', 10),
    window: parseInt(process.env.RATE_LIMIT_BATCH_WINDOW || '3600000', 10) // 1 hour
  }
};

export type RateLimitTierType = keyof typeof RATE_LIMITS;

export interface EndpointRateLimitMapping {
  pattern: RegExp;
  tier: RateLimitTierType;
}

export const RATE_LIMIT_ENDPOINTS: EndpointRateLimitMapping[] = [
  { pattern: /^\/api\/detection\/.*/, tier: 'DETECTION' },
  { pattern: /^\/api\/batch\/.*/, tier: 'BATCH' },
  { pattern: /^\/api\/.*/, tier: 'STANDARD' }
];

export function getRateLimitTierForPath(path: string): RateLimitTierType {
  for (const mapping of RATE_LIMIT_ENDPOINTS) {
    if (mapping.pattern.test(path)) {
      return mapping.tier;
    }
  }
  return 'STANDARD';
}
