import { 
    processSale, 
    requestStock, 
    saveVehicleInfo, 
    requestCover, 
    subscribeToAllCoverRequests, 
    acceptCoverRequest, 
    getDriverStats 
} from '../services/driver-service.js';
import { 
    subscribeToPendingOrders, 
    subscribeToDriverActiveOrders, 
    markArrived, 
    completeOrder, 
    acceptOrder 
} from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase.js';
import { formatDate, formatTime } from '../utils/formatters.js';

const appRoot = document.getElementById('app-root');
let calendarDate = new Date();
let currentUserData = null;
let activeOrder = null;
let cachedCoverRequests = [];

export const renderDriverDashboard = (user) => {
    // 1. Live User Data Listener
    onSnapshot(doc(db, "users", user.uid), (snap) => {
        currentUserData = snap.data();
        updateDashboardUI(currentUserData);
    });

    // 2. Cover Requests Listener (for Calendar)
    subscribeToAllCoverRequests((reqs) => {
        cachedCoverRequests = reqs;
        // If the schedule view is active, refresh the calendar
        if(!document.getElementById('view-schedule').classList.contains('hidden')) {
            renderDriverCalendar(user); 
        }
    });

    // 3. Main Layout
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-100 dark:bg-gray-900 pb-24 transition-colors duration-200">
            <header class="bg-blue-600 dark:bg-gray-800 text-white p-4 sticky top-0 z-40 shadow-md flex justify-between items-center">
                <h1 class="font-bold text-lg">Driver Portal</h1>
                <div class="flex gap-2">
                    <button id="btn-status-toggle" class="flex items-center bg-black/20 px-3 py-1 rounded-full text-xs transition active:scale-95">
                        <div id="status-dot" class="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>
                        <span id="status-text">Offline</span>
                    </button>
                    <button id="btn-settings" class="p-2 bg-blue-700 dark:bg-gray-700 rounded-full hover:bg-blue-800 transition"><i data-lucide="settings" class="w-5 h-5"></i></button>
                </div>
            </header>

            <nav class="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-2 z-50 flex justify-around shadow-lg">
                <button class="nav-btn flex flex-col items-center p-2 text-blue-600 dark:text-blue-400 transition" data-target="dashboard">
                    <i data-lucide="layout-dashboard" class="w-6 h-6"></i><span class="text-[10px] mt-1">Home</span>
                </button>
                <button class="nav-btn flex flex-col items-center p-2 text-gray-400 hover:text-blue-500 transition" data-target="schedule">
                    <i data-lucide="calendar" class="w-6 h-6"></i><span class="text-[10px] mt-1">Schedule</span>
                </button>
                <button class="nav-btn flex flex-col items-center p-2 text-gray-400 hover:text-blue-500 transition" data-target="summary">
                    <i data-lucide="bar-chart-2" class="w-6 h-6"></i><span class="text-[10px] mt-1">Summary</span>
                </button>
            </nav>

            <main class="p-4 max-w-md mx-auto space-y-4 mb-16">
                
                <div id="view-dashboard" class="view-section animate-fadeIn">
                    
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 class="text-gray-500 text-xs uppercase">Stock</h2>
                            <div class="text-3xl font-bold dark:text-white" id="display-stock">--</div>
                            <button id="btn-req-stock" class="text-xs text-blue-600 mt-1 font-bold flex items-center hover:text-blue-800"><i data-lucide="plus" class="w-3 h-3 mr-1"></i> Request</button>
                        </div>
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 class="text-gray-500 text-xs uppercase">Debt</h2>
                            <div class="text-3xl font-bold text-red-500" id="display-debt">$0</div>
                        </div>
                    </div>

                    <div id="active-delivery-card" class="hidden bg-blue-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden mb-4">
                        <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="map-pin" class="w-24 h-24"></i></div>
                        <div class="relative z-10">
                            <div class="flex justify-between items-start mb-2">
                                <h2 class="font-bold text-lg">Current Job</h2>
                                <span class="bg-white/20 px-2 py-1 rounded text-xs font-bold" id="active-status">On the way</span>
                            </div>
                            <div class="mb-4">
                                <div class="text-2xl font-bold" id="active-address">...</div>
                                <div class="text-blue-100 text-sm" id="active-details">...</div>
                                <div class="text-yellow-300 font-bold text-lg mt-1" id="active-price">...</div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <button id="btn-job-arrived" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition">Arrived</button>
                                <button id="btn-job-complete" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg hidden transition">Complete</button>
                            </div>
                            <button id="btn-update-eta" class="w-full mt-2 text-xs text-blue-200 underline hover:text-white">Update ETA</button>
                        </div>
                    </div>

                    <div id="incoming-section" class="mb-6">
                        <h2 class="text-gray-500 text-xs uppercase font-bold mb-2 flex justify-between">
                            <span>Incoming Jobs</span> <span id="job-count" class="bg-red-500 text-white px-1.5 rounded-full text-[10px] hidden">0</span>
                        </h2>
                        <div id="incoming-list" class="space-y-2"></div>
                    </div>

                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                        <h2 class="text-gray-500 text-xs uppercase mb-3 font-bold">Manual Sales</h2>
                        
                        <div class="mb-4">
                            <span class="text-[10px] uppercase font-bold text-green-600 mb-1 block">Full Price (Earn $20/ea)</span>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => `
                                <button class="sale-btn p-2 border rounded bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:shadow-md active:scale-95 transition" data-qty="${n}" data-type="standard">
                                    <div class="text-sm font-bold text-green-700 dark:text-green-400">${n}</div>
                                    <div class="text-[10px] text-gray-500 dark:text-gray-400">$${n*80}</div>
                                </button>`).join('')}
                            </div>
                        </div>

                        <div>
                            <span class="text-[10px] uppercase font-bold text-orange-600 mb-1 block">Deal Price (Tiered)</span>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => {
                                    const prices = {1:80, 2:150, 3:220, 4:280};
                                    return `
                                    <button class="sale-btn p-2 border rounded bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:shadow-md active:scale-95 transition" data-qty="${n}" data-type="deal">
                                        <div class="text-sm font-bold text-orange-600 dark:text-orange-400">${n}</div>
                                        <div class="text-[10px] text-gray-500 dark:text-gray-400">$${prices[n]}</div>
                                    </button>`
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div id="view-schedule" class="view-section hidden animate-fadeIn">
                    <div class="flex justify-between items-center mb-4 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <button id="drv-cal-prev" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><i data-lucide="chevron-left" class="w-5 h-5 dark:text-white"></i></button>
                        <span id="drv-cal-month" class="font-bold dark:text-white">Month</span>
                        <button id="drv-cal-next" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><i data-lucide="chevron-right" class="w-5 h-5 dark:text-white"></i></button>
                    </div>
                    
                    <div id="drv-calendar" class="calendar-grid bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-700 mb-4"></div>
                    
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h3 class="font-bold text-sm text-blue-800 dark:text-blue-300 mb-1">Key</h3>
                        <div class="flex gap-4 text-xs dark:text-gray-300">
                            <span class="flex items-center"><div class="w-3 h-3 bg-blue-500 rounded mr-1"></div> My Shift</span>
                            <span class="flex items-center"><div class="w-3 h-3 bg-red-500 rounded mr-1"></div> Open Cover</span>
                        </div>
                    </div>
                </div>

                <div id="view-summary" class="view-section hidden animate-fadeIn">
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-xl shadow-lg mb-6">
                        <h2 class="text-green-100 text-xs uppercase font-bold mb-1">Weekly Profit Prediction</h2>
                        <div class="flex items-baseline">
                            <span class="text-4xl font-bold" id="weekly-profit-val">$0</span>
                            <span class="ml-2 text-green-200 text-sm">(@ $20/unit)</span>
                        </div>
                        <div class="mt-2 text-sm bg-white/20 inline-block px-2 py-1 rounded">
                            <span class="font-bold" id="weekly-units-val">0</span> Units Sold This Week
                        </div>
                    </div>

                    <h3 class="font-bold text-gray-800 dark:text-white mb-3">Recent Activity</h3>
                    <div id="summary-history-list" class="space-y-3 pb-10">
                        <div class="text-center text-gray-400 text-sm py-4">Loading history...</div>
                    </div>
                </div>
            </main>

            <div id="settings-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl shadow-xl">
                    <h2 class="text-xl font-bold dark:text-white mb-4">Settings</h2>
                    
                    <div class="mb-4">
                        <label class="text-xs font-bold text-gray-500 uppercase">My Vehicle</label>
                        <input type="text" id="veh-color" placeholder="Color" class="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 mb-2">
                        <input type="text" id="veh-model" placeholder="Model" class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        <button id="btn-save-veh" class="w-full bg-blue-600 text-white py-2 rounded font-bold mt-2 hover:bg-blue-700 transition">Save Vehicle</button>
                    </div>

                    <hr class="border-gray-200 dark:border-gray-700 my-4">

                    <button onclick="window.toggleTheme()" class="w-full flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                        <span class="font-medium dark:text-white">Dark Mode</span>
                        <i data-lucide="moon" class="w-5 h-5 text-gray-500 dark:text-gray-300"></i>
                    </button>

                    <button id="driver-logout" class="w-full flex justify-center items-center p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                        Sign Out
                    </button>

                    <button onclick="document.getElementById('settings-modal').classList.add('hidden')" class="w-full text-gray-400 py-2 mt-2 hover:text-gray-600">Close</button>
                </div>
            </div>

            <div id="cover-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl shadow-xl">
                    <h3 class="font-bold text-lg dark:text-white mb-2">Manage Shift</h3>
                    <p id="cover-shift-info" class="text-sm text-gray-500 mb-4">...</p>
                    
                    <div id="cover-form-group">
                        <label class="text-xs font-bold text-gray-500">Request Cover (Time Range)</label>
                        <div class="grid grid-cols-2 gap-2 mt-1 mb-4">
                            <input type="time" id="cover-start" class="border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                            <input type="time" id="cover-end" class="border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                        </div>
                        <button id="btn-submit-cover" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded transition">Request Cover</button>
                    </div>

                    <div id="take-shift-group" class="hidden">
                        <p class="text-sm text-blue-600 dark:text-blue-400 mb-4 font-medium">This shift is available. Take it?</p>
                        <button id="btn-take-shift" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition">Accept Shift</button>
                    </div>

                    <button onclick="document.getElementById('cover-modal').classList.add('hidden')" class="w-full text-gray-400 mt-4 hover:text-gray-600">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // 4. Initialization
    lucide.createIcons();
    attachEvents(user);
    initOrderListeners(user);
    loadSummaryData(user);
};

// --- EVENTS & HANDLERS ---

function attachEvents(user) {
    // 1. Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            
            // UI State
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('text-blue-600', 'dark:text-blue-400');
                b.classList.add('text-gray-400');
            });
            e.currentTarget.classList.remove('text-gray-400');
            e.currentTarget.classList.add('text-blue-600', 'dark:text-blue-400');
            
            // Views
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${target}`).classList.remove('hidden');

            if(target === 'schedule') renderDriverCalendar(user);
            if(target === 'summary') loadSummaryData(user);
        });
    });

    // 2. Settings & Logout
    document.getElementById('btn-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('hidden'));
    document.getElementById('driver-logout').addEventListener('click', () => logoutUser());
    document.getElementById('btn-save-veh').addEventListener('click', async () => {
        const color = document.getElementById('veh-color').value;
        const model = document.getElementById('veh-model').value;
        if(color && model) {
            await saveVehicleInfo(user.uid, { color, model });
            showToast("Vehicle Saved");
            document.getElementById('settings-modal').classList.add('hidden');
        }
    });

    // 3. Status Toggle
    document.getElementById('btn-status-toggle').addEventListener('click', async () => {
        const newStatus = (currentUserData.onlineStatus === 'online') ? 'offline' : 'online';
        await updateDoc(doc(db, "users", user.uid), { onlineStatus: newStatus });
    });
    
    // 4. Stock Request
    document.getElementById('btn-req-stock').addEventListener('click', async () => {
        if(confirm("Request Stock from Admin?")) {
            await requestStock(user.uid, user.displayName);
            showToast("Request Sent");
        }
    });

    // 5. MANUAL SALES LOGIC (The crucial part)
    document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Find the closest button in case user clicked inner text div
            const btnEl = e.target.closest('button');
            const qty = parseInt(btnEl.dataset.qty);
            const type = btnEl.dataset.type; // 'standard' or 'deal'
            
            const price = type === 'standard' ? qty * 80 : ({1:80,2:150,3:220,4:280}[qty]);
            const confirmMsg = `Confirm ${type.toUpperCase()} Sale?\nQty: ${qty}\nPrice: $${price}`;

            if(confirm(confirmMsg)) {
                const res = await processSale(user.uid, qty, type); 
                if(res.success) {
                    showToast(`Sold! Earned $${res.metrics.driverProfit}`);
                } else {
                    alert("Sale failed: " + res.error);
                }
            }
        });
    });

    // 6. Calendar & Cover
    document.getElementById('drv-cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()-1); renderDriverCalendar(user); });
    document.getElementById('drv-cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth()+1); renderDriverCalendar(user); });

    document.getElementById('btn-submit-cover').addEventListener('click', async () => {
        const modal = document.getElementById('cover-modal');
        const shift = JSON.parse(modal.dataset.shift);
        const start = document.getElementById('cover-start').value;
        const end = document.getElementById('cover-end').value;
        if(start && end) {
            await requestCover(user.uid, user.displayName, shift, start, end);
            showToast("Cover Requested");
            modal.classList.add('hidden');
        }
    });

    document.getElementById('btn-take-shift').addEventListener('click', async () => {
        const modal = document.getElementById('cover-modal');
        const reqId = modal.dataset.reqId;
        if(reqId) {
            const res = await acceptCoverRequest(reqId, user.uid, user.displayName);
            if(res.success) showToast("Shift Accepted!");
            else alert(res.error);
            modal.classList.add('hidden');
        }
    });
}

// --- ORDER HANDLING ---

function initOrderListeners(user) {
    // A. Active Order (My Assigned Order)
    subscribeToDriverActiveOrders(user.uid, (orders) => {
        if (orders.length > 0) {
            activeOrder = orders[0];
            const card = document.getElementById('active-delivery-card');
            const incoming = document.getElementById('incoming-section');
            
            // Swap views
            incoming.classList.add('hidden');
            card.classList.remove('hidden');
            
            // Populate
            document.getElementById('active-address').innerText = activeOrder.deliveryAddress;
            document.getElementById('active-details').innerText = `${activeOrder.quantity} Items • ${activeOrder.buyerName || 'Cust'}`;
            document.getElementById('active-price').innerText = `$${activeOrder.totalPrice} Cash`;
            
            const btnArrived = document.getElementById('btn-job-arrived');
            const btnComplete = document.getElementById('btn-job-complete');
            const statusLabel = document.getElementById('active-status');

            if(activeOrder.status === 'arrived') {
                btnArrived.classList.add('hidden');
                btnComplete.classList.remove('hidden');
                statusLabel.innerText = "Arrived";
                statusLabel.className = "bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold";
            } else {
                btnArrived.classList.remove('hidden');
                btnComplete.classList.add('hidden');
                statusLabel.innerText = "On the way";
                statusLabel.className = "bg-white/20 px-2 py-1 rounded text-xs font-bold";
            }

            // Events for Active Job
            btnArrived.onclick = async () => {
                if(confirm("Confirm arrival?")) await markArrived(activeOrder.id);
            };
            btnComplete.onclick = async () => {
                if(confirm(`Complete job? Collect $${activeOrder.totalPrice}`)) {
                    await processSale(user.uid, activeOrder.quantity, 'deal'); // Delivery usually Deal price? Or Standard? Logic assumes Deal for now.
                    await completeOrder(activeOrder.id);
                    showToast(`Job Completed!`);
                }
            };
            document.getElementById('btn-update-eta').onclick = async () => {
                const eta = prompt("Update ETA:");
                if(eta) {
                    const ref = doc(db, 'orders', activeOrder.id);
                    await updateDoc(ref, { eta: eta });
                    showToast("ETA Updated");
                }
            };

        } else {
            activeOrder = null;
            document.getElementById('active-delivery-card').classList.add('hidden');
            document.getElementById('incoming-section').classList.remove('hidden');
        }
    });

    // B. Incoming Orders (Marketplace)
    subscribeToPendingOrders((orders) => {
        const list = document.getElementById('incoming-list');
        const count = document.getElementById('job-count');
        
        list.innerHTML = '';
        
        if(orders.length > 0) {
            count.innerText = orders.length;
            count.classList.remove('hidden');
            
            orders.forEach(o => {
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center";
                div.innerHTML = `
                    <div>
                        <div class="font-bold dark:text-white">${o.deliveryAddress}</div>
                        <div class="text-xs text-gray-500">${o.quantity} items • <span class="text-green-600 font-bold">$${o.totalPrice}</span></div>
                    </div>
                    <button class="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded shadow hover:bg-blue-700 btn-accept-job" data-id="${o.id}">
                        Accept
                    </button>
                `;
                list.appendChild(div);
            });

            document.querySelectorAll('.btn-accept-job').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const oid = e.target.dataset.id;
                    if(!currentUserData.vehicle || !currentUserData.vehicle.model) return alert("Please set vehicle details in Settings first!");
                    const eta = prompt("Enter ETA (e.g. 15 mins):");
                    if(eta) {
                        const veh = `${currentUserData.vehicle.color} ${currentUserData.vehicle.model}`;
                        await acceptOrder(oid, user.uid, user.displayName, veh, eta);
                    }
                });
            });
        } else {
            count.classList.add('hidden');
            list.innerHTML = '<div class="text-center text-gray-400 text-sm py-4 italic">No active orders available.</div>';
        }
    });
}

// --- SUMMARY & STATS ---

async function loadSummaryData(user) {
    const stats = await getDriverStats(user.uid);
    document.getElementById('weekly-profit-val').innerText = `$${stats.weeklyProfit}`;
    document.getElementById('weekly-units-val').innerText = stats.weeklyUnits;

    const list = document.getElementById('summary-history-list');
    list.innerHTML = '';
    
    if(stats.history.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-400 text-sm">No recent sales.</div>';
        return;
    }

    stats.history.slice(0, 30).forEach(sale => {
        const el = document.createElement('div');
        el.className = "bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center";
        
        const date = sale.timestamp ? formatDate(sale.timestamp) : 'N/A';
        const time = sale.timestamp ? formatTime(sale.timestamp) : '';
        const isStandard = sale.type === 'standard';
        
        const badgeColor = isStandard 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';

        el.innerHTML = `
            <div>
                <div class="font-bold text-sm dark:text-white">
                    ${sale.quantity} Item(s) 
                    <span class="text-[10px] font-bold uppercase ml-1 px-1.5 py-0.5 rounded ${badgeColor}">
                        ${sale.type === 'standard' ? 'Full Price' : 'Deal'}
                    </span>
                </div>
                <div class="text-xs text-gray-400 mt-1">${date} at ${time}</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-gray-500 dark:text-gray-400">Profit</div>
                <div class="text-green-600 dark:text-green-400 font-bold text-sm">+$${sale.driverProfit}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

// --- CALENDAR UI ---

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
        const openCovers = cachedCoverRequests.filter(r => r.originalDate === dateStr && r.requesterUid !== user.uid);

        const dayEl = document.createElement('div');
        dayEl.className = "bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 min-h-[50px]";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        
        // 1. My Shifts
        shifts.forEach(s => {
            const bar = document.createElement('div');
            bar.className = "bg-blue-500 text-white cursor-pointer hover:bg-blue-600 mb-1 text-[10px] p-1 rounded truncate";
            bar.innerText = `${s.start}-${s.end}`;
            bar.onclick = () => openCoverModal(s, 'request');
            dayEl.appendChild(bar);
        });

        // 2. Open Covers
        openCovers.forEach(req => {
            const bar = document.createElement('div');
            bar.className = "bg-red-500 text-white cursor-pointer hover:bg-red-600 mb-1 text-[10px] p-1 rounded animate-pulse truncate";
            bar.innerText = `COVER: ${req.coverStart}-${req.coverEnd}`;
            bar.onclick = () => openCoverModal(req, 'take');
            dayEl.appendChild(bar);
        });

        grid.appendChild(dayEl);
    }
}

function openCoverModal(data, type) {
    const modal = document.getElementById('cover-modal');
    const title = document.getElementById('cover-shift-info');
    const reqForm = document.getElementById('cover-form-group');
    const takeForm = document.getElementById('take-shift-group');

    modal.classList.remove('hidden');
    
    if (type === 'request') {
        modal.dataset.shift = JSON.stringify(data);
        title.innerText = `My Shift: ${data.date} (${data.start}-${data.end})`;
        reqForm.classList.remove('hidden');
        takeForm.classList.add('hidden');
        document.getElementById('cover-start').value = data.start;
        document.getElementById('cover-end').value = data.end;
    } else {
        modal.dataset.reqId = data.id;
        title.innerText = `Request from ${data.requesterName} on ${data.originalDate}`;
        reqForm.classList.add('hidden');
        takeForm.classList.remove('hidden');
    }
}

function updateDashboardUI(data) {
    if(!data) return;
    document.getElementById('display-stock').innerText = data.currentStock || 0;
    document.getElementById('display-debt').innerText = `$${data.currentDebt || 0}`;
    if(data.vehicle) {
        document.getElementById('veh-color').value = data.vehicle.color || '';
        document.getElementById('veh-model').value = data.vehicle.model || '';
    }
    const isOnline = data.onlineStatus === 'online';
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    if(dot && txt) {
        dot.className = `w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`;
        txt.innerText = isOnline ? 'Online' : 'Offline';
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 3000);
}