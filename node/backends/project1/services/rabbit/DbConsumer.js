const amqp = require("amqplib");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "mqtt_fanout";
const queueName = process.env.AMQP_QUEUE || "node_db_queue";

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
    payload = JSON.parse(msg.content.toString());
  } catch (err) {
    console.error("❌ Invalid JSON received, message skipped:", err.message);
    amqpChannel.ack(msg); // skip bad message
    return;
  }

  buffer.push({ ...payload, _rawMsg: msg });

  // Flush immediately if batch full
  if (buffer.length >= BATCH_SIZE) {
    flushBatch();
  }
}

// ----------------------
// Flush buffer to DB
// ----------------------
async function flushBatch() {
  if (buffer.length === 0 || !amqpChannel) return;

  const batch = buffer;
  buffer = [];

  try {
    await prisma.nodedata.createMany({
      data: batch.map((item) => {
        const { _rawMsg, ...clean } = item;
        return { data: clean };
      }),
    });

    console.log(`✅ Inserted batch of ${batch.length} records`);
    batch.forEach((b) => amqpChannel.ack(b._rawMsg));
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

