'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/server';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import {
  createLinkForWorkspace,
  updateLinkInWorkspace,
  deleteLinkInWorkspace,
} from '@/lib/links/queries';

export type CreateLinkState = { error?: string };
export type UpdateLinkState = { error?: string };

async function workspaceForCurrentUser(userId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);
  return ws ?? null;
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect('/login');
}

export async function createLinkAction(
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const session = await getSession();
  if (!session) redirect('/login');

  const slug = String(formData.get('slug') ?? '').trim();
  const destinationUrl = String(formData.get('destinationUrl') ?? '').trim();
  if (!slug || !destinationUrl) return { error: 'Slug and destination are required.' };
  if (!/^[a-z0-9-]{2,40}$/i.test(slug)) {
    return { error: 'Slug must be 2–40 chars: letters, numbers, hyphens.' };
  }
  try {
    new URL(destinationUrl);
  } catch {
    return { error: 'Destination must be a valid absolute URL.' };
  }

  const ws = await workspaceForCurrentUser(session.user.id);
  if (!ws) return { error: 'Workspace missing.' };

  try {
    await createLinkForWorkspace(ws.id, { slug, destinationUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not create link.';
    if (msg.includes('unique') || msg.includes('duplicate')) return { error: 'That slug is already taken.' };
    return { error: msg };
  }

  revalidatePath('/app');
  redirect('/app');
}

export async function updateLinkAction(
  _prev: UpdateLinkState,
  formData: FormData,
): Promise<UpdateLinkState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const destinationUrl = String(formData.get('destinationUrl') ?? '').trim();
  if (!id || !destinationUrl) return { error: 'Missing fields.' };
  try {
    new URL(destinationUrl);
  } catch {
    return { error: 'Destination must be a valid URL.' };
  }

  const ws = await workspaceForCurrentUser(session.user.id);
  if (!ws) return { error: 'Workspace missing.' };

  const row = await updateLinkInWorkspace(id, ws.id, { destinationUrl });
  if (!row) return { error: 'Not found.' };
  revalidatePath('/app');
  redirect('/app');
}

export async function deleteLinkAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/app');

  const ws = await workspaceForCurrentUser(session.user.id);
  if (!ws) redirect('/app');

  await deleteLinkInWorkspace(id, ws.id);
  revalidatePath('/app');
  redirect('/app');
}
