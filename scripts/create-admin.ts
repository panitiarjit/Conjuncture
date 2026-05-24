import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin environment variables in .env.local");
  process.exit(1);
}

const existing = getApps().find(a => a.name === 'admin');
const app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin');
const auth = getAuth(app);

const email = 'corizon.startup@gmail.com';
const password = 'Corizon2026';

(async () => {
  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`User already exists with UID: ${user.uid}. Updating password...`);
      await auth.updateUser(user.uid, {
        password: password,
        displayName: 'Admin'
      });
      console.log(`Successfully updated password for ${email}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`User does not exist. Creating new user...`);
        user = await auth.createUser({
          email: email,
          password: password,
          displayName: 'Admin',
          emailVerified: true
        });
        console.log(`Successfully created new user: ${email} with UID: ${user.uid}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error managing user account:', error);
    process.exit(1);
  }
})();
