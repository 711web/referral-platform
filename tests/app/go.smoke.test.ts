import { test, expect, request } from '@playwright/test';

test('GET /go/demo redirects 302 to destination with utm + cookie', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  const res = await api.get('/go/demo', { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const location = res.headers()['location'];
  expect(location).toMatch(/^https:\/\/example\.com\/page\?/);
  expect(location).toContain('utm_source=partner.711web.com');
  expect(location).toContain('utm_campaign=demo');
  const setCookie = res.headers()['set-cookie'] ?? '';
  expect(setCookie).toMatch(/_clid=/);
});

test('GET /go/no-such-slug returns 404', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL });
  const res = await api.get('/go/no-such-slug', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
