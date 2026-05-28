import { test, expect } from '@playwright/test';

test('signup → create link → see in list → logout', async ({ page, baseURL }) => {
  const email = `smoke+${Date.now()}@example.com`;
  const slug = `smk-${Date.now().toString(36)}`;

  // Signup
  await page.goto(`${baseURL}/signup`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('smokepass123');
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.waitForURL('**/app');

  await expect(page.getByRole('heading', { name: 'Links' })).toBeVisible();

  // Create link
  await page.getByRole('link', { name: /new link/i }).click();
  await page.getByLabel('Slug').fill(slug);
  await page.getByLabel('Destination URL').fill('https://example.com/smoke');
  await page.getByRole('button', { name: /create/i }).click();
  await page.waitForURL('**/app');

  await expect(page.locator(`text=${slug}`)).toBeVisible();

  // Logout
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL('**/login');
});
