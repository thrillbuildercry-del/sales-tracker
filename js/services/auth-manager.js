import { auth, db, provider, signInWithPopup, signOut, doc, getDoc, setDoc, serverTimestamp } from './firebase.js';
import { ROLES, STATUS } from '../config/constants.js';

export const loginWithGoogle = async (preferredRole = ROLES.BUYER) => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user exists in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // NEW USER LOGIC
            // If they clicked "Staff Login", set role=DRIVER and status=PENDING
            // If they clicked "Customer Login", set role=BUYER and status=ACTIVE
            
            const initialStatus = (preferredRole === ROLES.DRIVER) ? STATUS.PENDING : STATUS.ACTIVE;
            
            const newUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: preferredRole, 
                accessStatus: initialStatus,
                createdAt: serverTimestamp(),
                currentStock: 0,
                currentDebt: 0,
                vehicle: { color: '', model: '' } // Initialize empty vehicle object
            };
            
            await setDoc(userRef, newUser);
            return newUser;
        } else {
            // EXISTING USER
            // Return current data (roles might have changed since sign-up)
            return userSnap.data();
        }
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Logout failed", error);
    }
};