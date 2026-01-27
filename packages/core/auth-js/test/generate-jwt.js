/**
 * Generate JWT tokens from signing_keys.json
 *
 * NOTE: This script is for manual inspection/debugging only.
 * JWT tokens are automatically generated at runtime in test/lib/clients.ts
 * You don't need to run this script or update tokens manually.
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read the signing key
const signingKeys = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'supabase/signing_keys.json'), 'utf8')
);

const rsaKey = signingKeys[0];

// Convert JWK to PEM format using native crypto
const privateKeyObject = crypto.createPrivateKey({
  key: rsaKey,
  format: 'jwk'
});
const privateKey = privateKeyObject.export({ type: 'pkcs8', format: 'pem' });

// Generate anon key
const anonToken = jwt.sign(
  {
    iss: 'supabase-demo',
    role: 'anon',
    exp: 1983812996,
    iat: 1768925145
  },
  privateKey,
  { algorithm: 'RS256', keyid: rsaKey.kid }
);

// Generate service_role key
const serviceRoleToken = jwt.sign(
  {
    iss: 'supabase-demo',
    role: 'service_role',
    exp: 1983812996,
    iat: 1768925145
  },
  privateKey,
  { algorithm: 'RS256', keyid: rsaKey.kid }
);

console.log('Anon Token:');
console.log(anonToken);
console.log('\nService Role Token:');
console.log(serviceRoleToken);
