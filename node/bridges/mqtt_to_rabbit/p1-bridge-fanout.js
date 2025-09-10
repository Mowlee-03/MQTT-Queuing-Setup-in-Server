const mqtt = require("mqtt");
const amqp = require("amqplib");

const mqttUrl = process.env.MQTT_HOST || "mqtt://192.168.56.10:1883";
const mqttOptions = {
  username: process.env.MQTT_USER || "mowlee",
  password: process.env.MQTT_PASS || "mowlee12345"
};

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "mqtt_fanout";

const RETRY_INTERVAL = 3000; // 3 seconds

let amqpChannel;

// ----------------------
// RabbitMQ Connection
// ----------------------
async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect(amqpUrl);
    const channel = await conn.createChannel();
    await channel.assertExchange(exchange, "fanout", { durable: true });
    amqpChannel = channel;
    console.log(`✅ Connected to RabbitMQ Exchange [${exchange}]`);
  } catch (err) {
    console.error("❌ RabbitMQ connection failed, retrying in 3s...", err.message);
    setTimeout(connectRabbitMQ, RETRY_INTERVAL);
  }
}

// ----------------------
// MQTT Connection
// ----------------------
function startMQTT() {
  const client = mqtt.connect(mqttUrl, mqttOptions);

  client.on("connect", () => {
    console.log("🔗 Connected to MQTT broker");
    client.subscribe("iot/device", (err) => {
      if (err) console.error("❌ MQTT subscription failed:", err.message);
      else console.log("📥 Subscribed to topic [iot/device]");
    });
  });

  client.on("message", (topic, message) => {
    if (!amqpChannel) {
      console.warn("⚠️ RabbitMQ not connected yet, message skipped");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch (e) {
      console.error("❌ Invalid JSON from MQTT:", e.message);
      return;
    }

    const payload = JSON.stringify({
      topic,
      ...parsed,
      ts: Date.now()
    });

    amqpChannel.publish(exchange, "", Buffer.from(payload), { persistent: true });
    console.log(`📤 MQTT [${topic}] → RabbitMQ Exchange [${exchange}]`);
  });

  client.on("error", (err) => {
    console.error("❌ MQTT Error:", err.message);
  });
}

// ----------------------
// Start Bridge
// ----------------------
async function startBridge() {
  await connectRabbitMQ();
  startMQTT();
}

// Start with a small delay to ensure RabbitMQ has time to boot (optional)
setTimeout(() => {
  startBridge().catch(err => console.error("Bridge failed:", err));
}, 2000);
