import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the specific databaseId provided in the config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Connection validation as per instructions
async function testConnection() {
  try {
    // Attempting a read to verify connection and databaseId
    await getDocFromServer(doc(db, '_connection_test_', 'init'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    // Note: Permission denied is expected since we haven't set rules yet, 
    // but the error confirms the SDK is communicating with a valid database instance.
  }
}

testConnection();
