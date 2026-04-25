import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCbvCjVfKlKecUhlaBooZUu46-ROzmPrHA',
  authDomain: 'kimsangin-invest-app.firebaseapp.com',
  projectId: 'kimsangin-invest-app',
  storageBucket: 'kimsangin-invest-app.firebasestorage.app',
  messagingSenderId: '532399316232',
  appId: '1:532399316232:web:adb24c8a04030dd972e0bd',
  measurementId: 'G-M6XYG1V9MB',
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);

googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});
