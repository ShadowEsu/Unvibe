import { cookies } from 'next/headers';
import { getStore } from '@/data/store';

/** Current signed-in user id from the session cookie (server components). None for an account being deleted. */
export async function currentUserId(): Promise<string | null> {
  const token = cookies().get('uncode_session')?.value;
  if (!token) {
    return null;
  }
  const userId = await getStore().userForToken(token);
  if (!userId || (await getStore().accountDeletion(userId))) return null;
  return userId;
}
