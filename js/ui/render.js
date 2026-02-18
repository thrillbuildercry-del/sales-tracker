import { loginWithGoogle, logoutUser } from '../services/auth-manager.js';

const appRoot = document.getElementById('app-root');

export const renderLogin = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-900 transition-colors duration-200">
            <div class="bg-gray-800 p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full border border-gray-700">
                <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h1 class="text-2xl font-bold text-white mb-2">Sales Tracker</h1>
                <p class="text-gray-400 mb-8 text-sm">Secure Portal Login</p>
                
                <div class="space-y-3">
                    <button id="login-driver-btn" class="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-xl hover:bg-gray-100 transition duration-200 flex items-center justify-center shadow-lg">
                        <span class="mr-2">Staff Login</span>
                    </button>
                    
                    <div class="text-gray-500 text-xs">- OR -</div>

                    <button id="login-buyer-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center shadow-lg">
                        <span class="mr-2">Customer Login</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Note: In the new system, we might distinguish intent by which button is clicked
    // For simplicity, both trigger Google Auth, but backend/auth-manager decides initial role if new.
    // To implement "Buyer vs Driver" specific signup, we'd pass a flag to loginWithGoogle.
    
    document.getElementById('login-driver-btn').addEventListener('click', () => loginWithGoogle('driver'));
    document.getElementById('login-buyer-btn').addEventListener('click', () => loginWithGoogle('buyer'));
};

export const renderPendingScreen = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
            <div class="bg-gray-800 border border-gray-700 p-8 rounded-2xl shadow-2xl max-w-sm text-center">
                <div class="text-yellow-500 mb-4 flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
                <h2 class="text-xl font-bold text-white mb-2">Approval Pending</h2>
                <p class="text-gray-400 text-sm mb-6">Your staff account is waiting for administrator approval.</p>
                <button id="logout-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition">Sign Out</button>
            </div>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
};

export const renderSuspendedScreen = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
            <div class="bg-gray-800 border border-red-900/50 p-8 rounded-2xl shadow-2xl max-w-sm text-center">
                <div class="text-red-500 mb-4 flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
                <h1 class="text-2xl font-bold text-white mb-2">Access Suspended</h1>
                <p class="text-gray-400 text-sm mb-6">Please contact management for assistance.</p>
                <button id="logout-btn" class="bg-red-900/50 hover:bg-red-900 text-red-200 px-6 py-2 rounded-lg font-bold transition">Sign Out</button>
            </div>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
};