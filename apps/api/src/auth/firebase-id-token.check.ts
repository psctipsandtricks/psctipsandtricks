/**
 * Assertions for FirebaseIdTokenVerifier, the gate in front of email link
 * sign-in: whatever it accepts becomes a session on the account with that
 * email, so every way of forging or replaying a token has to be refused.
 *
 * Run with `npm run check:firebase-token`. A plain script rather than a spec
 * because the API has no test runner; it exits non-zero on any wrong answer.
 * Google's certificate endpoint is stubbed with a key generated here.
 */

// A module, not a global script: each check file declares its own `check`
// and `failures`, and without this they would collide with the others.
export {};

import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FirebaseIdTokenVerifier } from './firebase-id-token.verifier';

const PROJECT = 'demo-project';
const KID = 'test-kid';

const signing = generateKeyPairSync('rsa', { modulusLength: 2048 });
const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = signing.publicKey.export({ type: 'spki', format: 'pem' }).toString();

globalThis.fetch = (async () =>
  new Response(JSON.stringify({ [KID]: publicPem }), {
    headers: { 'cache-control': 'public, max-age=600' },
  })) as typeof fetch;

const jwt = new JwtService({});
const verifier = new FirebaseIdTokenVerifier(
  jwt,
  new ConfigService({ FIREBASE_PROJECT_ID: PROJECT }),
);

const goodClaims = {
  sub: 'firebase-uid',
  email: 'Student@Example.com',
  email_verified: true,
};

function sign(
  claims: Record<string, unknown>,
  opts: { key?: typeof signing.privateKey; audience?: string; issuer?: string; expiresIn?: number; kid?: string } = {},
) {
  return jwt.sign(claims, {
    privateKey: opts.key ?? signing.privateKey,
    algorithm: 'RS256',
    keyid: opts.kid ?? KID,
    audience: opts.audience ?? PROJECT,
    issuer: opts.issuer ?? `https://securetoken.google.com/${PROJECT}`,
    expiresIn: opts.expiresIn ?? 3600,
  });
}

function unsigned(claims: Record<string, unknown>) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', kid: KID })}.${b64({
    ...claims,
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.`;
}

let failures = 0;

async function accepts(name: string, token: string) {
  try {
    const claims = await verifier.verify(token);
    if (claims.email !== goodClaims.email) throw new Error(`wrong email ${claims.email}`);
    console.log(`ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}: rejected (${err})`);
  }
}

async function rejects(name: string, token: string) {
  try {
    await verifier.verify(token);
    failures += 1;
    console.error(`FAIL ${name}: accepted`);
  } catch {
    console.log(`ok   ${name}`);
  }
}

async function main() {
  await accepts('a genuine token', sign(goodClaims));
  await rejects('an unsigned token', unsigned(goodClaims));
  await rejects('a token signed by another key', sign(goodClaims, { key: attacker.privateKey }));
  await rejects('a token for another Firebase project', sign(goodClaims, { audience: 'other-project' }));
  await rejects('a token from another issuer', sign(goodClaims, { issuer: 'https://evil.example' }));
  await rejects('an expired token', sign(goodClaims, { expiresIn: -60 }));
  await rejects('an unknown key id', sign(goodClaims, { kid: 'nope' }));
  await rejects('an unverified email', sign({ ...goodClaims, email_verified: false }));
  await rejects('a token without an email', sign({ sub: 'x', email_verified: true }));
  await rejects('garbage', 'not-a-token');

  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Firebase ID token checks passed');
}

void main();
