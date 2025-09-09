// publisher.js
const mqtt = require("mqtt");

const mqttUrl = "mqtt://192.168.56.10:1883";
const mqttOptions = { username: "mowlee", password: "mowlee12345" };
const topic = "iot/device";

const client = mqtt.connect(mqttUrl, mqttOptions);

client.on("connect", () => {
  console.log("🚀 Publisher connected to MQTT broker");

  setInterval(() => {
    const now = new Date();

    const message = {
      value:"Hello from Node.JS!!"+ Math.floor(Math.random() * 100), // random number
      datetime: now.toISOString(), // UTC ISO string
      localtime: now.toLocaleString(), // local time
    };

    const payload = JSON.stringify(message);

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (!err) {
        console.log(`📤 Published → ${topic}: ${payload}`);
      }
    });
  }, 1000); // every 2 seconds
});
