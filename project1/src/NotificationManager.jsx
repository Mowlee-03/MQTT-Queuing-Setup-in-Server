import { useEffect, useState } from "react";
import { messaging, getToken, onMessage } from "./firebase"; // <-- your firebase.js setup

function NotificationManager({ deviceId }) {
  const [token, setToken] = useState(null);
  const [messages, setMessages] = useState([]);

  const requestPermission = async () => {
    try {
      const currentToken = await getToken(messaging, {
        vapidKey: "BJkUwyY7t6Wcm25qd1QpMX_ffCsCQRBf_f07l-iFcYTs0dOzkn0hszGvKFNqxaAcusWMf2SEDkrfhNIc21kArEQ", // <-- replace with Firebase VAPID public key
      });

      if (currentToken) {
        setToken(currentToken);

        // subscribe to device topic on backend
        await fetch("http://192.168.56.10:3000/api/subscribe-topic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: currentToken, topic: `device_${deviceId}` }),
        });
        alert("✅ Notifications enabled!");
      } else {
        alert("❌ No registration token available.");
      }
    } catch (err) {
      console.error("FCM Token error:", err);
    }
  };

useEffect(() => {
  const unsubscribe = onMessage(messaging, (payload) => {
  const msgDeviceId = payload.data?.deviceId;
  if (msgDeviceId === String(deviceId)) {
    setMessages(prev => [payload.notification, ...prev]);
  }
});


  return () => unsubscribe();
}, [deviceId]);


  return (
    <div
      style={{
        border: "1px solid #ddd",
        color: "black",
        padding: "20px",
        borderRadius: "12px",
        maxWidth: "400px",
        margin: "20px auto",
        background: "#f9f9f9",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ marginBottom: "10px", textAlign: "center" }}>
        🔔 Device {deviceId} Notifications
      </h2>

      <button
        onClick={requestPermission}
        style={{
          background: "#4CAF50",
          color: "white",
          border: "none",
          padding: "10px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          marginBottom: "15px",
          display: "block",
          width: "100%",
        }}
      >
        Enable Notifications
      </button>

      {token && (
        <p style={{ fontSize: "12px", color: "#333", wordWrap: "break-word" }}>
          {/* <strong>FCM Token:</strong> {token} */}
        </p>
      )}

      <div style={{ marginTop: "15px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>📩 Messages</h3>
        {messages.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#888" }}>No messages yet</p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                background: "white",
                border: "1px solid #eee",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "8px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              }}
            >
              <strong>{msg.title}</strong>
              <p style={{ margin: "5px 0", fontSize: "13px" }}>{msg.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationManager;
