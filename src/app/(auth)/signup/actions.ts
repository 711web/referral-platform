'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { ensureWorkspaceForUser } from '@/lib/workspaces/ensure';

export type SignupState = { error?: string };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  let userId: string;
  try {
    const res = await auth.api.signUpEmail({
      body: { email, password, name: email.split('@')[0] ?? email },
      headers: await headers(),
      returnHeaders: true,
    });
    if (!res.response?.user?.id) return { error: 'Signup failed.' };
    userId = res.response.user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Signup failed.';
    return { error: msg };
  }

  await ensureWorkspaceForUser(userId, email);
  redirect('/app');
}
