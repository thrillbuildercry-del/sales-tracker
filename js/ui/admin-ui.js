import { subscribeToDrivers, subscribeToStockRequests, subscribeToCoverRequests, addStockToDriver, p2pTransfer, assignShift, deleteShift, resolveStockRequest, dismissStockRequest, updateUserStatus } from '../services/admin-service.js';
import { subscribeToPendingOrders } from '../services/order-service.js';
import { getWeeklyReport } from '../services/report-service.js';
import { logoutUser } from '../services/auth-manager.js';

const appRoot = document.getElementById('app-root');
let cachedDrivers = [];
let calendarDate = new Date();

export const renderAdminDashboard = (currentUser) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-200">
            <header class="bg-gray-900 text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center">
                <div>
                    <h1 class="text-xl font-bold tracking-tight text-blue-400">BOSS DASHBOARD</h1>
                    <p class="text-xs text-gray-400">${new Date().toDateString()}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.toggleTheme()" class="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300"><i data-lucide="moon" class="w-5 h-5"></i></button>
                    <button id="admin-logout" class="text-xs bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded font-bold transition">Logout</button>
                </div>
            </header>

            <main class="p-4 max-w-4xl mx-auto">
                <div id="admin-notifications" class="space-y-2 mb-4"></div>

                <div class="flex space-x-1 mb-6 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm overflow-x-auto hide-scrollbar">
                    ${['Team', 'Orders', 'Manage', 'Schedule', 'Reports'].map(tab => `
                        <button class="nav-tab flex-1 py-2 px-4 rounded-lg font-bold text-xs whitespace-nowrap transition hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300" data-target="${tab.toLowerCase()}">${tab}</button>
                    `).join('')}
                </div>

                <div id="view-team" class="tab-content active space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                         <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Total Items Sold (7d)</div>
                            <div class="text-2xl font-bold text-blue-600" id="stat-total-items">--</div>
                        </div>
                        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div class="text-xs text-gray-500 uppercase">Revenue (7d)</div>
                            <div class="text-2xl font-bold text-green-600" id="stat-total-rev">--</div>
                        </div>
                    </div>
                    <div id="driver-list" class="space-y-3">Loading Team...</div>
                </div>

                <div id="view-orders" class="tab-content">
                    <h3 class="font-bold text-gray-800 dark:text-white mb-4">Live Orders</h3>
                    <div id="pending-orders-list" class="space-y-3"></div>
                </div>

                <div id="view-manage" class="tab-content space-y-6">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center"><i data-lucide="package-plus" class="w-4 h-4 mr-2"></i> Add Stock</h3>
                        <div class="flex gap-2">
                            <select id="restock-driver" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"></select>
                            <input type="number" id="restock-qty" placeholder="Qty" class="w-20 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                        </div>
                        <button id="btn-admin-restock" class="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition">Add Stock</button>
                    </div>

                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border dark:border-gray-700">
                        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center"><i data-lucide="arrow-right-left" class="w-4 h-4 mr-2"></i> Transfer Assets</h3>
                        <div class="flex items-center gap-2 mb-2">
                            <select id="trans-from" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"></select>
                            <i data-lucide="arrow-right" class="w-4 h-4 text-gray-400"></i>
                            <select id="trans-to" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white driver-select"></select>
                        </div>
                        <div class="flex gap-2">
                            <input type="number" id="trans-qty" placeholder="Items" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                            <input type="number" id="trans-debt" placeholder="Debt $" class="flex-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2 text-sm dark:text-white">
                        </div>
                        <button id="btn-admin-transfer" class="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg transition">Transfer</button>
                    </div>
                </div>

                <div id="view-schedule" class="tab-content">
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
                    
                    <div class="flex justify-between items-center mb-2">
                        <button id="cal-prev" class="p-1 bg-gray-200 dark:bg-gray-700 rounded"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                        <span id="cal-month" class="font-bold text-sm dark:text-white">Month</span>
                        <button id="cal-next" class="p-1 bg-gray-200 dark:bg-gray-700 rounded"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                    </div>
                    <div id="admin-calendar" class="calendar-grid bg-white dark:bg-gray-800 rounded border dark:border-gray-700 p-1"></div>
                    <div id="cal-details" class="mt-2 bg-white dark:bg-gray-800 p-3 rounded shadow-sm text-sm hidden"></div>
                </div>

                <div id="view-reports" class="tab-content">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 h-64">
                         <canvas id="chart-daily"></canvas>
                    </div>
                </div>
            </main>
        </div>
    `;
    
    // Initial Render Actions
    lucide.createIcons();
    setupTabs();
    setupCalendar();
    
    // Listeners
    document.getElementById('admin-logout').addEventListener('click', () => logoutUser());

    subscribeToDrivers((drivers) => {
        cachedDrivers = drivers;
        renderDriverList(drivers);
        populateDropdowns();
        renderCalendarGrid(); // Refresh calendar with new shift data
        loadReportData();
    });

    subscribeToStockRequests(renderStockRequests);
    
    // Button Bindings
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
        const q = parseInt(document.getElementById('trans-qty').value) || 0;
        const d = parseInt(document.getElementById('trans-debt').value) || 0;
        if(f && t && (q>0 || d>0)) {
            await p2pTransfer(f, t, q, d);
            showToast("Transfer Complete");
            document.getElementById('trans-qty').value = '';
            document.getElementById('trans-debt').value = '';
        }
    });

    document.getElementById('btn-assign-shift').addEventListener('click', async () => {
        const uid = document.getElementById('sched-driver').value;
        const date = document.getElementById('sched-date').value;
        const start = document.getElementById('sched-start').value;
        const end = document.getElementById('sched-end').value;
        if(uid && date && start && end) {
            await assignShift(uid, { date, start, end });
            showToast("Shift Assigned");
        }
    });
};

// --- RENDER HELPERS ---

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs[0].classList.add('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700'); // Active state for first tab

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Reset
            tabs.forEach(t => t.classList.remove('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Activate
            tab.classList.add('bg-gray-100', 'text-blue-600', 'dark:bg-gray-700');
            document.getElementById(`view-${tab.dataset.target}`).classList.add('active');
        });
    });
}

function renderStockRequests(reqs) {
    const container = document.getElementById('admin-notifications');
    container.innerHTML = '';
    reqs.forEach(req => {
        const div = document.createElement('div');
        div.className = "bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800 flex justify-between items-center animate-fadeIn";
        div.innerHTML = `
            <div class="text-sm dark:text-white">
                <span class="font-bold">${req.requesterName}</span> needs stock
            </div>
            <div class="space-x-2">
                <button class="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-blue-700 btn-fulfill" data-id="${req.id}" data-uid="${req.requesterUid}">Fulfill</button>
                <button class="text-gray-400 hover:text-gray-600 text-xs btn-dismiss" data-id="${req.id}">Dismiss</button>
            </div>
        `;
        container.appendChild(div);
    });

    // Event Delegation for dynamic buttons
    container.querySelectorAll('.btn-fulfill').forEach(b => {
        b.addEventListener('click', async (e) => {
            // Pre-fill manage tab
            document.querySelector('[data-target="manage"]').click();
            document.getElementById('restock-driver').value = e.target.dataset.uid;
            await resolveStockRequest(e.target.dataset.id);
        });
    });
    
    container.querySelectorAll('.btn-dismiss').forEach(b => {
        b.addEventListener('click', async (e) => await dismissStockRequest(e.target.dataset.id));
    });
}

function renderDriverList(drivers) {
    const list = document.getElementById('driver-list');
    list.innerHTML = '';
    drivers.forEach(d => {
        const isOnline = d.onlineStatus === 'online'; // Field needs to be set in Driver UI
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center";
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-blue-600 bg-blue-100 border-2 ${isOnline ? 'border-green-500' : 'border-gray-300'}">
                    ${d.displayName ? d.displayName[0] : 'U'}
                </div>
                <div>
                    <div class="font-bold dark:text-white">${d.displayName}</div>
                    <div class="text-xs text-gray-500">Stock: ${d.currentStock || 0} • Debt: <span class="text-red-500">$${d.currentDebt || 0}</span></div>
                </div>
            </div>
            <div class="text-xs font-bold px-2 py-1 rounded ${d.accessStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${d.accessStatus}</div>
        `;
        list.appendChild(card);
    });
}

function populateDropdowns() {
    const selects = document.querySelectorAll('.driver-select');
    selects.forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '<option value="">Select Driver...</option>';
        cachedDrivers.forEach(d => {
            if(d.accessStatus !== 'suspended') {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.text = d.displayName;
                sel.appendChild(opt);
            }
        });
        sel.value = current;
    });
}

// --- CALENDAR LOGIC ---

function setupCalendar() {
    document.getElementById('cal-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendarGrid(); });
    document.getElementById('cal-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendarGrid(); });
}

function renderCalendarGrid() {
    const grid = document.getElementById('admin-calendar');
    const label = document.getElementById('cal-month');
    grid.innerHTML = '';
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    label.innerText = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding
    for(let i=0; i<startDay; i++) grid.innerHTML += `<div></div>`;

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // Find shifts for this day across ALL drivers
        let dayShifts = [];
        cachedDrivers.forEach(drv => {
            (drv.shifts || []).forEach(s => {
                if(s.date === dateStr) dayShifts.push({ ...s, name: drv.displayName, uid: drv.id });
            });
        });

        const dayEl = document.createElement('div');
        dayEl.className = "calendar-day bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition";
        dayEl.innerHTML = `<div class="text-xs font-bold text-gray-400 mb-1">${d}</div>`;
        
        dayShifts.forEach(s => {
            dayEl.innerHTML += `<div class="bg-purple-500 text-white shift-bar truncate">${s.name}: ${s.start}-${s.end}</div>`;
        });

        // Click to view/delete details
        dayEl.addEventListener('click', () => {
            const det = document.getElementById('cal-details');
            det.classList.remove('hidden');
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
                row.appendChild(delBtn);
                det.appendChild(row);
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
    
    // Draw Chart
    const ctx = document.getElementById('chart-daily');
    if(ctx) {
         new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(data.dailyRevenue),
                datasets: [{
                    label: 'Revenue',
                    data: Object.values(data.dailyRevenue),
                    borderColor: '#2563eb',
                    tension: 0.4
                }]
            },
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