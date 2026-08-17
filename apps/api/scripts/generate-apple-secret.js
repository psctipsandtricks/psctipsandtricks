/**
 * Generates an Apple OAuth Client Secret JWT (valid for 6 months / 180 days)
 * for Supabase and Apple OAuth.
 *
 * Usage:
 *   node scripts/generate-apple-secret.js
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const teamId = process.env.APPLE_TEAM_ID || '938ZH76PD5';
const keyId = process.env.APPLE_KEY_ID || '2475HWL284';
const clientId = process.env.APPLE_CLIENT_ID || 'com.psctips.web';
let privateKey = process.env.APPLE_PRIVATE_KEY;

if (!privateKey || privateKey.includes('unconfigured')) {
  const downloadPath = path.join(require('os').homedir(), 'Downloads', `AuthKey_${keyId}.p8`);
  if (fs.existsSync(downloadPath)) {
    privateKey = fs.readFileSync(downloadPath, 'utf8');
  }
}

if (!privateKey) {
  console.error('Error: APPLE_PRIVATE_KEY is missing.');
  process.exit(1);
}

// Format newline escapes if needed
const formattedKey = privateKey.replace(/\\n/g, '\n');

const now = Math.floor(Date.now() / 1000);
const exp = now + 180 * 24 * 60 * 60; // 180 days

const clientSecret = jwt.sign(
  {
    iss: teamId,
    iat: now,
    exp: exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  },
  formattedKey,
  {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  },
);

console.log('\n======================================================');
console.log(' Generated Apple Client Secret (Paste into Supabase):');
console.log('======================================================\n');
console.log(clientSecret);
console.log('\n======================================================\n');
