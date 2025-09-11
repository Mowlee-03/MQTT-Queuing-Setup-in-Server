import { useState } from "react";
import "./App.css";
import NotificationManager from "./NotificationManager";

function App() {
  // Get deviceId from URL query param
  const searchParams = new URLSearchParams(window.location.search);
  const deviceId = searchParams.get("deviceid") || "1"; // default to 1

  return (
    <>
      <NotificationManager deviceId={deviceId} />
    </>
  );
}

export default App;
