const amqp = require("amqplib");
const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();

const amqpUrl = "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = "mqtt_fanout";

let buffer = []; // in-memory batch storage
const BATCH_SIZE = 50; // flush after 50 msgs
const BATCH_INTERVAL = 2000; // flush every 2s if not full
let flushTimer = null;

async function startConsumer() {
  const conn = await amqp.connect(amqpUrl);
  const channel = await conn.createChannel();

  await channel.assertExchange(exchange, "fanout", { durable: true });
  const { queue } = await channel.assertQueue("node_db_queue", { durable: true });
  await channel.bindQueue(queue, exchange);

  console.log("💾 Database Consumer listening...");

  // helper: flush batch to DB
  async function flushBatch() {
    if (buffer.length === 0) return;

    const batch = buffer;
    buffer = []; // reset buffer

    try {
    await prisma.nodedata.createMany({
      data: batch.map((msg) => {
        const { _rawMsg, ...clean } = msg; // remove RabbitMQ metadata
        return {
          data: clean, // store only your IoT JSON
        };
      }),
    });

      console.log(`✅ Inserted batch of ${batch.length}`);
      // Ack all after DB success
      batch.forEach((b) => channel.ack(b._rawMsg));
    } catch (err) {
      console.error("❌ DB insert failed, requeueing batch:", err);
      // nack all → messages stay in queue
      batch.forEach((b) => channel.nack(b._rawMsg, false, true));
    }
  }

  // periodic flush
  setInterval(flushBatch, BATCH_INTERVAL);

  channel.consume(queue, (msg) => {
    const payload = JSON.parse(msg.content.toString());

    // push into buffer with raw message reference for ack/nack
    buffer.push({ ...payload, _rawMsg: msg });

    // if batch full → flush immediately
    if (buffer.length >= BATCH_SIZE) {
      flushBatch();
    }
  });
}

startConsumer().catch(console.error);
