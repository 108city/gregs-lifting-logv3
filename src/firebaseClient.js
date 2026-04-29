// src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAvocHpUYtuHEXBkY_vzHbTNTfaGr445mw",
  authDomain: "lifting-log-50bb9.firebaseapp.com",
  projectId: "lifting-log-50bb9",
  storageBucket: "lifting-log-50bb9.firebasestorage.app",
  messagingSenderId: "959354202811",
  appId: "1:959354202811:web:b95188ff2da489000f979e",
  measurementId: "G-T8JPR0F3FR",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});
