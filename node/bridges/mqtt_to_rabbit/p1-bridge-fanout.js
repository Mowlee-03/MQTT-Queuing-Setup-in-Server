
const mqtt = require("mqtt");
const amqp = require("amqplib")

const mqttUrl = "mqtt://192.168.56.10:1883";
const mqttOptions = { username: "mowlee", password: "mowlee12345" };

const amqpUrl = "amqp://mowlee:mowlee12345@192.168.56.10:5672";
const exchange = "mqtt_fanout";

async function startBridge() {
  // RabbitMQ setup
  const conn = await amqp.connect(amqpUrl);
  const channel = await conn.createChannel();
  await channel.assertExchange(exchange, "fanout", { durable: true });

  // MQTT setup
  const client = mqtt.connect(mqttUrl, mqttOptions);

  client.on("connect", () => {
    console.log("🔗 Bridge connected to MQTT & RabbitMQ Fanout Exchange");
    client.subscribe("iot/device"); // catch IoT device 
  });

  client.on("message", (topic, message) => {
    const payload = JSON.stringify({ topic, data: message.toString(), ts: Date.now() });
    console.log(`📥 MQTT [${topic}] → RabbitMQ Exchange [${exchange}]`);
    // console.log(payload);
    
    channel.publish(exchange, "", Buffer.from(payload)); // no routing key in fanout
  });
}

startBridge().catch(console.error);
