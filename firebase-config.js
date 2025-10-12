// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where,
    doc,
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDXDmeDAkd9Z7PsquQFpn-9uOu6ycHWS7k",
    authDomain: "trading-journal-5410f.firebaseapp.com",
    projectId: "trading-journal-5410f",
    storageBucket: "trading-journal-5410f.firebasestorage.app",
    messagingSenderId: "362252140223",
    appId: "1:362252140223:web:9350b62b88d8cc1e88d00a",
    measurementId: "G-PXYC3VKZ3K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
         onAuthStateChanged, signOut, collection, addDoc, getDocs, query, 
         where, doc, deleteDoc };