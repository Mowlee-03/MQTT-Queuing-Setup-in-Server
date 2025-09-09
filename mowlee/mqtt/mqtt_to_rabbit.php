<?php
// require("phpMQTT.php");

// // MQTT setup
// $server = "192.168.56.10";
// $port = 1883;
// $username = "mowlee";
// $password = "mowlee12345";
// $client_id = "php-mqtt-to-rabbit";

// $mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

// // RabbitMQ setup (using php-amqp extension)
// $rabbitConn = new AMQPConnection([
//     'host' => '192.168.56.10',
//     'port' => 5672,
//     'login' => 'mowlee',
//     'password' => 'mowlee12345',
//     'vhost' => '/'
// ]);
// $rabbitConn->connect();
// $channel = new AMQPChannel($rabbitConn);

// $queue = new AMQPQueue($channel);
// $queue->setName('iot_queue');
// $queue->declareQueue();

// if(!$mqtt->connect(true, NULL, $username, $password)) {
//     exit("Failed to connect to MQTT\n");
// }

// $topics['iot/data'] = ["qos"=>0, "function"=>"processMessage"];
// $mqtt->subscribe($topics, 0);

// echo " [*] Waiting for MQTT messages...\n";

// // Callback for MQTT
// function processMessage($topic, $msg){
//     global $channel;

//     echo "Received from MQTT [$topic]: $msg\n";

//     $exchange = new AMQPExchange($channel);
//     $exchange->setName('');
//     $exchange->publish($msg, 'iot_queue');

//     echo "Forwarded to RabbitMQ queue\n";
// }

// while($mqtt->proc()) {}

// $mqtt->close();
// $rabbitConn->disconnect();

// 1 . TOPIC  #####

// require("phpMQTT.php");

// // MQTT setup
// $server   = "192.168.56.10";
// $port     = 1883;
// $username = "mowlee";
// $password = "mowlee12345";
// $client_id = "php-mqtt-to-rabbit";

// $mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

// // RabbitMQ setup (php-amqp extension)
// $rabbitConn = new AMQPConnection([
//     'host'     => '192.168.56.10',
//     'port'     => 5672,
//     'login'    => 'mowlee',
//     'password' => 'mowlee12345',
//     'vhost'    => '/'
// ]);
// $rabbitConn->connect();
// $channel = new AMQPChannel($rabbitConn);

// // Declare topic exchange
// $exchange = new AMQPExchange($channel);
// $exchange->setName('iot_topic_exchange');
// $exchange->setType(AMQP_EX_TYPE_TOPIC);
// $exchange->declareExchange();

// if(!$mqtt->connect(true, NULL, $username, $password)) {
//     exit("Failed to connect to MQTT broker\n");
// }

// // Subscribe to all IoT topics
// $topics['iot/#'] = ["qos"=>0, "function"=>"processMessage"];
// $mqtt->subscribe($topics, 0);

// echo " [*] Waiting for MQTT messages...\n";

// // Callback for MQTT messages
// function processMessage($topic, $msg){
//     global $exchange;

//     // Convert MQTT topic to RabbitMQ routing key (replace '/' with '.')
//     $routingKey = str_replace('/', '.', $topic);

//     echo "Received MQTT [$topic]: $msg\n";

//     // Publish to RabbitMQ exchange with topic routing
//     $exchange->publish($msg, $routingKey);

//     echo "Forwarded to RabbitMQ [exchange=iot_topic_exchange, key=$routingKey]\n";
// }

// while($mqtt->proc()) {}

// $mqtt->close();
// $rabbitConn->disconnect();

// 2 .Fanout ###################

require("phpMQTT.php");

$server   = "localhost";  // MQTT Broker
$port     = 1883;
$username = "mowlee";
$password = "mowlee12345";
$client_id = "php-mqtt-to-rabbit";

$mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

if(!$mqtt->connect(true, NULL, $username, $password)) {
    exit(1);
}

// ---- RabbitMQ setup ----
$conn = new AMQPConnection([
    'host' => 'localhost',
    'port' => 5672,
    'login' => 'guest',
    'password' => 'guest',
    'vhost' => '/'
]);
$conn->connect();

$channel = new AMQPChannel($conn);

// Fanout exchange (broadcast)
$exchange = new AMQPExchange($channel);
$exchange->setName('iot_fanout_exchange');
$exchange->setType(AMQP_EX_TYPE_FANOUT);
$exchange->setFlags(AMQP_DURABLE); 
$exchange->declareExchange();

// Process incoming MQTT messages
function processMessage($topic, $msg){
    global $exchange;

    echo "MQTT [$topic]: $msg\n";

    // Send to RabbitMQ fanout exchange
    $exchange->publish($msg, '', AMQP_MANDATORY, [
        'delivery_mode' => 2 // 👈 persistent message
    ]);

    echo "→ Forwarded to RabbitMQ fanout exchange\n";
}

// Subscribe to topic
$mqtt->subscribe(["iot/test" => ["qos" => 0, "function" => "processMessage"]]);

while($mqtt->proc()){}

$mqtt->close();
$conn->disconnect();

?>