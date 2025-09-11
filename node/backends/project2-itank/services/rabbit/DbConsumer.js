const amqp = require("amqplib");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "itank_fanout";
const queueName = process.env.AMQP_QUEUE || "node_itank_db_queue";

const BATCH_SIZE = 50;
const BATCH_INTERVAL = 2000;

let buffer = [];
let amqpChannel = null;
const RETRY_INTERVAL = 3000; // 3 seconds

// ----------------------
// RabbitMQ Connection
// ----------------------
async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect(amqpUrl);
    const channel = await conn.createChannel();
    await channel.assertExchange(exchange, "fanout", { durable: true });
    const { queue } = await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queue, exchange);

    amqpChannel = channel;

    console.log(`💾 Database Consumer listening on queue [${queueName}]`);

    // Start consuming messages
    channel.consume(queue, handleMessage);

  } catch (err) {
    console.error("❌ RabbitMQ connection failed, retrying in 3s...", err.message);
    setTimeout(connectRabbitMQ, RETRY_INTERVAL);
  }
}

// ----------------------
// Handle incoming messages
// ----------------------
async function handleMessage(msg) {
  if (!msg) return;

  let payload;
  try {
    payload = JSON.parse(msg.content.toString()); // { topic, raw }
  } catch (err) {
    console.error("❌ Invalid JSON received, message skipped:", err.message);
    amqpChannel.ack(msg);
    return;
  }

  buffer.push({ ...payload, _rawMsg: msg });

  if (buffer.length >= BATCH_SIZE) {
    flushBatch();
  }
}

// ----------------------
// Ensure IMEI Table exists
// ----------------------
async function ensureImeiTable(imei) {
  const tableName = `${imei}`;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return tableName;
}

// ----------------------
// Flush buffer to DB
// ----------------------
async function flushBatch() {
  if (buffer.length === 0 || !amqpChannel) return;

  const batch = buffer;
  buffer = [];

  try {
    for (const item of batch) {
      const { topic, raw, _rawMsg } = item;
      const parts = topic.split("/"); // topic = tank/<imei>
      const imei = parts[1];

      if (!imei) {
        console.log("⚠️ Skipping message without IMEI topic:", topic,raw);
        amqpChannel.ack(_rawMsg);
        continue;
      }

      const tableName = await ensureImeiTable(imei);

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${tableName}\` (data) VALUES (?)`,
        raw
      );

      amqpChannel.ack(_rawMsg);
    }

    console.log(`✅ Inserted batch of ${batch.length} records`);
  } catch (err) {
    console.error("❌ DB insert failed, requeueing batch:", err.message);
    batch.forEach((b) => amqpChannel.nack(b._rawMsg, false, true));
  }
}

// ----------------------
// Periodic flush
// ----------------------
setInterval(flushBatch, BATCH_INTERVAL);

// ----------------------
// Start consumer
// ----------------------
connectRabbitMQ().catch((err) => console.error("Consumer startup failed:", err));
