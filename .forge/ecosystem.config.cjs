/**
 * PM2 Ecosystem Configuration for Forge Flow 6.4
 * Production-ready process management
 */

module.exports = {
  apps: [
    {
      name: 'forge-health-server',
      script: './health-server.cjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      error_file: './logs/health-server-error.log',
      out_file: './logs/health-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    },
    {
      name: 'forge-dlq-processor',
      script: './dlq-processor.cjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      cron_restart: '0 */6 * * *', // Restart every 6 hours
      env: {
        NODE_ENV: 'production',
        DLQ_BATCH_SIZE: 10,
        DLQ_INTERVAL: 60000
      },
      error_file: './logs/dlq-processor-error.log',
      out_file: './logs/dlq-processor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'forge-health-checks',
      script: './health-checker.cjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        CHECK_INTERVAL: 30000
      },
      error_file: './logs/health-checker-error.log',
      out_file: './logs/health-checker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
