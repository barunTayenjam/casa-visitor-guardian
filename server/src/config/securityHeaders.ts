import helmet from 'helmet';
import { collectInlineScriptHashes } from './cspHashes.js';
import { getFrontendDistPath } from './frontendDist.js';

// Build security header config based on environment.
export const securityHeaders = () => {
  const inlineScriptHashes = collectInlineScriptHashes(getFrontendDistPath());
  return helmet({
    strictTransportSecurity:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...inlineScriptHashes],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        workerSrc: ["'self'", 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        // HTTP-only LAN deployment — upgrade-insecure-requests would rewrite
        // every subresource to https:// and break all asset loading.
        upgradeInsecureRequests: null,
      },
    },
  });
};
