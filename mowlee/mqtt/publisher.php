<?php
require("phpMQTT.php");

$server = "localhost";    // Mosquitto broker
$port = 1883;             // Default MQTT port
$username = "mowlee";     
$password = "mowlee12345";
$client_id = "php-publisher";

$mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

if ($mqtt->connect(true, null, $username, $password)) {
    echo "Connected to MQTT broker...\n";

    while (true) {
        // $randomNumber = rand(1, 1000); 
        // $message = "Hello from PHP! " . $randomNumber;
        $message = "Hello from PHP! " . date('Y-m-d H:i:s');
        $mqtt->publish("iot/test", $message, 0);
        echo "Published: $message\n";
        sleep(3); // wait for 3 seconds before sending next message
    }

    $mqtt->close();
} else {
    echo "Connection failed!";
}
?>
