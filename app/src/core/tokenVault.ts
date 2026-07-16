export interface TokenCipher {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export function sealToken(token: string, cipher: TokenCipher): string {
  if (!cipher.isEncryptionAvailable()) {
    throw new Error('Secure account storage is unavailable. Unlock your Mac keychain and try again, or continue locally.');
  }
  return cipher.encryptString(token).toString('base64');
}

export function openToken(encoded: string, cipher: TokenCipher): string {
  return cipher.decryptString(Buffer.from(encoded, 'base64'));
}
