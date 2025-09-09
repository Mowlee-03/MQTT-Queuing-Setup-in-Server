<?php
// // RabbitMQ setup
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

// echo " [*] Waiting for messages...\n";

// while (true) {
//     $queue->consume(function ($envelope, $queue) {
//         $msg = $envelope->getBody();
//         echo " [x] Processing IoT Data: $msg\n";
//         $queue->ack($envelope->getDeliveryTag());
//     });
// }



// 1 .TOPIC #####


// // RabbitMQ setup
// $rabbitConn = new AMQPConnection([
//     'host'     => '192.168.56.10',
//     'port'     => 5672,
//     'login'    => 'mowlee',
//     'password' => 'mowlee12345',
//     'vhost'    => '/'
// ]);
// $rabbitConn->connect();
// $channel = new AMQPChannel($rabbitConn);

// // Declare topic exchange (must be the same as in bridge)
// $exchange = new AMQPExchange($channel);
// $exchange->setName('iot_topic_exchange');
// $exchange->setType(AMQP_EX_TYPE_TOPIC);
// $exchange->declareExchange();

// // Create a queue (auto-generated or static)
// $queue = new AMQPQueue($channel);
// $queue->setName('iot_worker_queue');  // static queue name
// $queue->declareQueue();

// // Bind queue to topic exchange with a pattern
// $bindingKey = "iot.#";  // Change this to filter
// $queue->bind('iot_topic_exchange', $bindingKey);

// echo " [*] Waiting for messages with binding [$bindingKey]...\n";

// // Consume messages
// while (true) {
//     $queue->consume(function ($envelope, $queue) {
//         $msg = $envelope->getBody();
//         echo " [x] Received (routing key = {$envelope->getRoutingKey()}): $msg\n";
//         $queue->ack($envelope->getDeliveryTag());
//     });
// }

// 2 . Fanout #################

// $conn = new AMQPConnection([
//     'host' => 'localhost',
//     'port' => 5672,
//     'login' => 'guest',
//     'password' => 'guest',
//     'vhost' => '/'
// ]);
// $conn->connect();

// $channel = new AMQPChannel($conn);

// $queue = new AMQPQueue($channel);
// $queue->setName('db_queue');
// $queue->setFlags(AMQP_DURABLE);  
// $queue->declareQueue();
// $queue->bind('iot_fanout_exchange'); // bind to fanout

// echo "DB Worker started...\n";

// while (true) {
//     $queue->consume(function($envelope, $queue) {
//         $msg = $envelope->getBody();
//         echo "DB Worker got: $msg\n";

//         // Example: save to DB (pseudo-code)
//         // mysqli_query($db, "INSERT INTO logs (message) VALUES ('$msg')");
        
//         $queue->ack($envelope->getDeliveryTag());
//     });
// }

$conn = new AMQPConnection([
    'host' => 'localhost',
    'port' => 5672,
    'login' => 'guest',
    'password' => 'guest',
    'vhost' => '/'
]);
$conn->connect();

$channel = new AMQPChannel($conn);

// Set prefetch so RabbitMQ delivers only 10 unacked message at a time
$channel->qos(0,10);
$queue = new AMQPQueue($channel);
$queue->setName('db_queue');
$queue->setFlags(AMQP_DURABLE);  
$queue->declareQueue();
$queue->bind('iot_fanout_exchange'); // bind to fanout

echo "DB Worker started...\n";

// DB connection
$mysqli = new mysqli("192.168.31.20", "myadmin", "Mowlee@12345", "mqtt");
if ($mysqli->connect_errno) {
    die("Failed to connect to MySQL: " . $mysqli->connect_error);
}


$batch = [];
$batchSize = 10;

function processBatch(&$batch, $queue, $mysqli) {
    if (empty($batch)) return;

    $values = [];
    foreach ($batch as $b) {
        $values[] = "('" . $mysqli->real_escape_string($b['msg']) . "')";
    }
    $sql = "INSERT INTO rtsdata (data) VALUES " . implode(",", $values);
    
    if ($mysqli->query($sql)) {
        echo "Inserted batch of " . count($batch) . " messages.\n";
        foreach ($batch as $b) {
            $queue->ack($b['envelope']->getDeliveryTag());
        }

        // ✅ pause 2 seconds before next batch
        sleep(2);
    } else {
        echo "DB Error: " . $mysqli->error . "\n";
        foreach ($batch as $b) {
            $queue->nack($b['envelope']->getDeliveryTag(), AMQP_REQUEUE);
        }
    }

    $batch = [];
}

// handle shutdown to requeue partial batch
register_shutdown_function(function() use (&$batch, $queue, $mysqli) {
    echo "Worker shutting down, requeueing remaining messages...\n";
    foreach ($batch as $b) {
        $queue->nack($b['envelope']->getDeliveryTag(), AMQP_REQUEUE);
    }
});

while (true) {
    $queue->consume(function($envelope, $queue) use (&$batch, $batchSize, $mysqli) {
        $msg = $envelope->getBody();
        echo "DB Worker got: $msg\n";

        $batch[] = ['msg' => $msg, 'envelope' => $envelope];

        if (count($batch) >= $batchSize) {
            processBatch($batch, $queue, $mysqli);
        }
    });
}

?>