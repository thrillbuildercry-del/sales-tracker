import { processSale, requestStock, saveVehicleInfo, requestCover } from '../services/driver-service.js';
import { acceptOrder, markArrived, completeOrder, subscribeToPendingOrders, subscribeToDriverActiveOrders } from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase.js';

const appRoot = document.getElementById('app-root');
let calendarDate = new Date();
let currentUserData = null;
let activeOrder = null;

export const renderDriverDashboard = (user) => {
    // 1. Setup Listener for LIVE user data
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
                
                <div id="active-delivery-card" class="hidden bg-blue-600 text-white p-5 rounded-xl shadow-lg animate-fadeIn relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="map-pin" class="w-24 h-24"></i></div>
                    
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-2">
                            <h2 class="font-bold text-lg">Current Job</h2>
                            <span class="bg-white/20 px-2 py-1 rounded text-xs font-bold" id="active-status">On the way</span>
                        </div>
                        
                        <div class="mb-4 space-y-1">
                            <div class="text-2xl font-bold" id="active-address">123 Main St</div>
                            <div class="text-blue-100 text-sm" id="active-details">2 Items • Customer Name</div>
                            <div class="text-yellow-300 font-bold text-lg mt-1" id="active-price">$150 Cash</div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <button id="btn-job-arrived" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition">Arrived</button>
                            <button id="btn-job-complete" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition">Complete</button>
                        </div>
                        <button id="btn-update-eta" class="w-full mt-2 text-xs text-blue-200 hover:text-white underline">Update ETA</button>
                    </div>
                </div>

                <div id="incoming-section">
                    <h2 class="text-gray-500 text-xs uppercase font-bold mb-2 flex justify-between">
                        <span>Incoming Jobs</span>
                        <span id="job-count" class="bg-red-500 text-white px-1.5 rounded-full text-[10px] hidden">0</span>
                    </h2>
                    <div id="incoming-list" class="space-y-2">
                        <div class="text-center text-gray-400 text-sm py-4 italic">No active orders available.</div>
                    </div>
                </div>

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
                    <h2 class="text-gray-500 text-xs uppercase mb-3 font-bold">Manual Sale (Walk-up)</h2>
                    <div class="grid grid-cols-4 gap-2">
                        ${[1,2,3,4].map(n => {
                            const prices = {1:80, 2:150, 3:220, 4:280};
                            return `<button class="sale-btn p-2 border rounded bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:shadow-md transition active:scale-95" data-qty="${n}" data-type="deal"><div class="text-sm font-bold text-orange-600 dark:text-orange-400">${n}</div><div class="text-[10px] dark:text-gray-300">$${prices[n]}</div></button>`
                        }).join('')}
                    </div>
                </div>

                <button id="driver-logout" class="w-full mt-4 text-red-600 text-sm font-semibold p-4">Sign Out</button>
            </main>

            ${renderModals()}
        </div>
    `;

    lucide.createIcons();
    attachEvents(user);
    initOrderListeners(user);
};

// --- ORDER LOGIC ---

function initOrderListeners(user) {
    // 1. Subscribe to MY Active Orders
    subscribeToDriverActiveOrders(user.uid, (orders) => {
        // We only handle one active order at a time for simplicity in UI
        if (orders.length > 0) {
            activeOrder = orders[0];
            renderActiveDelivery(activeOrder);
        } else {
            activeOrder = null;
            document.getElementById('active-delivery-card').classList.add('hidden');
            document.getElementById('incoming-section').classList.remove('hidden');
        }
    });

    // 2. Subscribe to Pending Orders (Marketplace)
    subscribeToPendingOrders((orders) => {
        renderIncomingList(orders, user);
    });
}

function renderActiveDelivery(order) {
    const card = document.getElementById('active-delivery-card');
    const incoming = document.getElementById('incoming-section');
    
    // Hide incoming list while busy
    incoming.classList.add('hidden');
    card.classList.remove('hidden');

    document.getElementById('active-address').innerText = order.deliveryAddress;
    document.getElementById('active-details').innerText = `${order.quantity} Item(s) • ${order.buyerName || 'Customer'}`;
    document.getElementById('active-price').innerText = `$${order.totalPrice} Cash`;
    
    const statusLabel = document.getElementById('active-status');
    const btnArrived = document.getElementById('btn-job-arrived');
    const btnComplete = document.getElementById('btn-job-complete');

    if(order.status === 'arrived') {
        statusLabel.innerText = "Arrived at Location";
        statusLabel.className = "bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold";
        btnArrived.classList.add('hidden');
        btnComplete.classList.remove('hidden');
    } else {
        statusLabel.innerText = "On the way";
        statusLabel.className = "bg-white/20 px-2 py-1 rounded text-xs font-bold";
        btnArrived.classList.remove('hidden');
        btnComplete.classList.add('hidden');
    }
}

function renderIncomingList(orders, user) {
    const list = document.getElementById('incoming-list');
    const countBadge = document.getElementById('job-count');
    
    // Only update if we are not busy (activeOrder is null)
    // If activeOrder exists, this section is hidden anyway via CSS class
    
    list.innerHTML = '';

    if (orders.length > 0) {
        countBadge.innerText = orders.length;
        countBadge.classList.remove('hidden');
        
        orders.forEach(o => {
            const el = document.createElement('div');
            el.className = "bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center animate-fadeIn";
            el.innerHTML = `
                <div>
                    <div class="font-bold dark:text-white">${o.deliveryAddress}</div>
                    <div class="text-xs text-gray-500">${o.quantity} items • <span class="text-green-600 font-bold">$${o.totalPrice}</span></div>
                </div>
                <button class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition btn-accept" data-id="${o.id}">
                    Accept
                </button>
            `;
            list.appendChild(el);
        });

        // Attach Accept Listeners
        document.querySelectorAll('.btn-accept').forEach(btn => {
            btn.addEventListener('click', (e) => handleAcceptClick(e.target.dataset.id, user));
        });

    } else {
        countBadge.classList.add('hidden');
        list.innerHTML = '<div class="text-center text-gray-400 text-sm py-4 italic">No active orders available.</div>';
    }
}

async function handleAcceptClick(orderId, user) {
    // 1. Check Vehicle
    if (!currentUserData.vehicle || !currentUserData.vehicle.model) {
        alert("Please set your Vehicle details in Settings before accepting jobs.");
        document.getElementById('settings-modal').classList.remove('hidden');
        return;
    }

    // 2. Check Status
    if (currentUserData.onlineStatus !== 'online') {
        if(!confirm("You are currently Offline. Go Online and accept this job?")) return;
        await updateDoc(doc(db, "users", user.uid), { onlineStatus: 'online' });
    }

    // 3. Prompt ETA
    const eta = prompt("Enter ETA (e.g. '15 mins'):");
    if (!eta) return;

    // 4. Accept
    const vehicleString = `${currentUserData.vehicle.color} ${currentUserData.vehicle.model}`;
    await acceptOrder(orderId, user.uid, user.displayName, vehicleString, eta);
    showToast("Job Accepted!");
}

// --- STANDARD UI FUNCTIONS ---

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

    // Active Job Actions
    document.getElementById('btn-job-arrived').addEventListener('click', async () => {
        if(activeOrder && confirm("Confirm arrival at location?")) await markArrived(activeOrder.id);
    });

    document.getElementById('btn-job-complete').addEventListener('click', async () => {
        if(activeOrder && confirm(`Complete job? Collect $${activeOrder.totalPrice}`)) {
            // Record Sale first
            await processSale(user.uid, activeOrder.quantity, true); // true = deal price logic
            // Then close order
            await completeOrder(activeOrder.id);
            showToast(`Job Completed! +$${activeOrder.totalPrice}`);
        }
    });

    document.getElementById('btn-update-eta').addEventListener('click', async () => {
        if(!activeOrder) return;
        const eta = prompt("Update ETA to:");
        if(eta) {
            // We need a specific update function or just generic updateDoc
            const orderRef = doc(db, 'orders', activeOrder.id);
            await updateDoc(orderRef, { eta: eta });
            showToast("ETA Updated");
        }
    });

    // Stock Request
    document.getElementById('btn-req-stock').addEventListener('click', async () => {
        if(confirm("Notify Admin you need stock?")) {
            await requestStock(user.uid, user.displayName);
            showToast("Request Sent");
        }
    });

    // Manual Sales (Walk-ups)
    document.querySelectorAll('.sale-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            const qty = parseInt(target.dataset.qty);
            if(confirm(`Sell ${qty} item(s) (Walk-up)?`)) {
                const res = await processSale(user.uid, qty, true);
                if(res.success) showToast(`Sold! Profit: $${res.metrics.driverProfit}`);
                else alert(res.error);
            }
        });
    });

    // Settings & Schedule
    setupModalEvents(user);
}

function setupModalEvents(user) {
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

    document.getElementById('btn-open-schedule').addEventListener('click', () => {
        document.getElementById('schedule-modal').classList.remove('hidden');
        renderDriverCalendar(user);
    });

    // Calendar Navigation
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

function renderModals() {
    return `
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
    </div>`;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 3000);
}