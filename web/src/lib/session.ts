import { cookies } from 'next/headers';
import { getStore } from '@/data/store';

/** Current signed-in user id from the session cookie (server components). */
export async function currentUserId(): Promise<string | null> {
  const token = cookies().get('uncode_session')?.value;
  if (!token) {
    return null;
  }
  return getStore().userForToken(token);
}
