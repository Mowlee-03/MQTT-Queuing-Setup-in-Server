<?php
require("phpMQTT.php");

$server = "localhost";
$port = 1883;
$username = "mowlee";
$password = "mowlee12345";
$client_id = "php-subscriber";

$mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

if(!$mqtt->connect(true, NULL, $username, $password)) {
    exit(1);
}

$topics['iot/test'] = array("qos"=>0, "function"=>"displayMessage");
$mqtt->subscribe($topics, 0);

while($mqtt->proc()) {}

$mqtt->close();

function displayMessage($topic, $msg){
    echo "Received message on topic {$topic}: $msg\n";
}
?>