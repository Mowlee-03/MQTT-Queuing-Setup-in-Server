// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDDS6v1QTPrjSCM49ER68fMYnuFsdDfZPE",
  authDomain: "realtech-481ad.firebaseapp.com",
  projectId: "realtech-481ad",
  storageBucket: "realtech-481ad.firebasestorage.app",
  messagingSenderId: "486328216555",
  appId: "1:486328216555:web:10b56dc623736d5e98c7ae"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background message:", payload);

  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/vite.svg", // optional, you can use your own app icon
  });
});
