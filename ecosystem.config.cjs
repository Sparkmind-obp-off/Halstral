module.exports = {
  apps: [{
    name: 'halstral',
    script: 'npx',
    args: 'wrangler pages dev dist --d1=halstral-production --local --ip 0.0.0.0 --port 3000',
    env: { NODE_ENV: 'development', OWNER_ID: 'owner_halstral' },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
}
