// firebase-config.js - FIXED VERSION
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail  // ← ADD THIS
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where,
    doc,
    deleteDoc,
    updateDoc,  // ✅ ADD THIS IMPORT
    getDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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
console.log('🚀 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
console.log('✅ Firebase app initialized');

const auth = getAuth(app);
console.log('✅ Firebase auth initialized');

const db = getFirestore(app);
console.log('✅ Firebase Firestore initialized');

// ✅ EXPORT updateDoc
export { 
    auth, db, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,sendPasswordResetEmail,  // ← ADD THIS
    collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc 
};