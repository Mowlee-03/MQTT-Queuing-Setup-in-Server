# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "ubuntu/jammy64"
  config.vm.hostname = "mowlee-sample"

  # Public network with static IP
  config.vm.network "private_network", ip: "192.168.56.10"

  # Optional forwarded port example (can remove if unused)
  # config.vm.network "forwarded_port", guest: 3306, host: 3307
  # ✅ Synced folder (host -> guest)

  # PHP/Apache app

  config.vm.synced_folder "mowlee", "/var/www/html", owner: "vagrant", group: "vagrant"

  # Node.js app folder
  config.vm.synced_folder "node", "/home/vagrant/node", owner: "vagrant", group: "vagrant"
  # ✅ Set CPU and RAM
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"       # 2 GB RAM
    vb.cpus = 2              # 2 CPU cores
  end

  config.vm.provision "shell", inline: <<-SHELL
    set -e

    echo "🔄 Updating package list..."
    apt-get update

    echo "📦 Installing Apache, PHP, PHP extensions, Git, and Mosquitto..."
    apt-get install -y apache2 php libapache2-mod-php php-mysql php-mbstring git \
                       mosquitto mosquitto-clients

    echo "📦 Installing PHP AMQP extension..."
    apt-get install -y php-amqp

    echo "📦 Installing Node.js (LTS) and npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs build-essential

    echo "📦 Installing PM2 globally..."
    npm install -g pm2

    echo "⚙️ Configuring PM2 to auto-start on reboot..."
    pm2 startup systemd -u vagrant --hp /home/vagrant
    pm2 save

    echo "📂 Setting permissions for /var/www/html..."
    chown -R vagrant:vagrant /var/www/html
    chmod -R 755 /var/www/html

    echo "⚙️ Configuring Mosquitto with authentication..."
    # Backup default config
    cp /etc/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf.bak
    # Overwrite with secure config
    cat <<EOF > /etc/mosquitto/mosquitto.conf
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd
EOF

    echo "👤 Creating Mosquitto user..."
    mosquitto_passwd -b -c /etc/mosquitto/passwd mowlee mowlee12345

    echo "♻️ Restarting Apache..."
    systemctl restart apache2

    echo "♻️ Enabling and restarting Mosquitto..."
    systemctl enable mosquitto
    systemctl restart mosquitto

    #####################################################################
    # 🐰 RabbitMQ + Erlang (official Team RabbitMQ APT repos for Jammy) #
    #####################################################################

    echo "🔐 Installing prerequisites for RabbitMQ/Erlang repos..."
    apt-get install -y curl gnupg apt-transport-https

    echo "🔑 Adding Team RabbitMQ signing key..."
    curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" \
      | gpg --dearmor | tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null

    echo "📄 Writing /etc/apt/sources.list.d/rabbitmq.list for Ubuntu Jammy..."
    cat <<'EOF' > /etc/apt/sources.list.d/rabbitmq.list
## Modern Erlang/OTP releases (Jammy)
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb1.rabbitmq.com/rabbitmq-erlang/ubuntu/jammy jammy main
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb2.rabbitmq.com/rabbitmq-erlang/ubuntu/jammy jammy main
## Latest RabbitMQ releases (Jammy)
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb1.rabbitmq.com/rabbitmq-server/ubuntu/jammy jammy main
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb2.rabbitmq.com/rabbitmq-server/ubuntu/jammy jammy main
EOF

    echo "🔄 apt-get update for new RabbitMQ/Erlang repos..."
    apt-get update -y

    echo "📦 Installing modern Erlang required by RabbitMQ..."
    apt-get install -y erlang-base \
        erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
        erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
        erlang-runtime-tools erlang-snmp erlang-ssl \
        erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl

    echo "📦 Installing rabbitmq-server (4.x series)..."
    # (Optionally pin a specific version via: apt-get install rabbitmq-server=4.1.4-*)
    apt-get install -y rabbitmq-server --fix-missing

    echo "🔌 Enabling management plugin (web UI on :15672)..."
    rabbitmq-plugins enable --quiet rabbitmq_management

    echo "👤 Creating RabbitMQ admin user 'mowlee'..."
    rabbitmqctl add_user mowlee mowlee12345 || true
    rabbitmqctl set_user_tags mowlee administrator
    rabbitmqctl set_permissions -p / mowlee ".*" ".*" ".*"

    echo "🔒 Ensuring default 'guest' remains local-only (default behaviour)..."
    # No action needed; 'guest' can only log in via localhost by default.

    echo "♻️ Enabling and restarting rabbitmq-server..."
    systemctl enable rabbitmq-server
    systemctl restart rabbitmq-server

    echo "🧪 Verifying RabbitMQ service status..."
    systemctl --no-pager status rabbitmq-server | sed -n '1,15p' || true

    echo "✅ Provisioning complete! Apache, PHP, Mosquitto, and RabbitMQ installed."
    echo "👉 RabbitMQ admin: user=mowlee | pass=mowlee12345"
    echo "👉 AMQP: amqp://192.168.56.10:5672"
    echo "👉 Management UI: http://192.168.56.10:15672"
  SHELL

end

