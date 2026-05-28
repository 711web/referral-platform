'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser, setBrandCredentials } from '@/lib/workspaces/queries';
import { generateBrandKey, generateBrandSecret } from '@/lib/conversions/hmac';
import { setWorkspaceTags } from '@/lib/workspaces/queries';

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

export async function updateTagsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const tags = String(formData.get('tags') ?? '');
  await setWorkspaceTags(ws.id, tags);
  revalidatePath('/app/settings');
  revalidatePath('/app/marketplace');
  redirect('/app/settings');
}
