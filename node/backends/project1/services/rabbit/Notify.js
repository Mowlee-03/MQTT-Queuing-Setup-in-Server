const amqp = require("amqplib");
const admin = require("firebase-admin");

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "mqtt_fanout";
const notifyQueue = process.env.AMQP_NOTIFY_QUEUE || "notify_queue";

const MAX_VALUE = process.env.DEVICE_MAX || 100; // threshold
const RETRY_INTERVAL = 3000;

let amqpChannel = null;

// ----------------------
// Firebase Setup
// ----------------------
admin.initializeApp({
  credential: admin.credential.cert(require("../firebase/firebase-service-account-realtech.json")), // <-- service account json from Firebase
});

const fcm = admin.messaging();

// ----------------------
// Track device alert state
// ----------------------
const deviceState = {}; // { deviceId: { alertActive: bool, lastValue: number } }

// ----------------------
// RabbitMQ Connection
// ----------------------
async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect(amqpUrl);
    const channel = await conn.createChannel();

    await channel.assertExchange(exchange, "fanout", { durable: true });
    const { queue } = await channel.assertQueue(notifyQueue, { durable: true });
    await channel.bindQueue(queue, exchange);

    amqpChannel = channel;

    console.log(`🔔 Notification Consumer listening on queue [${notifyQueue}]`);
    channel.consume(queue, handleMessage, { noAck: false });
  } catch (err) {
    console.error("❌ RabbitMQ connection failed, retrying...", err.message);
    setTimeout(connectRabbitMQ, RETRY_INTERVAL);
  }
}

// ----------------------
// Handle incoming message
// ----------------------
async function handleMessage(msg) {
  if (!msg) return;

  let payload;
  try {
    payload = JSON.parse(msg.content.toString());
  } catch (err) {
    console.error("❌ Invalid JSON, skipping:", err.message);
    amqpChannel.ack(msg);
    return;
  }

  const { deviceId, value, ts } = payload;
  if (!deviceId || typeof value !== "number") {
    amqpChannel.ack(msg);
    return;
  }

  const state = deviceState[deviceId] || { alertActive: false, lastValue: null };

  if (value > MAX_VALUE) {
    if (!state.alertActive) {
      state.alertActive = true;
      await sendNotification(deviceId, value, ts);
    }
  } else {
    if (state.alertActive) {
      console.log(`✅ Device ${deviceId} back to normal (${value})`);
      state.alertActive = false;
    }
  }

  state.lastValue = value;
  deviceState[deviceId] = state;

  amqpChannel.ack(msg);
}

// ----------------------
// Send notification via Firebase
// ----------------------
async function sendNotification(deviceId, value, ts) {
  const message = {
    notification: {
      title: `⚠️ Device ${deviceId} Alert`,
      body: `Value ${value} exceeded threshold (${MAX_VALUE})`,
    },
    data: {
      deviceId: String(deviceId),
      value: String(value),
      timestamp: String(ts),
    },
    topic: `device_${deviceId}`, // 👈 all frontends subscribed to this topic will receive
  };

  try {
    const response = await fcm.send(message);
    console.log(`📢 Notification sent for device ${deviceId}:`, response);
  } catch (err) {
    console.error("❌ Failed to send notification:", err.message);
  }
}

// ----------------------
// Start
// ----------------------
connectRabbitMQ().catch((err) => console.error("Consumer startup failed:", err));
