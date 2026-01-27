#!/usr/bin/env node
/**
 * Generates RSA signing keys in JWK format for auth-js test infrastructure.
 *
 * IMPORTANT: These keys are for LOCAL TESTING ONLY. Never use in production.
 *
 * Usage: node generate-signing-keys.js
 *
 * This will create a new signing_keys.json file with a fresh RSA-2048 key pair.
 * After generating, you'll need to regenerate the JWT tokens using generate-jwt.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate RSA-2048 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert to JWK format
const privateKeyObject = crypto.createPrivateKey(privateKey);
const jwk = privateKeyObject.export({ format: 'jwk' });

// Add required fields for GoTrue
const signingKey = {
  ...jwk,
  kid: crypto.randomUUID(), // Unique key ID
  key_ops: ['sign', 'verify'],
  alg: 'RS256'
};

// Create signing keys array (GoTrue expects an array)
const signingKeys = [signingKey];

// Write to file
const outputPath = path.join(__dirname, 'supabase', 'signing_keys.json');
fs.writeFileSync(outputPath, JSON.stringify(signingKeys, null, 2) + '\n');

console.log('✅ Generated new RSA-2048 signing keys for testing');
console.log(`📁 Written to: ${outputPath}`);
console.log(`🔑 Key ID: ${signingKey.kid}`);
console.log('');
console.log('⚠️  IMPORTANT: This is a TEST KEY for local development only.');
console.log('   Never use these keys in production environments.');
console.log('');
console.log('✨ JWT tokens will be automatically generated at runtime from these keys.');
