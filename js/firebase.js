// Firebase Configuration and Initialization
// Replace with your Firebase project config

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  // TODO: Replace with your Firebase project config
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Authentication functions
export const firebaseAuth = {
  // Sign up new user
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        recentlyPlayed: [],
        likedSongs: [],
        playlists: [],
        createdAt: new Date().toISOString()
      });

      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign in existing user
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign out user
  async signOut() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
  }
};

// Firestore functions
export const firestoreDB = {
  // Get user data
  async getUserData(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data() };
      } else {
        return { success: false, error: 'User data not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update user data
  async updateUserData(userId, data) {
    try {
      await updateDoc(doc(db, 'users', userId), data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Add to recently played
  async addToRecentlyPlayed(userId, songData) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        recentlyPlayed: arrayUnion(songData)
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Add/remove liked song
  async toggleLikedSong(userId, songId, isLiked) {
    try {
      const userRef = doc(db, 'users', userId);
      if (isLiked) {
        await updateDoc(userRef, {
          likedSongs: arrayUnion(songId)
        });
      } else {
        await updateDoc(userRef, {
          likedSongs: arrayRemove(songId)
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update playlists
  async updatePlaylists(userId, playlists) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        playlists: playlists
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};