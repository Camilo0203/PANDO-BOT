module.exports = {
  apps: [{
    name: 'ton618-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '900M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 25000,
    wait_ready: true,
    listen_timeout: 15000
  }, {
    name: 'ton618-lavalink',
    script: 'scripts/lavalink-wrapper.js',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1200M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/lavalink-err.log',
    out_file: './logs/lavalink-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 15000
  }]
};
