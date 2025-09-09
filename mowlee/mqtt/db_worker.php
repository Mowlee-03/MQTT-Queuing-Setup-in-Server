<?php
// robust_consumer.php

$amqpHost     = 'localhost';
$amqpPort     = 5672;
$amqpUser     = 'mowlee';
$amqpPass     = 'mowlee12345';
$amqpVhost    = '/';
$exchangeName = 'iot_fanout_exchange';
$queueName    = 'db_queue';

// RabbitMQ connection
$connection = new AMQPConnection([
    'host'     => $amqpHost,
    'port'     => $amqpPort,
    'login'    => $amqpUser,
    'password' => $amqpPass,
    'vhost'    => $amqpVhost,
]);

try {
    $connection->connect();
    echo "✅ RabbitMQ connected\n";
} catch (AMQPConnectionException $e) {
    die("❌ RabbitMQ connection failed: " . $e->getMessage() . "\n");
}

$channel = new AMQPChannel($connection);
$channel->qos(0, 50, false); // prefetch count 50

// Exchange
$exchange = new AMQPExchange($channel);
$exchange->setName($exchangeName);
$exchange->setType(AMQP_EX_TYPE_FANOUT);
$exchange->setFlags(AMQP_DURABLE);
$exchange->declareExchange();

// Queue
$queue = new AMQPQueue($channel);
$queue->setName($queueName);
$queue->setFlags(AMQP_DURABLE);
$queue->declareQueue();
$queue->bind($exchangeName);

echo "[*] Batch DB Consumer waiting (queue={$queueName})\n";

// MySQL connection
$mysqli = new mysqli("192.168.31.20", "myadmin", "Mowlee@12345", "mqtt");
if ($mysqli->connect_errno) {
    die("❌ Failed to connect to MySQL: " . $mysqli->connect_error);
}

// Batch settings
$batchSize     = 10;
$flushInterval = 30; // seconds
$batch         = [];
$lastFlush     = time();

// Safe batch insert
function insertBatch(&$batch, $mysqli, $queue)
{
    if (empty($batch)) return;

    $values = [];
    foreach ($batch as $item) {
        $msg = $mysqli->real_escape_string($item['body']);
        $values[] = "('$msg')";
    }

    $sql = "INSERT INTO rtsdata (data) VALUES " . implode(",", $values);

    if ($mysqli->query($sql)) {
        echo "✅ Batch insert successful (" . count($batch) . " messages)\n";
        foreach ($batch as $item) {
            try {
                $queue->ack($item['deliveryTag']);
            } catch (Exception $e) {
                echo "❌ Ack failed: " . $e->getMessage() . "\n";
            }
        }
    } else {
        echo "❌ Batch insert failed: " . $mysqli->error . "\n";
        foreach ($batch as $item) {
            try {
                $queue->nack($item['deliveryTag'], AMQP_REQUEUE);
            } catch (Exception $e) {
                echo "❌ Nack failed: " . $e->getMessage() . "\n";
            }
        }
    }

    $batch = [];
}

// Flush on shutdown
register_shutdown_function(function () use (&$batch, $mysqli, $queue) {
    echo "⚡ Flushing remaining messages before exit...\n";
    insertBatch($batch, $mysqli, $queue);
});

// Consume loop
while (true) {
    $queue->consume(function (AMQPEnvelope $envelope, AMQPQueue $queue) use (&$batch, $batchSize, $mysqli, &$lastFlush, $flushInterval) {
        try {
            $body = $envelope->getBody();
            echo "📩 Received: $body\n";

            $batch[] = [
                'body'        => $body,
                'deliveryTag' => $envelope->getDeliveryTag(),
            ];

            $now = time();
            // Insert if batch full or flush interval reached
            if (count($batch) >= $GLOBALS['batchSize'] || ($now - $lastFlush) >= $flushInterval) {
                insertBatch($batch, $mysqli, $queue);
                $lastFlush = $now;
            }
        } catch (Exception $e) {
            echo "❌ Consumer error: " . $e->getMessage() . "\n";
            $queue->nack($envelope->getDeliveryTag(), AMQP_REQUEUE);
        }
    }, AMQP_NOPARAM);

    // Ensure periodic flush if no new messages arrive
    $now = time();
    if (!empty($batch) && ($now - $lastFlush) >= $flushInterval) {
        insertBatch($batch, $mysqli, $queue);
        $lastFlush = $now;
    }
}