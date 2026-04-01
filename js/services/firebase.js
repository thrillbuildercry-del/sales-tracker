import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    addDoc, 
    collection,
    query,
    where,
    orderBy, 
    onSnapshot,
    getDocs,
    runTransaction,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    // Paste your config object here
    apiKey: "AIzaSyDz4iG5KZy3JAxBhubaGEaMKTY7jcObRDE",
    authDomain: "deals-bcfea.firebaseapp.com",
    projectId: "deals-bcfea",
    storageBucket: "deals-bcfea.firebasestorage.app",
    messagingSenderId: "686014043249",
    appId: "1:686014043249:web:8dcc93549cdb265269b7d0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { 
    auth, 
    db, 
    provider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    runTransaction,
    serverTimestamp
};