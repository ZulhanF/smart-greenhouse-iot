import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB1rXT7I1b6ol0Hlg0uJuFxzrNxAp8tVyo",
  authDomain: "aura-sphere-iot.firebaseapp.com",
  databaseURL: "https://aura-sphere-iot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aura-sphere-iot",
  storageBucket: "aura-sphere-iot.firebasestorage.app",
  messagingSenderId: "417456440084",
  appId: "1:417456440084:web:c01f420d4a9e100656f801",
  measurementId: "G-Z6176YTKPF"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);