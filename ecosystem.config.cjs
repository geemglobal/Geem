module.exports = {
  apps: [
    {
      name: 'geem-api',
      script: 'node',
      args: '--enable-source-maps --env-file=/var/www/geempk/Inventory-Commerce-Hub/.env artifacts/api-server/dist/index.mjs',
      cwd: '/var/www/geempk/Inventory-Commerce-Hub',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/geem-api-error.log',
      out_file: '/var/log/pm2/geem-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'geem-webhook',
      script: 'node',
      args: '--env-file=/var/www/geempk/Inventory-Commerce-Hub/.env scripts/webhook.cjs',
      cwd: '/var/www/geempk/Inventory-Commerce-Hub',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: '/var/log/pm2/geem-webhook-error.log',
      out_file: '/var/log/pm2/geem-webhook-out.log',
    }
  ]
}
