import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { CONFIG } from './config.js';

// Initialize Firebase
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth, ref, set, get, onValue, push, remove, update };
