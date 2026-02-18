import { auth, onAuthStateChanged, db, doc, getDoc, onSnapshot } from './services/firebase.js';
import { renderLogin, renderPendingScreen, renderSuspendedScreen } from './ui/render.js';
import { renderDriverDashboard } from './ui/driver-ui.js';
import { renderAdminDashboard } from './ui/admin-ui.js';
import { STATUS, ROLES } from './config/constants.js';

// Global variable to track the active Firestore listener
// We use this to stop listening to data when the user logs out or switches screens
let unsubscribeUserListener = null;

const initApp = () => {
    // This listener fires whenever the user logs in or out
    onAuthStateChanged(auth, async (user) => {
        
        // 1. Cleanup previous listeners if any
        if (unsubscribeUserListener) {
            unsubscribeUserListener();
            unsubscribeUserListener = null;
        }

        if (user) {
            // User is signed in. Now we need their Profile + Role from Firestore.
            // We use onSnapshot here too, so if an Admin changes your role/status, 
            // you get redirected immediately without refreshing!
            const userRef = doc(db, "users", user.uid);
            
            unsubscribeUserListener = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    handleUserRouting(userData);
                } else {
                    // Auth exists but Firestore doc missing (New user manually created in Console?)
                    console.error("User authenticated but no profile found.");
                    auth.signOut();
                }
            }, (error) => {
                console.error("Error fetching user profile:", error);
                renderLogin(); // Fallback
            });

        } else {
            // No user is signed in
            renderLogin();
        }
    });
};

const handleUserRouting = (user) => {
    console.log("Routing User:", user.displayName, "| Role:", user.role, "| Status:", user.accessStatus);

    // 1. Check Global Suspension
    if (user.accessStatus === STATUS.SUSPENDED) {
        renderSuspendedScreen();
        return;
    }

    // 2. Route based on Role
    switch (user.role) {
        
        case ROLES.ADMIN:
            // Admin Dashboard (Phase 3)
            renderAdminDashboard(user);
            break;

        case ROLES.DRIVER:
            // Driver Logic (Phase 2)
            if (user.accessStatus === STATUS.PENDING) {
                renderPendingScreen();
            } else {
                renderDriverDashboard(user);
                // Note: The driver dashboard might need its own listener for specific
                // UI updates (like the stock number changing).
                // We handle that simple update inside renderDriverDashboard or here.
                // For simplicity, we re-render or let the UI handle its own data binding.
                // Since this main listener triggers on ANY change to the user doc,
                // the entire dashboard re-renders if stock changes. 
                // This is okay for now, but in Phase 4 we can optimize it.
            }
            break;

        case ROLES.BUYER:
            // Buyer Logic (Phase 4 - Placeholder)
            renderBuyerPlaceholder(user);
            break;

        default:
            // Fallback for unknown roles
            document.getElementById('app-root').innerHTML = `
                <div class="p-8 text-center">
                    <h1 class="text-xl font-bold text-red-600">Error: Unknown Role</h1>
                    <p>Role '${user.role}' is not recognized.</p>
                    <button onclick="location.reload()" class="mt-4 bg-gray-800 text-white px-4 py-2 rounded">Reload</button>
                </div>
            `;
    }
};

// Temporary Placeholder for Phase 4
const renderBuyerPlaceholder = (user) => {
    document.getElementById('app-root').innerHTML = `
        <div class="min-h-screen bg-gray-50 flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-3xl font-bold text-blue-900">Buyer Dashboard</h1>
                <p class="text-gray-600 mt-2">Welcome, ${user.displayName}!</p>
                <p class="text-sm text-gray-400 mt-4">Buyer features are coming in Phase 4.</p>
                <button id="logout-btn-temp" class="mt-6 bg-red-500 text-white px-6 py-2 rounded shadow">Logout</button>
            </div>
        </div>
    `;
    
    // Simple logout for the placeholder
    document.getElementById('logout-btn-temp').addEventListener('click', () => {
        auth.signOut();
    });
};

// Start the app
document.addEventListener('DOMContentLoaded', initApp);