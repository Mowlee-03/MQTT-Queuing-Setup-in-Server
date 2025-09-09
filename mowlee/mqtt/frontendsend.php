<?php
$conn = new AMQPConnection([
    'host' => 'localhost',
    'port' => 5672,
    'login' => 'guest',
    'password' => 'guest',
    'vhost' => '/'
]);
$conn->connect();

$channel = new AMQPChannel($conn);

$queue = new AMQPQueue($channel);
$queue->setName('real_queue');
// $queue->setFlags(AMQP_DURABLE);  
$queue->declareQueue();
$queue->bind('iot_fanout_exchange'); // bind to fanout

echo "Frontend Worker started...\n";

while (true) {
    $queue->consume(function($envelope, $queue) {
    $msg = $envelope->getBody();
    echo "Frontend Worker got: $msg\n";

    // Send to Node.js WebSocket server
    $ch = curl_init("http://localhost:3001/message");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["msg" => $msg]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_exec($ch);
    curl_close($ch);

    $queue->ack($envelope->getDeliveryTag());
});

}
?>