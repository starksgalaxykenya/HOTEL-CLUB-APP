// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDn3dGe2dhgfrqwYENgWA1biEW8ngXv068",
  authDomain: "office-manager-pro-1b6ae.firebaseapp.com",
  projectId: "office-manager-pro-1b6ae",
  storageBucket: "office-manager-pro-1b6ae.firebasestorage.app",
  messagingSenderId: "202156442292",
  appId: "1:202156442292:web:664d17e9c8e75535168de1",
  measurementId: "G-BTY9GY3HBX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Firebase collections reference
const menuRef = db.collection("menu");
const ordersRef = db.collection("orders");
const requestsRef = db.collection("requests");
const tablesRef = db.collection("tables");
const staffRef = db.collection("staff");
const settingsRef = db.collection("settings");
