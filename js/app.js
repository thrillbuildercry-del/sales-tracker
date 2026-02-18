import { auth, onAuthStateChanged, db, doc, onSnapshot } from './services/firebase.js';
import { renderLogin, renderPendingScreen, renderSuspendedScreen } from './ui/render.js';
import { renderDriverDashboard } from './ui/driver-ui.js';
import { renderAdminDashboard } from './ui/admin-ui.js';
import { renderBuyerDashboard } from './ui/buyer-ui.js';
import { STATUS, ROLES } from './config/constants.js';

let unsubscribeUserListener = null;

// Expose Theme Toggle Globally
window.toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
};

const initApp = () => {
    onAuthStateChanged(auth, async (user) => {
        if (unsubscribeUserListener) {
            unsubscribeUserListener();
            unsubscribeUserListener = null;
        }

        if (user) {
            const userRef = doc(db, "users", user.uid);
            unsubscribeUserListener = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    handleUserRouting({ uid: user.uid, ...docSnap.data() });
                } else {
                    console.error("User authenticated but no profile found in Firestore.");
                    // Optional: If doc doesn't exist, we might need to recreate it or show error.
                    // Auth-Manager usually creates it on login.
                    renderLogin();
                }
            }, (error) => {
                console.error("Error fetching user profile:", error);
                renderLogin();
            });

        } else {
            renderLogin();
        }
    });
};

const handleUserRouting = (user) => {
    // 1. Check Suspension
    if (user.accessStatus === STATUS.SUSPENDED) {
        renderSuspendedScreen();
        return;
    }

    // 2. Route by Role
    switch (user.role) {
        case ROLES.ADMIN:
            renderAdminDashboard(user);
            break;

        case ROLES.DRIVER:
            if (user.accessStatus === STATUS.PENDING) {
                renderPendingScreen();
            } else {
                renderDriverDashboard(user);
            }
            break;

        case ROLES.BUYER:
            renderBuyerDashboard(user);
            break;

        default:
            document.getElementById('app-root').innerHTML = `<div class="p-8 text-center text-red-500">Unknown Role: ${user.role}</div>`;
    }
};

document.addEventListener('DOMContentLoaded', initApp);