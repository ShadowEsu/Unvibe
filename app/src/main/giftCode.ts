import { createHash } from 'node:crypto';

/** Same 8-character SPECIAL CHAR the waitlist and Gift page use. */
export function specialCharForEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 8);
}
