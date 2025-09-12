
const amqp = require("amqplib");
const { PrismaClient: ImeiClient } = require("../../generated/imei");

const ImeiDB = new ImeiClient();

const amqpUrl = process.env.AMQP_URL || "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = process.env.AMQP_EXCHANGE || "itank_fanout";
const queueName = process.env.AMQP_RAW_QUEUE || "node_itank_raw_log_queue";

const RETRY_INTERVAL = 3000;

// ----------------------
// Ensure rawLogs table exists
// ----------------------
async function ensureRawLogsTable() {
  await ImeiDB.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rawLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      imei VARCHAR(64) NOT NULL,
      topic VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ----------------------
// Store raw log
// ----------------------
async function storeRawLog({ imei, topic, raw }) {
  await ensureRawLogsTable();

  await ImeiDB.$executeRawUnsafe(
    `INSERT INTO rawLogs (imei, topic, data) VALUES (?, ?, ?)`,
    imei,
    topic,
    raw
  );
}

// ----------------------
// RabbitMQ Consumer for Raw Logs
// ----------------------
async function connectRawLogsConsumer() {
  try {
    const conn = await amqp.connect(amqpUrl);
    const channel = await conn.createChannel();
    await channel.assertExchange(exchange, "fanout", { durable: true });
    const { queue } = await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queue, exchange);

    console.log(`📦 Raw Logs Consumer listening on queue [${queue}]`);

    channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        const { topic, raw } = payload;
        const imei = topic?.split("/")[1];

        if (!imei) {
          console.warn("⚠️ Skipping raw log without IMEI:", topic);
          channel.ack(msg);
          return;
        }

        await storeRawLog({ imei, topic, raw });
        channel.ack(msg);
      } catch (err) {
        console.error("❌ Raw log insert failed, requeueing:", err.message);
        channel.nack(msg, false, true);
      }
    });
  } catch (err) {
    console.error("❌ Raw Logs Consumer connection failed, retrying:", err.message);
    setTimeout(connectRawLogsConsumer, RETRY_INTERVAL);
  }
}

// ----------------------
// Cleanup old logs (> 7 days)
// ----------------------
async function cleanupOldLogs() {
  try {
    await ensureRawLogsTable(); 
    await ImeiDB.$executeRawUnsafe(`
      DELETE FROM rawLogs WHERE created_at < NOW() - INTERVAL 7 DAY
    `);
    console.log("🧹 Old raw logs cleaned up");
  } catch (err) {
    console.error("❌ Failed to cleanup rawLogs:", err.message);
  }
}

// Run cleanup every 6 hours
setInterval(cleanupOldLogs, 6 * 60 * 60 * 1000);

// ----------------------
// Start consumer
// ----------------------
connectRawLogsConsumer().catch((err) =>
  console.error("Raw logs consumer startup failed:", err)
);

// Run first cleanup on start
cleanupOldLogs();
