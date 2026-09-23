module.exports = {
  apps: [
    {
      name: 'cashbook-api',
      cwd: './backend',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '400M'
    }
  ]
};