'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser, setBrandCredentials } from '@/lib/workspaces/queries';
import { generateBrandKey, generateBrandSecret } from '@/lib/conversions/hmac';

export async function generateBrandCredentialsAction() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const brandKey = generateBrandKey();
  const brandSecret = generateBrandSecret();
  await setBrandCredentials(ws.id, brandKey, brandSecret);
  revalidatePath('/app/settings');
  redirect(`/app/settings?revealed=1`);
}
