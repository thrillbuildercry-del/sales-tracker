import { auth, db, provider, signInWithPopup, signOut, doc, getDoc, setDoc } from './firebase.js';
import { ROLES, STATUS } from '../config/constants.js';

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user exists in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // NEW USER LOGIC
            // For now, we default new web sign-ins to BUYER. 
            // Admin can manually change them to DRIVER later, 
            // OR we can add a UI selection step. 
            // Based on your prompt, let's assume default is BUYER for public access,
            // but we need a mechanism to flag Drivers.
            
            // For this phase, we will default to BUYER (Active).
            // To create an ADMIN or DRIVER initially, you usually edit Firestore manually
            // for the first user, or use a specific sign-up link logic.
            
            const newUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: ROLES.BUYER, 
                accessStatus: STATUS.ACTIVE,
                createdAt: new Date(),
                currentStock: 0,
                currentDebt: 0
            };
            
            await setDoc(userRef, newUser);
            return newUser;
        } else {
            return userSnap.data();
        }
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
};

export const logoutUser = () => {
    return signOut(auth);
};