import { processSale, requestStock, saveVehicleInfo, requestCover } from '../services/driver-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase.js';

const appRoot = document.getElementById('app-root');
let calendarDate = new Date();
let currentUserData = null;

export const renderDriverDashboard = (user) => {
    // 1. Setup Listener for LIVE user data (Stock/Debt/Shifts)
    onSnapshot(doc(db, "users", user.uid), (snap) => {
        currentUserData = snap.data();
        updateDashboardUI(currentUserData);
    });

    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-100 dark:bg-gray-900 pb-24 transition-colors duration-200">
            <header class="bg-blue-600 dark:bg-gray-800 text-white p-4 sticky top-0 z-40 shadow-md flex justify-between items-center">
                <div>
                    <h1 class="font-bold text-lg">Driver Portal</h1>
                    <button id="btn-status-toggle" class="flex items-center bg-black/20 px-2 py-0.5 rounded-full mt-1 text-xs transition active:scale-95">
                        <div id="status-dot" class="w-2 h-2 rounded-full bg-gray-400 mr-1.5"></div>
                        <span id="status-text">Offline</span>
                    </button>
                </div>
                <div class="flex gap-2">
                    <button id="btn-open-schedule" class="p-2 bg-blue-700 dark:bg-gray-700 rounded-full hover:bg-blue-800 transition"><i data-lucide="calendar" class="w-5 h-5"></i></button>
                    <button id="btn-open-settings" class="p-2 bg-blue-700 dark:bg-gray-700 rounded-full hover:bg-blue-800 transition"><i data-lucide="settings" class="w-5 h-5"></i></button>
                </div>
            </header>

            <main class="p-4 max-w-md mx-auto space-y-4">
                
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-gray-500 text-xs uppercase">My Stock</h2>
                            <div class="flex items-end">
                                <span class="text-4xl font-bold dark:text-white mr-3" id="display-stock">--</span>
                                <button id="btn-req-stock" class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-200 transition flex items-center"><i data-lucide="plus" class="w-3 h-3 mr-1"></i> Request</button>
                            </div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-gray-500 text-xs uppercase">Total Debt</h2>
                            <span class="text-2xl font-bold text-red-500" id="display-debt">$0</span>
                        </div>
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                    <h2 class="text-gray-500 text-xs uppercase mb-3 font-bold">New Sale</h2>
                    
                    <div class="mb-2">
                        <span class="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Standard Price ($80/ea)</span>
                        <div class="grid grid-cols-4 gap-2">
                            ${[1,2,3,4].map(n => `<button class="sale-btn p-2 border rounded bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:shadow-md transition active:scale-95" data-qty="${n}" data-type="standard"><div class="text-sm font-bold text-green-700 dark:text-green-400">${n}</div><div class="text-[10px] dark:text-gray-300">$${n*80}</div></button>`).join('')}
                        </div>
                    </div>

                    <div>
                        <span class="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Deal Price (Tiered)</span>
                        <div class="grid grid-cols-4 gap-2">
                            ${[1,2,3,4].map(n => {
                                const prices = {1:80, 2:150, 3:220, 4:280};
                                return `<button class="sale-btn p-2 border rounded bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:shadow-md transition active:scale-95" data-qty="${n}" data-type="deal"><div class="text-sm font-bold text-orange-600 dark:text-orange-400">${n}</div><div class="text-[10px] dark:text-gray-300">$${prices[n]}</div></button>`
                            }).join('')}
                        </div>
                    </div>
                </div>

                <button id="driver-logout" class="w-full mt-4 text-red-600 text-sm font-semibold p-4">Sign Out</button>
            </main>

            <div id="settings-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl shadow-2xl">
                    <h2 class="text-xl font-bold dark:text-white mb-4">Settings</h2>
                    <div class="mb-4">
                        <label class="text-xs font-bold text-gray-500 uppercase">My Vehicle</label>
                        <input type="text" id="veh-color" placeholder="Color" class="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm mb-2">
                        <input type="text" id="veh-model" placeholder="Model" class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">
                    </div>
                    <button id="btn-save-veh" class="w-full bg-blue-600 text-white py-2 rounded font-bold mb-4">Save Vehicle</button>
                    <button onclick="window.toggleTheme()" class="w-full border py-2 rounded font-bold dark:text-white mb-2">Toggle Dark Mode</button>
                    <button onclick="document.getElementById('settings-modal').classList.add('hidden')" class="w-full text-gray-500 py-2">Close</button>
                </div>
            </div>

            <div id="schedule-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl shadow-2xl">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold dark:text-white">My Schedule</h2>
                        <button onclick="document.getElementById('schedule-modal').classList.add('hidden')" class="text-gray-400"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    
                    <div class="flex justify-between items-center mb-2">
                        <button id="drv-cal-prev" class="p-1 bg-gray-200 dark:bg-gray-700 rounded"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                        <span id="drv-cal-month" class="font-bold text-sm dark:text-white">Month</span>
                        <button id="drv-cal-next" class="p-1 bg-gray-200 dark:bg-gray-700 rounded"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                    </div>
                    <div id="drv-calendar" class="calendar-grid bg-gray-50 dark:bg-gray-700 rounded p-1 mb-4"></div>

                    <div id="cover-section" class="hidden bg-gray-50 dark:bg-gray-900 p-3 rounded border dark:border-gray-700">
                        <h4 class="text-xs font-bold uppercase mb-2 dark:text-white">Request Cover</h4>
                        <p id="sel-shift-info" class="text-xs mb-2 dark:text-gray-300"></p>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <input type="time" id="cover-start" class="border rounded p-1 text-xs">
                            <input type="time" id="cover-end" class="border rounded p-1 text-xs">
                        </div>
                        <button id="btn-submit-cover" class="w-full bg-purple-600 text-white py-1.5 rounded text-xs font-bold">Submit Request</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
    attachEvents(user);
};

function updateDashboardUI(data) {
    if(!data) return;
    document.getElementById('display-stock').innerText = data.currentStock || 0;
    document.getElementById('display-debt').innerText = `$${data.currentDebt || 0}`;
    
    // Vehicle
    if(data.vehicle) {
        document.getElementById('veh-color').value = data.vehicle.color || '';
        document.getElementById('veh-model').value = data.vehicle.model || '';
    }

    // Status
    const isOnline = data.onlineStatus === 'online';
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    if(dot && txt) {
        dot.className = `w-2 h-2 rounded-full mr-1.5 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`;
        txt.innerText = isOnline ? 'Online' : 'Offline';
    }
}

function attachEvents(user) {
    document.getElementById('driver-logout').addEventListener('click', () => logoutUser());
    
    // Status Toggle
    document.getElementById('btn-status-toggle').addEventListener('click', async () => {
        const newStatus = (currentUserData.onlineStatus === 'online') ? 'offline' : 'online';
        await updateDoc(doc(db, "users", user.uid), { onlineStatus: newStatus });
    });

    // Stock Request
    document.getElementById('btn-req-stock').addEventListener('click', async () => {
        if(confirm("Notify Admin you need stock?")) {
            await requestStock(user.uid, user.displayName);
            showToast("Request Sent");
        }
    });

    // Sales
    document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Traverse up to button in case click hits inner div
            const target = e.target.closest('button');
            const qty = parseInt(target.dataset.qty);
            const type = target.dataset.type;
            const isDeal = type === 'deal';
            
            if(confirm(`Sell ${qty} item(s) (${type} price)?`)) {
                const res = await processSale(user.uid, qty, isDeal);
                if(res.success) showToast(`Sold! Profit: $${res.metrics.driverProfit}`);
                else alert(res.error);
            }
        });
    });

    // Settings
    document.getElementById('btn-open-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('hidden'));
    document.getElementById('btn-save-veh').addEventListener('click', async () => {
        const color = document.getElementById('veh-color').value;
        const model = document.getElementById('veh-model').value;
        if(color && model) {
            await saveVehicleInfo(user.uid, { color, model });
            showToast("Vehicle Saved");
            document.getElementById('settings-modal').classList.add('hidden');
        }
    });

    // Schedule
    document.getElementById('btn-open-schedule').addEventListener('click', () => {
        document.getElementById('schedule-modal').classList.remove('hidden');
        renderDriverCalendar(user);
    });
    
    document.getElementById('drv-cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()-1); renderDriverCalendar(user); });
    document.getElementById('drv-cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()+1); renderDriverCalendar(user); });
    
    // Cover Request
    document.getElementById('btn-submit-cover').addEventListener('click', async () => {
        const start = document.getElementById('cover-start').value;
        const end = document.getElementById('cover-end').value;
        const meta = JSON.parse(document.getElementById('cover-section').dataset.shift);
        
        if(start && end) {
            await requestCover(user.uid, user.displayName, meta, start, end);
            showToast("Cover Requested");
            document.getElementById('cover-section').classList.add('hidden');
        }
    });
}

function renderDriverCalendar(user) {
    const grid = document.getElementById('drv-calendar');
    const label = document.getElementById('drv-cal-month');
    grid.innerHTML = '';
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    label.innerText = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for(let i=0; i<startDay; i++) grid.innerHTML += `<div></div>`;

    const myShifts = currentUserData.shifts || [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const shifts = myShifts.filter(s => s.date === dateStr);
        
        const dayEl = document.createElement('div');
        dayEl.className = "calendar-day bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        
        shifts.forEach(s => {
            const bar = document.createElement('div');
            bar.className = "bg-blue-500 text-white shift-bar cursor-pointer hover:bg-blue-600";
            bar.innerText = `${s.start}-${s.end}`;
            bar.onclick = () => {
                const sec = document.getElementById('cover-section');
                sec.classList.remove('hidden');
                sec.dataset.shift = JSON.stringify(s);
                document.getElementById('sel-shift-info').innerText = `Shift: ${s.date} (${s.start}-${s.end})`;
                document.getElementById('cover-start').value = s.start;
                document.getElementById('cover-end').value = s.end;
            };
            dayEl.appendChild(bar);
        });
        grid.appendChild(dayEl);
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 3000);
}