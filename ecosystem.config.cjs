/**
 * PM2 process list for the droplet. `deploy/deploy.sh` starts or reloads
 * both apps from here; Nginx sits in front of them (see
 * deploy/nginx-cashbook.conf).
 *
 * The droplet hosts other projects too, so the web port is not hard-coded:
 * deploy.sh passes WEB_PORT (default 3000). The API port is PORT in
 * backend/.env. Secrets stay in backend/.env; the web app's API address is
 * baked in at build time from frontend/.env.production.local.
 */
const WEB_PORT = process.env.WEB_PORT || '3000';

module.exports = {
  apps: [
    {
      name: 'cashbook-api',
      cwd: './backend',
      script: 'src/server.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
    {
      name: 'cashbook-web',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${WEB_PORT}`,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
    },
  ],
};
