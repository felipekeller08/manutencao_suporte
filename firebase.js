// firebase.js — módulos CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadString, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNg6iwpXItYxrQOt_bF6FbK4S6qjYFW6Q",
  authDomain: "manutencaosenai-d235a.firebaseapp.com",
  projectId: "manutencaosenai-d235a",
  storageBucket: "manutencaosenai-d235a.firebasestorage.app",
  messagingSenderId: "56330243054",
  appId: "1:56330243054:web:4729db391af5e906e49cff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  auth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  db, doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, getDocs,
  storage, ref, uploadString, getDownloadURL
};
