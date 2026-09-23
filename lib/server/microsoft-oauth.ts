import 'server-only';
import crypto from 'crypto';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const ENCRYPTION_KEY = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;

// Verify required environment variables
export function verifyMicrosoftConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Missing Microsoft OAuth configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)');
  }
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error('Missing or invalid MICROSOFT_TOKEN_ENCRYPTION_KEY (must be at least 32 characters)');
  }
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
  if (!ENCRYPTION_KEY) throw new Error('Encryption key missing');
  
  const iv = crypto.randomBytes(12); // GCM standard IV length
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  
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
  if (!ENCRYPTION_KEY) throw new Error('Encryption key missing');
  
  const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  
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
    scope: 'openid email offline_access https://outlook.office.com/SMTP.Send'
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
