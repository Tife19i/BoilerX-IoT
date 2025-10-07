// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "Private/hidden",
  authDomain: "boilerxtemp.firebaseapp.com",
  databaseURL: "https://boilerxtemp-default-rtdb.firebaseio.com",
  projectId: "boilerxtemp",
  storageBucket: "boilerxtemp.firebasestorage.app",
  messagingSenderId: "815114282403",
  appId: "1:815114282403:web:892022d009f890e7a4e616"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, onValue };
