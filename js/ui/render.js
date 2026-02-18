import { loginWithGoogle, logoutUser } from '../services/auth-manager.js';

const appRoot = document.getElementById('app-root');

export const renderLogin = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-900">
            <div class="bg-gray-800 p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full border border-gray-700">
                <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h1 class="text-2xl font-bold text-white mb-2">Sales Tracker</h1>
                <p class="text-gray-400 mb-8 text-sm">Secure Portal Login</p>
                <button id="login-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center shadow-lg">
                    Sign In with Google
                </button>
            </div>
        </div>
    `;

    document.getElementById('login-btn').addEventListener('click', loginWithGoogle);
};

export const renderPendingScreen = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
            <div class="bg-gray-800 border border-gray-700 p-8 rounded-2xl shadow-2xl max-w-sm text-center">
                <div class="text-yellow-500 mb-4 flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
                <h2 class="text-xl font-bold text-white mb-2">Approval Pending</h2>
                <p class="text-gray-400 text-sm mb-6">Your account is waiting for administrator approval.</p>
                <button id="logout-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition">Sign Out</button>
            </div>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
};

export const renderSuspendedScreen = () => {
    appRoot.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-red-900/20 p-4">
            <div class="bg-gray-900 border border-red-900 p-8 rounded-2xl shadow-2xl max-w-sm text-center">
                <h1 class="text-3xl font-bold text-red-500 mb-2">Suspended</h1>
                <p class="text-gray-400 mb-6">Access has been revoked.</p>
                <button id="logout-btn" class="bg-red-900/50 hover:bg-red-900 text-red-200 px-6 py-2 rounded-lg font-bold transition">Sign Out</button>
            </div>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
};