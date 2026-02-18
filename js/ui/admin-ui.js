import { 
    subscribeToDrivers, subscribeToStockRequests, addStockToDriver, 
    p2pTransfer, adminCollectAssets, assignShift, deleteShift, 
    resolveStockRequest, dismissStockRequest 
} from '../services/admin-service.js';
import { subscribeToPendingOrders } from '../services/order-service.js';
import { getWeeklyReport } from '../services/report-service.js';
import { getDriverStats } from '../services/driver-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { formatDate, formatTime } from '../utils/formatters.js';

const appRoot = document.getElementById('app-root');
let cachedDrivers = [];
let calendarDate = new Date();

export const renderAdminDashboard = (currentUser) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-200">
            <header class="bg-gray-900 text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center">
                <div><h1 class="text-xl font-bold tracking-tight text-blue-400">BOSS DASHBOARD</h1></div>
                <div class="flex items-center gap-3">
                    <button onclick="window.toggleTheme()" class="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300"><i data-lucide="moon" class="w-5 h-5"></i></button>
                    <button id="admin-logout" class="text-xs bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded font-bold transition">Logout</button>
                </div>
            </header>

            <main class="p-4 max-w-4xl mx-auto">
                <div id="admin-notifications" class="space-y-2 mb-4"></div>

                <div class="flex space-x-1 mb-6 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm overflow-x-auto hide-scrollbar">
                    <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition" data-target="team">Team</button>
                    <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition" data-target="orders">Orders</button>
                    <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition" data-target="manage">Manage</button>
                    <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition" data-target="schedule">Schedule</button>
                    <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition" data-target="reports">Reports</button>
                </div>

                <div id="view-team" class="tab-content active space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                         <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Total Items (7d)</div>
                            <div class="text-2xl font-bold text-blue-600" id="stat-total-items">--</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Revenue (7d)</div>
                            <div class="text-2xl font-bold text-green-600" id="stat-total-rev">--</div>
                        </div>
                    </div>
                    <div id="driver-list" class="space-y-3">Loading Team...</div>
                </div>

                <div id="view-orders" class="tab-content hidden">
                    <h3 class="font-bold text-gray-800 dark:text-white mb-4">Live Orders</h3>
                    <div id="pending-orders-list" class="space-y-3"></div>
                </div>

                <div id="view-manage" class="tab-content hidden space-y-6">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center"><i data-lucide="package-plus" class="w-4 h-4 mr-2"></i> Add Stock</h3>
                        <div class="flex gap-2">
                            <select id="restock-driver" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"></select>
                            <input type="number" id="restock-qty" placeholder="Qty" class="w-20 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                        </div>
                        <button id="btn-admin-restock" class="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition">Add Stock</button>
                    </div>

                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center"><i data-lucide="arrow-right-left" class="w-4 h-4 mr-2"></i> Transfers & Collection</h3>
                        
                        <div class="mb-4 pb-4 border-b dark:border-gray-600">
                            <div class="flex items-center gap-2 mb-2">
                                <select id="trans-from" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"><option>From...</option></select>
                                <i data-lucide="arrow-right" class="w-4 h-4 text-gray-400"></i>
                                <select id="trans-to" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"><option>To...</option></select>
                            </div>
                            <div class="flex gap-2 mb-2">
                                <input type="number" id="trans-qty" placeholder="Items" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                                <input type="number" id="trans-debt" placeholder="Debt $" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                            </div>
                            <button id="btn-admin-transfer" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition">Transfer</button>
                        </div>

                        <div>
                            <div class="mb-2">
                                <label class="text-[10px] text-gray-500 font-bold uppercase">Collect from Driver</label>
                                <select id="collect-driver" class="w-full bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"></select>
                            </div>
                            <div class="flex gap-2">
                                <input type="number" id="collect-qty" placeholder="Return Stock" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white text-blue-600 font-bold">
                                <input type="number" id="collect-debt" placeholder="Collect Cash $" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white text-green-600 font-bold">
                            </div>
                            <button id="btn-admin-collect" class="mt-3 w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition">Process Collection</button>
                        </div>
                    </div>
                </div>

                <div id="view-schedule" class="tab-content hidden">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 mb-6">
                        <h3 class="font-bold dark:text-white mb-3">Assign Shift</h3>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <select id="sched-driver" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-white driver-select"></select>
                            <input type="date" id="sched-date" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-white">
                        </div>
                        <div class="grid grid-cols-2 gap-2 mb-3">
                            <input type="time" id="sched-start" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-white">
                            <input type="time" id="sched-end" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-white">
                        </div>
                        <button id="btn-assign-shift" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition">Assign</button>
                    </div>
                    <div id="admin-calendar" class="calendar-grid bg-white dark:bg-gray-800 rounded border dark:border-gray-700 p-1"></div>
                    <div id="cal-details" class="mt-2 bg-white dark:bg-gray-800 p-3 rounded shadow-sm text-sm hidden"></div>
                </div>

                <div id="view-reports" class="tab-content hidden">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 h-64">
                         <canvas id="chart-daily"></canvas>
                    </div>
                </div>
            </main>

            <div id="driver-detail-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-lg p-6 rounded-2xl h-[80vh] flex flex-col shadow-2xl">
                    <div class="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                        <h2 class="text-xl font-bold dark:text-white" id="detail-name">Driver History</h2>
                        <button id="btn-close-detail" class="text-gray-400 hover:text-white"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                            <div class="text-[10px] uppercase text-gray-500 font-bold">Sold (Week)</div>
                            <div class="font-bold dark:text-white text-lg" id="detail-week-sold">0</div>
                        </div>
                        <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                            <div class="text-[10px] uppercase text-gray-500 font-bold">Profit (Week)</div>
                            <div class="font-bold text-green-500 text-lg" id="detail-week-profit">$0</div>
                        </div>
                    </div>

                    <div id="detail-history-list" class="flex-1 overflow-y-auto space-y-2 pr-2"></div>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    setupTabs();
    setupCalendar();
    
    // --- LISTENERS ---
    document.getElementById('admin-logout').addEventListener('click', () => logoutUser());
    document.getElementById('btn-close-detail').addEventListener('click', () => document.getElementById('driver-detail-modal').classList.add('hidden'));

    subscribeToDrivers((drivers) => {
        cachedDrivers = drivers;
        renderDriverList(drivers);
        populateDropdowns();
        renderCalendarGrid();
        loadReportData();
    });

    subscribeToStockRequests(renderStockRequests);
    subscribeToPendingOrders(renderPendingOrders);
    
    // --- ACTIONS ---
    document.getElementById('btn-admin-restock').addEventListener('click', async () => {
        const uid = document.getElementById('restock-driver').value;
        const qty = document.getElementById('restock-qty').value;
        if(uid && qty) {
            await addStockToDriver(currentUser.uid, uid, qty);
            showToast("Stock Added");
            document.getElementById('restock-qty').value = '';
        }
    });

    document.getElementById('btn-admin-transfer').addEventListener('click', async () => {
        const f = document.getElementById('trans-from').value;
        const t = document.getElementById('trans-to').value;
        const q = document.getElementById('trans-qty').value;
        const d = document.getElementById('trans-debt').value;
        if(f && t && (q || d)) {
            await p2pTransfer(f, t, q, d);
            showToast("Transferred");
        }
    });

    document.getElementById('btn-admin-collect').addEventListener('click', async () => {
        const uid = document.getElementById('collect-driver').value;
        const s = document.getElementById('collect-qty').value;
        const d = document.getElementById('collect-debt').value;
        if(uid && (s || d)) {
            if(confirm("Confirm Collection?")) {
                await adminCollectAssets(uid, s, d);
                showToast("Collected");
            }
        }
    });

    document.getElementById('btn-assign-shift').addEventListener('click', async () => {
        const uid = document.getElementById('sched-driver').value;
        const date = document.getElementById('sched-date').value;
        const start = document.getElementById('sched-start').value;
        const end = document.getElementById('sched-end').value;
        if(uid && date) await assignShift(uid, {date, start, end});
    });
};

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    // Set default (Team)
    tabs[0].classList.add('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700'); 

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            tabs.forEach(t => t.classList.remove('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700'));
            contents.forEach(c => c.classList.add('hidden'));
            
            // Activate selected
            tab.classList.add('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700');
            const targetId = `view-${tab.dataset.target}`;
            const target = document.getElementById(targetId);
            if(target) target.classList.remove('hidden');
        });
    });
}

function renderDriverList(drivers) {
    const list = document.getElementById('driver-list');
    list.innerHTML = '';
    
    drivers.forEach(d => {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-blue-600 bg-blue-100">${d.displayName[0]}</div>
                <div>
                    <div class="font-bold dark:text-white">${d.displayName}</div>
                    <div class="text-xs text-gray-500">Stock: ${d.currentStock || 0} • Debt: $${d.currentDebt || 0}</div>
                </div>
            </div>
            <div class="text-xs text-gray-400">View History ></div>
        `;
        card.addEventListener('click', () => showDriverHistory(d.id, d.displayName));
        list.appendChild(card);
    });
}

async function showDriverHistory(uid, name) {
    const modal = document.getElementById('driver-detail-modal');
    const list = document.getElementById('detail-history-list');
    document.getElementById('detail-name').innerText = `${name} - History`;
    modal.classList.remove('hidden');
    list.innerHTML = '<div class="text-center p-4">Loading...</div>';

    const stats = await getDriverStats(uid);
    // Update summary stats in modal
    document.getElementById('detail-week-sold').innerText = stats.weeklyUnits;
    document.getElementById('detail-week-profit').innerText = `$${stats.weeklyProfit}`;

    list.innerHTML = '';
    stats.history.slice(0,50).forEach(sale => {
        const isStd = sale.type === 'standard';
        const color = isStd ? 'text-green-600 bg-green-100' : 'text-orange-600 bg-orange-100';
        const el = document.createElement('div');
        el.className = "p-3 border-b dark:border-gray-700 flex justify-between items-center";
        el.innerHTML = `
            <div>
                <span class="font-bold dark:text-white">${sale.quantity} Items</span>
                <span class="text-[10px] px-1 rounded ml-1 uppercase ${color}">${sale.type || 'standard'}</span>
                <div class="text-xs text-gray-400">${formatDate(sale.timestamp)} ${formatTime(sale.timestamp)}</div>
            </div>
            <div class="text-green-600 font-bold">+$${sale.driverProfit}</div>
        `;
        list.appendChild(el);
    });
}

function renderPendingOrders(orders) {
    const list = document.getElementById('pending-orders-list');
    list.innerHTML = '';
    if(orders.length === 0) return list.innerHTML = '<div class="text-center text-gray-400">No active orders</div>';
    orders.forEach(o => {
        const el = document.createElement('div');
        el.className = "bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 flex justify-between items-center";
        el.innerHTML = `<div><div class="font-bold dark:text-white">${o.deliveryAddress}</div><div class="text-xs text-gray-500">${o.quantity} items</div></div><div class="font-bold text-green-600">$${o.totalPrice}</div>`;
        list.appendChild(el);
    });
}

function renderStockRequests(reqs) {
    const container = document.getElementById('admin-notifications');
    container.innerHTML = '';
    reqs.forEach(req => {
        const div = document.createElement('div');
        div.className = "bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800 flex justify-between items-center";
        div.innerHTML = `<div class="text-sm dark:text-white"><span class="font-bold">${req.requesterName}</span> needs stock</div><div class="space-x-2"><button class="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold btn-fulfill" data-id="${req.id}" data-uid="${req.requesterUid}">Fulfill</button><button class="text-gray-400 text-xs btn-dismiss" data-id="${req.id}">Dismiss</button></div>`;
        container.appendChild(div);
    });
    container.querySelectorAll('.btn-fulfill').forEach(b => b.addEventListener('click', async (e) => {
        document.querySelector('[data-target="manage"]').click();
        document.getElementById('restock-driver').value = e.target.dataset.uid;
        await resolveStockRequest(e.target.dataset.id);
    }));
    container.querySelectorAll('.btn-dismiss').forEach(b => b.addEventListener('click', async (e) => await dismissStockRequest(e.target.dataset.id)));
}

function populateDropdowns() {
    const selects = document.querySelectorAll('.driver-select');
    selects.forEach(sel => {
        sel.innerHTML = '<option value="">Select Driver...</option>';
        cachedDrivers.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id; opt.text = d.displayName;
            sel.appendChild(opt);
        });
    });
}

function setupCalendar(){ document.getElementById('cal-prev').onclick = ()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendarGrid()}; document.getElementById('cal-next').onclick = ()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendarGrid()}; }
function renderCalendarGrid() {
    const grid = document.getElementById('admin-calendar');
    const label = document.getElementById('cal-month');
    grid.innerHTML = '';
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    label.innerText = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for(let i=0; i<startDay; i++) grid.innerHTML += `<div></div>`;
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let dayShifts = [];
        cachedDrivers.forEach(drv => { (drv.shifts || []).forEach(s => { if(s.date === dateStr) dayShifts.push({ ...s, name: drv.displayName, uid: drv.id }); }); });
        const dayEl = document.createElement('div');
        dayEl.className = "calendar-day bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        dayShifts.forEach(s => { dayEl.innerHTML += `<div class="bg-purple-500 text-white shift-bar truncate">${s.name}: ${s.start}-${s.end}</div>`; });
        dayEl.addEventListener('click', () => {
            const det = document.getElementById('cal-details'); det.classList.remove('hidden');
            det.innerHTML = `<h4 class="font-bold border-b dark:border-gray-700 mb-2 pb-1 dark:text-white">${dateStr}</h4>`;
            if(dayShifts.length === 0) det.innerHTML += '<p class="text-gray-400">No shifts.</p>';
            dayShifts.forEach(s => {
                const row = document.createElement('div');
                row.className = "flex justify-between items-center text-xs mb-1 dark:text-gray-300";
                row.innerHTML = `<span>${s.name} (${s.start}-${s.end})</span>`;
                const delBtn = document.createElement('button');
                delBtn.className = "text-red-500 hover:text-red-700 ml-2";
                delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3 h-3"></i>';
                delBtn.onclick = async () => { if(confirm("Delete shift?")) await deleteShift(s.uid, s.date, s.start); };
                row.appendChild(delBtn); det.appendChild(row);
            });
            lucide.createIcons();
        });
        grid.appendChild(dayEl);
    }
}

async function loadReportData() {
    const data = await getWeeklyReport();
    document.getElementById('stat-total-items').innerText = data.totalItems;
    document.getElementById('stat-total-rev').innerText = `$${data.totalRevenue}`;
    const ctx = document.getElementById('chart-daily');
    if(ctx && window.Chart) {
         new Chart(ctx, {
            type: 'line',
            data: { labels: Object.keys(data.dailyRevenue), datasets: [{ label: 'Revenue', data: Object.values(data.dailyRevenue), borderColor: '#2563eb', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('opacity-0');
    setTimeout(() => t.classList.add('opacity-0'), 3000);
}