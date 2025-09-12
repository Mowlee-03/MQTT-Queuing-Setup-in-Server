const amqp = require("amqplib");
const { PrismaClient: ImeiClient } = require("../../generated/imei");
const { PrismaClient: AppClient } = require("../../generated/app");

const ImeiDB = new ImeiClient();
const AppDB = new AppClient();

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "itank_fanout";
const queueName = process.env.AMQP_QUEUE || "node_itank_db_queue";

const BATCH_SIZE = 50;
const BATCH_INTERVAL = 2000;
const RETRY_INTERVAL = 3000;

let buffer = [];
let amqpChannel = null;

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
    payload = JSON.parse(msg.content.toString());
  } catch (err) {
    console.error("❌ Invalid JSON, message skipped:", err.message);
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

  await ImeiDB.$executeRawUnsafe(`
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

  for (const item of batch) {
    const { topic, raw, _rawMsg } = item;
    const parts = topic.split("/"); 
    const imei = parts[1];

    if (!imei) {
      console.warn("⚠️ Skipping message without IMEI topic:", topic, raw);
      amqpChannel.ack(_rawMsg);
      continue;
    }

    try {
      const tableName = await ensureImeiTable(imei);



      await ImeiDB.$executeRawUnsafe(
        `INSERT INTO \`${tableName}\` (data) VALUES (?)`,
        raw
      );

      await AppDB.itankLatestLog.upsert({
        where: { imei },
        update: { data: raw, updated_at: new Date() },
        create: { imei, data: raw },
      });

      amqpChannel.ack(_rawMsg);
    } catch (err) {
      console.error(`❌ DB insert failed for IMEI ${imei}, requeueing:`, err.message);
      amqpChannel.nack(_rawMsg, false, true);
    }
  }

  console.log(`✅ Flushed batch of ${batch.length} messages`);
}

// ----------------------
// Periodic flush
// ----------------------
setInterval(flushBatch, BATCH_INTERVAL);

// ----------------------
// Start consumer
// ----------------------
connectRabbitMQ().catch(err => console.error("Consumer startup failed:", err));
