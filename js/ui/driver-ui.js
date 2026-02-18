import { 
    processSale, requestStock, saveVehicleInfo, requestCover, 
    subscribeToAllCoverRequests, acceptCoverRequest, getDriverStats 
} from '../services/driver-service.js';
import { subscribeToPendingOrders, subscribeToDriverActiveOrders, markArrived, completeOrder, acceptOrder } from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase.js';
import { formatDate, formatTime } from '../utils/formatters.js';

const appRoot = document.getElementById('app-root');
let currentUserData = null;
let cachedCoverRequests = [];
let calendarDate = new Date();

export const renderDriverDashboard = (user) => {
    onSnapshot(doc(db, "users", user.uid), (snap) => {
        currentUserData = snap.data();
        updateDashboardUI(currentUserData);
    });
    subscribeToAllCoverRequests(reqs => { cachedCoverRequests = reqs; if(document.getElementById('drv-calendar')) renderDriverCalendar(user); });

    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-100 dark:bg-gray-900 pb-24 transition-colors duration-200">
            <header class="bg-blue-600 dark:bg-gray-800 text-white p-4 sticky top-0 z-40 shadow-md flex justify-between items-center">
                <h1 class="font-bold text-lg">Driver Portal</h1>
                <div class="flex gap-2">
                    <button id="btn-status-toggle" class="flex items-center bg-black/20 px-3 py-1 rounded-full text-xs transition"><div id="status-dot" class="w-2 h-2 rounded-full bg-gray-400 mr-2"></div><span id="status-text">Offline</span></button>
                    <button id="btn-settings" class="p-2 bg-blue-700 dark:bg-gray-700 rounded-full"><i data-lucide="settings" class="w-5 h-5"></i></button>
                </div>
            </header>

            <nav class="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-2 z-50 flex justify-around shadow-lg">
                <button class="nav-btn text-blue-600" data-target="dashboard"><i data-lucide="layout-dashboard" class="w-6 h-6 mx-auto"></i><span class="text-[10px]">Home</span></button>
                <button class="nav-btn text-gray-400" data-target="schedule"><i data-lucide="calendar" class="w-6 h-6 mx-auto"></i><span class="text-[10px]">Schedule</span></button>
                <button class="nav-btn text-gray-400" data-target="summary"><i data-lucide="bar-chart-2" class="w-6 h-6 mx-auto"></i><span class="text-[10px]">Summary</span></button>
            </nav>

            <main class="p-4 max-w-md mx-auto space-y-4 mb-16">
                <div id="view-dashboard" class="view-section">
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 class="text-gray-500 text-xs uppercase">Stock</h2>
                            <div class="text-3xl font-bold dark:text-white" id="display-stock">--</div>
                            <button id="btn-req-stock" class="text-xs text-blue-600 mt-1 font-bold">+ Request</button>
                        </div>
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h2 class="text-gray-500 text-xs uppercase">Debt</h2>
                            <div class="text-3xl font-bold text-red-500" id="display-debt">$0</div>
                        </div>
                    </div>

                    <div id="active-delivery-card" class="hidden bg-blue-600 text-white p-5 rounded-xl shadow-lg mb-4">
                        <h2 class="font-bold text-lg mb-2">Current Job</h2>
                        <div class="mb-4">
                            <div class="text-2xl font-bold" id="active-address"></div>
                            <div class="text-blue-100 text-sm" id="active-details"></div>
                            <div class="text-yellow-300 font-bold text-lg mt-1" id="active-price"></div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button id="btn-job-arrived" class="bg-yellow-500 text-white font-bold py-2 rounded-lg">Arrived</button>
                            <button id="btn-job-complete" class="bg-green-500 text-white font-bold py-2 rounded-lg hidden">Complete</button>
                        </div>
                    </div>

                    <div id="incoming-list" class="space-y-2 mb-4"></div>

                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
                        <h2 class="text-gray-500 text-xs uppercase mb-3 font-bold">Manual Sales</h2>
                        <div class="mb-4">
                            <span class="text-[10px] text-green-600 uppercase font-bold mb-1">Standard ($80/ea)</span>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => `<button class="sale-btn p-2 border rounded bg-green-50 dark:bg-green-900/20 border-green-200 hover:shadow-md" data-qty="${n}" data-type="standard"><div class="text-sm font-bold text-green-700">${n}</div><div class="text-[10px] text-gray-500">$${n*80}</div></button>`).join('')}
                            </div>
                        </div>
                        <div>
                            <span class="text-[10px] text-orange-600 uppercase font-bold mb-1">Deal Price</span>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => `<button class="sale-btn p-2 border rounded bg-orange-50 dark:bg-orange-900/20 border-orange-200 hover:shadow-md" data-qty="${n}" data-type="deal"><div class="text-sm font-bold text-orange-600">${n}</div><div class="text-[10px] text-gray-500">$${{1:80,2:150,3:220,4:280}[n]}</div></button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div id="view-schedule" class="view-section hidden">
                    <div id="drv-calendar" class="calendar-grid bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm mb-4"></div>
                </div>

                <div id="view-summary" class="view-section hidden">
                    <div class="bg-green-600 text-white p-5 rounded-xl shadow-lg mb-6">
                        <h2 class="text-green-100 text-xs uppercase font-bold">Weekly Profit</h2>
                        <div class="text-4xl font-bold" id="weekly-profit-val">$0</div>
                        <div class="text-sm opacity-80"><span id="weekly-units-val">0</span> Units Sold</div>
                    </div>
                    <div id="summary-history-list" class="space-y-3"></div>
                </div>
            </main>

            <div id="settings-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl">
                    <h2 class="font-bold dark:text-white mb-4">Settings</h2>
                    <input id="veh-color" placeholder="Color" class="w-full mb-2 p-2 border rounded dark:bg-gray-700 dark:text-white">
                    <input id="veh-model" placeholder="Model" class="w-full mb-4 p-2 border rounded dark:bg-gray-700 dark:text-white">
                    <button id="btn-save-veh" class="w-full bg-blue-600 text-white py-2 rounded mb-2">Save</button>
                    <button onclick="window.toggleTheme()" class="w-full border py-2 rounded dark:text-white mb-2">Toggle Dark Mode</button>
                    <button id="driver-logout" class="w-full text-red-500 py-2">Sign Out</button>
                    <button onclick="document.getElementById('settings-modal').classList.add('hidden')" class="w-full text-gray-400 mt-2">Close</button>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
    attachEvents(user);
    initOrderListeners(user); 
    loadSummaryData(user);
};

function attachEvents(user) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${target}`).classList.remove('hidden');
            if(target === 'schedule') renderDriverCalendar(user);
            if(target === 'summary') loadSummaryData(user);
        });
    });

    document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.target.closest('button');
            const qty = parseInt(btnEl.dataset.qty);
            const type = btnEl.dataset.type;
            if(confirm(`Confirm ${type} sale of ${qty} items?`)) {
                await processSale(user.uid, qty, type);
                alert("Sold!");
            }
        });
    });

    document.getElementById('btn-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('hidden'));
    document.getElementById('driver-logout').addEventListener('click', logoutUser);
    document.getElementById('btn-save-veh').addEventListener('click', async () => {
        await saveVehicleInfo(user.uid, { color: document.getElementById('veh-color').value, model: document.getElementById('veh-model').value });
        alert("Saved");
        document.getElementById('settings-modal').classList.add('hidden');
    });
}

function initOrderListeners(user) {
    subscribeToDriverActiveOrders(user.uid, orders => {
        const card = document.getElementById('active-delivery-card');
        if (orders.length > 0) {
            const o = orders[0];
            card.classList.remove('hidden');
            document.getElementById('active-address').innerText = o.deliveryAddress;
            document.getElementById('active-details').innerText = `${o.quantity} Items`;
            document.getElementById('active-price').innerText = `$${o.totalPrice}`;
            
            const btnArrived = document.getElementById('btn-job-arrived');
            const btnComplete = document.getElementById('btn-job-complete');
            if(o.status === 'arrived') {
                btnArrived.classList.add('hidden');
                btnComplete.classList.remove('hidden');
            } else {
                btnArrived.classList.remove('hidden');
                btnComplete.classList.add('hidden');
            }
            btnArrived.onclick = async () => { if(confirm("Arrived?")) await markArrived(o.id); };
            btnComplete.onclick = async () => { if(confirm("Complete?")) { await processSale(user.uid, o.quantity, 'deal'); await completeOrder(o.id); } };
        } else {
            card.classList.add('hidden');
        }
    });

    subscribeToPendingOrders(orders => {
        const list = document.getElementById('incoming-list');
        list.innerHTML = '';
        orders.forEach(o => {
            const div = document.createElement('div');
            div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow flex justify-between items-center";
            div.innerHTML = `<div><div class="font-bold dark:text-white">${o.deliveryAddress}</div><div class="text-xs text-gray-500">${o.quantity} items</div></div><button class="bg-blue-600 text-white text-xs px-3 py-1 rounded btn-accept" data-id="${o.id}">Accept</button>`;
            list.appendChild(div);
        });
        document.querySelectorAll('.btn-accept').forEach(b => b.onclick = async (e) => {
            const eta = prompt("ETA?");
            if(eta) await acceptOrder(e.target.dataset.id, user.uid, user.displayName, "Vehicle", eta);
        });
    });
}

async function loadSummaryData(user) {
    const stats = await getDriverStats(user.uid);
    document.getElementById('weekly-profit-val').innerText = `$${stats.weeklyProfit}`;
    document.getElementById('weekly-units-val').innerText = stats.weeklyUnits;
    const list = document.getElementById('summary-history-list');
    list.innerHTML = '';
    stats.history.slice(0,30).forEach(sale => {
        const div = document.createElement('div');
        div.className = "bg-white dark:bg-gray-800 p-3 rounded shadow flex justify-between items-center";
        const color = sale.type === 'standard' ? 'text-green-600' : 'text-orange-600';
        div.innerHTML = `<div><span class="font-bold dark:text-white">${sale.quantity} items</span> <span class="text-xs ${color} uppercase font-bold">${sale.type}</span></div><div class="text-green-600 font-bold">+$${sale.driverProfit}</div>`;
        list.appendChild(div);
    });
}

function renderDriverCalendar(user) {
    const grid = document.getElementById('drv-calendar');
    const label = document.getElementById('drv-cal-month');
    
    // Safety check if element exists (e.g. if tab not active)
    if (!grid || !label) return;

    grid.innerHTML = '';
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    label.innerText = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells for start of month
    for(let i=0; i<startDay; i++) grid.innerHTML += `<div></div>`;

    const myShifts = currentUserData.shifts || [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // 1. My Shifts for this day
        const shifts = myShifts.filter(s => s.date === dateStr);
        
        // 2. Open Cover Requests (from OTHERS) for this day
        const openCovers = cachedCoverRequests.filter(r => r.originalDate === dateStr && r.requesterUid !== user.uid);

        const dayEl = document.createElement('div');
        dayEl.className = "bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 min-h-[50px] overflow-hidden";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        
        // Render My Shifts (Blue)
        shifts.forEach(s => {
            const bar = document.createElement('div');
            bar.className = "bg-blue-500 text-white cursor-pointer hover:bg-blue-600 mb-1 text-[10px] p-1 rounded truncate shadow-sm";
            bar.innerText = `${s.start}-${s.end}`;
            // Clicking my shift opens "Request Cover" modal
            bar.onclick = (e) => {
                e.stopPropagation();
                openCoverModal(s, 'request');
            };
            dayEl.appendChild(bar);
        });

        // Render Available Covers (Red)
        openCovers.forEach(req => {
            const bar = document.createElement('div');
            bar.className = "bg-red-500 text-white cursor-pointer hover:bg-red-600 mb-1 text-[10px] p-1 rounded animate-pulse truncate shadow-sm";
            bar.innerText = `COVER: ${req.coverStart}-${req.coverEnd}`;
            // Clicking open cover opens "Accept Shift" modal
            bar.onclick = (e) => {
                e.stopPropagation();
                openCoverModal(req, 'take');
            };
            dayEl.appendChild(bar);
        });

        grid.appendChild(dayEl);
    }
}

function openCoverModal(data, type) {
    const modal = document.getElementById('cover-modal');
    const infoText = document.getElementById('cover-shift-info');
    const reqForm = document.getElementById('cover-form-group');
    const takeForm = document.getElementById('take-shift-group');

    modal.classList.remove('hidden');
    
    // Reset dataset
    modal.dataset.shift = '';
    modal.dataset.reqId = '';

    if (type === 'request') {
        // Driver wants to request cover for THEIR shift
        modal.dataset.shift = JSON.stringify(data);
        infoText.innerText = `Shift: ${data.date} (${data.start}-${data.end})`;
        
        reqForm.classList.remove('hidden');
        takeForm.classList.add('hidden');
        
        document.getElementById('cover-start').value = data.start;
        document.getElementById('cover-end').value = data.end;
    } else {
        // Driver wants to TAKE someone else's shift
        modal.dataset.reqId = data.id;
        infoText.innerText = `Request from ${data.requesterName} on ${data.originalDate} (${data.coverStart}-${data.coverEnd})`;
        
        reqForm.classList.add('hidden');
        takeForm.classList.remove('hidden');
    }
}

function updateDashboardUI(data) {
    if(!data) return;
    
    // Update Stock/Debt
    const stockEl = document.getElementById('display-stock');
    const debtEl = document.getElementById('display-debt');
    if(stockEl) stockEl.innerText = data.currentStock || 0;
    if(debtEl) debtEl.innerText = `$${data.currentDebt || 0}`;
    
    // Update Vehicle Settings Inputs
    if(data.vehicle) {
        const vColor = document.getElementById('veh-color');
        const vModel = document.getElementById('veh-model');
        if(vColor) vColor.value = data.vehicle.color || '';
        if(vModel) vModel.value = data.vehicle.model || '';
    }

    // Update Online Status Dot
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
    if(!t) return;
    
    t.innerText = msg;
    t.classList.remove('opacity-0', 'pointer-events-none');
    
    // Hide after 3 seconds
    setTimeout(() => {
        t.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
}