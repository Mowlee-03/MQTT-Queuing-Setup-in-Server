<!DOCTYPE html>
<html>
<head>
  <title>Live RabbitMQ Notifications</title>
</head>
<body>
  <h2>Messages</h2>
  <div id="messages"></div>

  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    const socket = io("http://192.168.56.10:3001"); // use Vagrant IP

    socket.on("notification", (data) => {
      const div = document.createElement("div");
      div.innerText = data;
      document.getElementById("messages").appendChild(div);
    });
  </script>
</body>
</html>
