const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("../firebase/firebase-service-account-realtech.json")), // <-- service account json from Firebase
});
module.exports = admin;
