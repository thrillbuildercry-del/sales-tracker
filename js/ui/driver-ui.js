import { processSale, requestStock, saveVehicleInfo, requestCover, subscribeToAllCoverRequests, acceptCoverRequest, getDriverStats } from '../services/driver-service.js';
import { subscribeToPendingOrders, subscribeToDriverActiveOrders, markArrived, completeOrder, acceptOrder } from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase.js';
import { formatDate, formatTime } from '../utils/formatters.js';

const appRoot = document.getElementById('app-root');
let calendarDate = new Date();
let currentUserData = null;
let activeOrder = null;
let cachedCoverRequests = [];

export const renderDriverDashboard = (user) => {
    // Live User Data
    onSnapshot(doc(db, "users", user.uid), (snap) => {
        currentUserData = snap.data();
        updateDashboardUI(currentUserData);
    });

    // Listen to Cover Requests
    subscribeToAllCoverRequests((reqs) => {
        cachedCoverRequests = reqs;
        if(!document.getElementById('view-schedule').classList.contains('hidden')) {
            renderDriverCalendar(user); 
        }
    });

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
                <button class="nav-btn flex flex-col items-center p-2 text-blue-600 dark:text-blue-400" data-target="dashboard">
                    <i data-lucide="layout-dashboard" class="w-6 h-6"></i><span class="text-[10px] mt-1">Home</span>
                </button>
                <button class="nav-btn flex flex-col items-center p-2 text-gray-400 hover:text-blue-500" data-target="schedule">
                    <i data-lucide="calendar" class="w-6 h-6"></i><span class="text-[10px] mt-1">Schedule</span>
                </button>
                <button class="nav-btn flex flex-col items-center p-2 text-gray-400 hover:text-blue-500" data-target="summary">
                    <i data-lucide="bar-chart-2" class="w-6 h-6"></i><span class="text-[10px] mt-1">Summary</span>
                </button>
            </nav>

            <main class="p-4 max-w-md mx-auto space-y-4 mb-16">
                
                <div id="view-dashboard" class="view-section animate-fadeIn">
                    
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 class="text-gray-500 text-xs uppercase">Stock</h2>
                            <div class="text-3xl font-bold dark:text-white" id="display-stock">--</div>
                            <button id="btn-req-stock" class="text-xs text-blue-600 mt-1 font-bold flex items-center"><i data-lucide="plus" class="w-3 h-3 mr-1"></i> Request</button>
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
                                <button id="btn-job-arrived" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg">Arrived</button>
                                <button id="btn-job-complete" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg hidden">Complete</button>
                            </div>
                            <button id="btn-update-eta" class="w-full mt-2 text-xs text-blue-200 underline">Update ETA</button>
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
                    <div class="flex justify-between items-center mb-4 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm">
                        <button id="drv-cal-prev" class="p-1"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
                        <span id="drv-cal-month" class="font-bold dark:text-white">Month</span>
                        <button id="drv-cal-next" class="p-1"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
                    </div>
                    <div id="drv-calendar" class="calendar-grid bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm mb-4"></div>
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
                    <div id="summary-history-list" class="space-y-3 pb-10"></div>
                </div>
            </main>

            <div id="settings-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl">
                    <h2 class="text-xl font-bold dark:text-white mb-4">Settings</h2>
                    
                    <div class="mb-4">
                        <label class="text-xs font-bold text-gray-500 uppercase">My Vehicle</label>
                        <input type="text" id="veh-color" placeholder="Color" class="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:text-white mb-2">
                        <input type="text" id="veh-model" placeholder="Model" class="w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                        <button id="btn-save-veh" class="w-full bg-blue-600 text-white py-2 rounded font-bold mt-2">Save Vehicle</button>
                    </div>

                    <hr class="border-gray-200 dark:border-gray-700 my-4">

                    <button onclick="window.toggleTheme()" class="w-full flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
                        <span class="font-medium dark:text-white">Dark Mode</span>
                        <i data-lucide="moon" class="w-5 h-5 text-gray-500 dark:text-gray-300"></i>
                    </button>

                    <button id="driver-logout" class="w-full flex justify-center items-center p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-bold">
                        Sign Out
                    </button>

                    <button onclick="document.getElementById('settings-modal').classList.add('hidden')" class="w-full text-gray-400 py-2 mt-2">Close</button>
                </div>
            </div>

            <div id="cover-modal" class="hidden"></div> 
            </div>
    `;

    lucide.createIcons();
    attachEvents(user);
    initOrderListeners(user);
    loadSummaryData(user);
};

// --- NAVIGATION & TABS ---
function attachEvents(user) {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            // Update UI Colors
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.replace('text-blue-600', 'text-gray-400'));
            e.currentTarget.classList.replace('text-gray-400', 'text-blue-600');
            
            // Show Section
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${target}`).classList.remove('hidden');

            if(target === 'schedule') renderDriverCalendar(user);
            if(target === 'summary') loadSummaryData(user);
        });
    });

    // Settings
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

    // Dashboard Actions
    document.getElementById('btn-status-toggle').addEventListener('click', async () => {
        const newStatus = (currentUserData.onlineStatus === 'online') ? 'offline' : 'online';
        await updateDoc(doc(db, "users", user.uid), { onlineStatus: newStatus });
    });
    
    document.getElementById('btn-req-stock').addEventListener('click', async () => {
        if(confirm("Request Stock from Admin?")) {
            await requestStock(user.uid, user.displayName);
            showToast("Request Sent");
        }
    });

    document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.target.closest('button');
            const qty = parseInt(btnEl.dataset.qty);
            const type = btnEl.dataset.type; // 'standard' or 'deal'
            
            const price = type === 'standard' ? qty * 80 : ({1:80,2:150,3:220,4:280}[qty]);
            
            if(confirm(`Sell ${qty} item(s) at ${type.toUpperCase()} price ($${price})?`)) {
                const res = await processSale(user.uid, qty, type); 
                if(res.success) {
                    showToast(`Sold! Earned $${res.metrics.driverProfit}`);
                } else {
                    alert("Sale failed");
                }
            }
        });
    });

    // Calendar & Cover
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

// --- SUMMARY TAB LOGIC ---
async function loadSummaryData(user) {
    const stats = await getDriverStats(user.uid);
    
    // Weekly Prediction
    document.getElementById('weekly-profit-val').innerText = `$${stats.weeklyProfit}`;
    document.getElementById('weekly-units-val').innerText = stats.weeklyUnits;

    // History List
    const list = document.getElementById('summary-history-list');
    list.innerHTML = '';
    
    if(stats.history.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-400 text-sm">No sales history yet.</div>';
        return;
    }

    stats.history.slice(0, 20).forEach(sale => {
        const el = document.createElement('div');
        el.className = "bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center";
        
        const date = sale.timestamp ? formatDate(sale.timestamp) : 'N/A';
        const time = sale.timestamp ? formatTime(sale.timestamp) : '';
        const isStandard = sale.type === 'standard';
        
        el.innerHTML = `
            <div>
                <div class="font-bold text-sm dark:text-white">
                    ${sale.quantity} Items 
                    <span class="text-xs font-bold uppercase ml-1 ${isStandard ? 'text-green-600 bg-green-100 px-1 rounded' : 'text-orange-600 bg-orange-100 px-1 rounded'}">
                        ${sale.type}
                    </span>
                </div>
                <div class="text-xs text-gray-400">${date} at ${time}</div>
            </div>
            <div class="text-right">
                <div class="text-gray-500 text-xs">Rev: $${sale.grossRevenue}</div>
                <div class="text-green-600 font-bold text-sm">+$${sale.driverProfit}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

// --- CALENDAR LOGIC ---
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
        
        // My Shifts
        const shifts = myShifts.filter(s => s.date === dateStr);
        // Open Cover Requests (from OTHERS)
        const openCovers = cachedCoverRequests.filter(r => r.originalDate === dateStr && r.requesterUid !== user.uid);

        const dayEl = document.createElement('div');
        dayEl.className = "calendar-day bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 min-h-[60px]";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        
        // 1. Render MY Shifts (Blue)
        shifts.forEach(s => {
            const bar = document.createElement('div');
            bar.className = "bg-blue-500 text-white shift-bar cursor-pointer hover:bg-blue-600 mb-1 text-[10px] p-1 rounded";
            bar.innerText = `${s.start}-${s.end}`;
            bar.onclick = () => openCoverModal(s, 'request');
            dayEl.appendChild(bar);
        });

        // 2. Render Available Covers (Red)
        openCovers.forEach(req => {
            const bar = document.createElement('div');
            bar.className = "bg-red-500 text-white shift-bar cursor-pointer hover:bg-red-600 mb-1 text-[10px] p-1 rounded animate-pulse";
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
        // I am requesting cover for MY shift
        modal.dataset.shift = JSON.stringify(data);
        title.innerText = `Shift: ${data.date} (${data.start}-${data.end})`;
        
        reqForm.classList.remove('hidden');
        takeForm.classList.add('hidden');
        
        document.getElementById('cover-start').value = data.start;
        document.getElementById('cover-end').value = data.end;
    } else {
        // I am taking someone else's cover
        modal.dataset.reqId = data.id;
        title.innerText = `Request from ${data.requesterName}: ${data.originalDate}`;
        
        reqForm.classList.add('hidden');
        takeForm.classList.remove('hidden');
    }
}

// --- ORDER LISTENERS (Unchanged from previous step, kept for completeness) ---
function initOrderListeners(user) {
    // Active Order
    subscribeToDriverActiveOrders(user.uid, (orders) => {
        if (orders.length > 0) {
            activeOrder = orders[0];
            const card = document.getElementById('active-delivery-card');
            const incoming = document.getElementById('incoming-section');
            incoming.classList.add('hidden');
            card.classList.remove('hidden');
            
            // Populate Card
            document.getElementById('active-address').innerText = activeOrder.deliveryAddress;
            document.getElementById('active-details').innerText = `${activeOrder.quantity} Items • ${activeOrder.buyerName || 'Cust'}`;
            document.getElementById('active-price').innerText = `$${activeOrder.totalPrice} Cash`;
            
            const btnArrived = document.getElementById('btn-job-arrived');
            const btnComplete = document.getElementById('btn-job-complete');
            if(activeOrder.status === 'arrived') {
                btnArrived.classList.add('hidden');
                btnComplete.classList.remove('hidden');
                document.getElementById('active-status').innerText = "Arrived";
                document.getElementById('active-status').className = "bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold";
            } else {
                btnArrived.classList.remove('hidden');
                btnComplete.classList.add('hidden');
                document.getElementById('active-status').innerText = "On the way";
                document.getElementById('active-status').className = "bg-white/20 px-2 py-1 rounded text-xs font-bold";
            }

        } else {
            activeOrder = null;
            document.getElementById('active-delivery-card').classList.add('hidden');
            document.getElementById('incoming-section').classList.remove('hidden');
        }
    });

    // Incoming Orders
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
                div.innerHTML = `<div><div class="font-bold dark:text-white">${o.deliveryAddress}</div><div class="text-xs text-gray-500">$${o.totalPrice}</div></div><button class="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded btn-accept" data-id="${o.id}">Accept</button>`;
                list.appendChild(div);
            });
            document.querySelectorAll('.btn-accept').forEach(b => b.addEventListener('click', (e) => handleAccept(e.target.dataset.id, user)));
        } else {
            count.classList.add('hidden');
            list.innerHTML = '<div class="text-center text-gray-400 text-sm py-4 italic">No active orders.</div>';
        }
    });
}

async function handleAccept(id, user) {
    if(!currentUserData.vehicle || !currentUserData.vehicle.model) return alert("Set vehicle first!");
    const eta = prompt("ETA?");
    if(eta) await acceptOrder(id, user.uid, user.displayName, `${currentUserData.vehicle.color} ${currentUserData.vehicle.model}`, eta);
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