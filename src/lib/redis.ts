import Redis from 'ioredis';

const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL not set');

export const redis = new Redis(url, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[redis]', e.message);
});
