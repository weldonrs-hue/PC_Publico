import 'server-only';
import crypto from 'crypto';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const ENCRYPTION_KEY = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;

// Verify required environment variables
export function verifyMicrosoftConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Missing Microsoft OAuth configuration (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, or MICROSOFT_REDIRECT_URI)');
  }
  if (!ENCRYPTION_KEY) {
    throw new Error('Missing MICROSOFT_TOKEN_ENCRYPTION_KEY');
  }
  
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid MICROSOFT_TOKEN_ENCRYPTION_KEY: Expected 32 bytes for AES-256, but found ${keyBuffer.length} bytes. Check if it is a 32-character ASCII string or a valid hex/base64 encoded key of 32 bytes.`);
  }
}

/**
 * Gets the encryption key as a 32-byte Buffer
 */
function getEncryptionKeyBuffer(): Buffer {
  verifyMicrosoftConfig();
  return Buffer.from(ENCRYPTION_KEY!, 'utf8');
}

/**
 * Generates a cryptographically secure random string for PKCE and State
 */
export function generateRandomString(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64url').substring(0, length);
}

/**
 * Generates the Code Challenge for PKCE using SHA-256
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Encrypts a sensitive string (like Refresh Token) using AES-256-GCM
 */
export function encryptToken(text: string): string {
  const key = getEncryptionKeyBuffer();
  
  const iv = crypto.randomBytes(12); // GCM standard IV length
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedContent
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with AES-256-GCM
 */
export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKeyBuffer();
  
  const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
  
  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Exchanges the Authorization Code for Tokens
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  verifyMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    code: code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI!,
    grant_type: 'authorization_code',
    scope: 'openid email offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite'
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Microsoft OAuth] Token exchange failed:', errorData);
    throw new Error(`Failed to exchange code for tokens: ${errorData.error_description || errorData.error}`);
  }

  return response.json();
}

/**
 * Refreshes the Access Token using a Refresh Token
 */
export async function refreshAccessToken(refreshToken: string) {
  verifyMicrosoftConfig();

  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'openid email offline_access https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite'
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Microsoft OAuth] Token refresh failed:', errorData);
    throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
  }

  return response.json();
}

/**
 * Gets user profile from Microsoft Identity API
 */
export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft profile');
  }

  return response.json();
}
