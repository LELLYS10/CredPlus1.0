module.exports = {
  apps: [{
    name: 'credplus',
    interpreter: 'none',
    script: 'npx',
    args: '-y serve dist -l 3000 -s',
    cwd: '/root/CredPlus1.0',
    autorestart: true,
    max_restarts: 10,
    min_uptime: 5000
  }]
};
