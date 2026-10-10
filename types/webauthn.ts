import { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export interface WebAuthnCredential {
  id: string; // Base64URL
  publicKey: Uint8Array;
  userId: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  createdAt: string;
  lastUsedAt: string;
}

export interface WebAuthnChallenge {
  challenge: string;
  userId?: string;
  expiresAt: Date;
  type: 'registration' | 'authentication';
}
