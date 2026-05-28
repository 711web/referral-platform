module.exports = {
  apps: [
    {
      name: 'partner-app',
      cwd: '/srv/referral-platform',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
      env_file: '/srv/referral-platform/.env',
    },
  ],
};
