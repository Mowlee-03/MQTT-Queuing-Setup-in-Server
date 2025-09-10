
// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyDDS6v1QTPrjSCM49ER68fMYnuFsdDfZPE",
//   authDomain: "realtech-481ad.firebaseapp.com",
//   projectId: "realtech-481ad",
//   storageBucket: "realtech-481ad.firebasestorage.app",
//   messagingSenderId: "486328216555",
//   appId: "1:486328216555:web:10b56dc623736d5e98c7ae"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDS6v1QTPrjSCM49ER68fMYnuFsdDfZPE",
  authDomain: "realtech-481ad.firebaseapp.com",
  projectId: "realtech-481ad",
  storageBucket: "realtech-481ad.firebasestorage.app",
  messagingSenderId: "486328216555",
  appId: "1:486328216555:web:10b56dc623736d5e98c7ae"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };
