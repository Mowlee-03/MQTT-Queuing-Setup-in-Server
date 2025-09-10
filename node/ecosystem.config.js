
// sudo mkdir -p /var/log/pm2-apps/express /var/log/pm2-apps/bridges
// sudo chown -R vagrant:vagrant /var/log/pm2-apps
module.exports = {
  apps: [
    {
      name: "express-project1",
      script: "npm",
      args: "start",
      cwd: "/home/vagrant/node/backends/project1", // Express project path
      watch: false,
      autorestart: true,
      restart_delay: 2000,

      output: "/var/log/pm2-apps/express/project1-out.log",
      error: "/var/log/pm2-apps/express/project1-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "bridge-mqtt-to-rabbit-1",
      script: "p1-bridge-fanout.js",
      cwd: "/home/vagrant/node/bridges/mqtt_to_rabbit",
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      output: "/var/log/pm2-apps/bridges/bridge1-out.log",
      error: "/var/log/pm2-apps/bridges/bridge1-error.log"
    },

  ]
};


