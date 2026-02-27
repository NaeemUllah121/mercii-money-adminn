module.exports = {
  apps: [
    {
      name: 'mercii-backend',
      script: './src/bin/www',
      cwd: './Mercii-Backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000
    },
    {
      name: 'mercii-frontend',
      script: 'npm',
      args: 'start',
      cwd: './mercii-admin',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000
    },
    {
      name: 'mercii-ngrok',
      script: 'ngrok',
      args: 'http 3001 --log=stdout',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: './logs/ngrok-error.log',
      out_file: './logs/ngrok-out.log',
      log_file: './logs/ngrok-combined.log',
      time: true,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 5000
    }
  ]
};
