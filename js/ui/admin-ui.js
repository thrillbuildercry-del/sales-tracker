import { subscribeToDrivers, updateUserStatus, addStockToDriver } from '../services/admin-service.js';
import { subscribeToPendingOrders, assignDriverToOrder } from '../services/order-service.js';
import { getWeeklyReport } from '../services/report-service.js'; // <--- NEW IMPORT
import { logoutUser } from '../services/auth-manager.js';

const appRoot = document.getElementById('app-root');
let unsubscribeDrivers = null;
let cachedDrivers = []; 

export const renderAdminDashboard = (currentUser) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-50 pb-20">
            <header class="bg-gray-900 text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center">
                <div><h1 class="text-xl font-bold text-yellow-500">Boss Mode</h1><p class="text-xs text-gray-400">Admin Dashboard</p></div>
                <button id="admin-logout" class="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Logout</button>
            </header>

            <main class="p-4 space-y-6">
                
                <div class="mb-8">
                    <h2 class="text-lg font-bold text-gray-800 mb-4">Weekly Performance</h2>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                            <p class="text-gray-500 text-xs uppercase">7-Day Revenue</p>
                            <p class="text-2xl font-bold text-gray-800" id="report-revenue">Loading...</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <p class="text-gray-500 text-xs uppercase">Items Sold</p>
                            <p class="text-2xl font-bold text-gray-800" id="report-items">Loading...</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-white p-4 rounded-lg shadow">
                            <h3 class="text-sm font-bold text-gray-500 mb-2">Revenue by Day</h3>
                            <canvas id="chart-daily"></canvas>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow">
                            <h3 class="text-sm font-bold text-gray-500 mb-2">Top Drivers</h3>
                            <canvas id="chart-drivers"></canvas>
                        </div>
                    </div>
                </div>

                <div id="pending-section" class="hidden">
                    <h2 class="text-lg font-bold text-gray-800 mb-2 text-red-600">Action Required</h2>
                    <div id="pending-list" class="space-y-3"></div>
                </div>

                <div id="orders-section">
                    <h2 class="text-lg font-bold text-gray-800 mb-2">Incoming Orders</h2>
                    <div id="pending-orders-list" class="space-y-3">
                        <div class="text-center py-4 text-gray-400">Waiting for orders...</div>
                    </div>
                </div>

                <div>
                    <h2 class="text-lg font-bold text-gray-800 mb-2">Team Management</h2>
                    <div id="driver-list" class="space-y-3"><div class="text-center py-8 text-gray-400">Loading Team...</div></div>
                </div>
            </main>

            <div id="restock-modal" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                    <h3 class="text-xl font-bold mb-4">Add Stock</h3>
                    <p class="text-sm text-gray-500 mb-4">Driver: <span id="modal-driver-name" class="font-bold text-black"></span></p>
                    <input type="number" id="restock-qty" class="w-full border-2 border-gray-300 rounded-lg p-3 text-lg font-bold mb-4" placeholder="Amount">
                    <div class="flex gap-3">
                        <button id="close-restock" class="flex-1 bg-gray-200 py-3 rounded-lg font-semibold">Cancel</button>
                        <button id="confirm-restock" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    attachAdminEvents(currentUser);

    // Initialize Listeners
    unsubscribeDrivers = subscribeToDrivers((drivers) => {
        cachedDrivers = drivers; 
        renderDriverLists(drivers, currentUser);
        populateDriverDropdowns();
        
        // Reload reports when driver list loads (to get names for charts)
        loadReports(); 
    });

    subscribeToPendingOrders((orders) => {
        renderPendingOrders(orders);
    });
};

async function loadReports() {
    try {
        const data = await getWeeklyReport();

        // Update Text Cards
        const revEl = document.getElementById('report-revenue');
        const itemEl = document.getElementById('report-items');
        if(revEl) revEl.innerText = `$${data.totalRevenue}`;
        if(itemEl) itemEl.innerText = data.totalItems;

        // Prepare Charts
        const dailyCtx = document.getElementById('chart-daily');
        const driverCtx = document.getElementById('chart-drivers');

        // Only render if elements exist (safety check)
        if(dailyCtx && driverCtx) {
            // Destroy old charts if they exist (to prevent overlay glitching)
            // Note: In a simple app, re-rendering entirely is fine, but Chart.js likes explicit destruction.
            // For simplicity here, we assume a fresh render or just overwrite.
            
            new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(data.dailyRevenue),
                    datasets: [{
                        label: 'Revenue ($)',
                        data: Object.values(data.dailyRevenue),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            const driverLabels = Object.keys(data.salesByDriver).map(uid => {
                const driver = cachedDrivers.find(d => d.id === uid);
                return driver ? driver.displayName.split(' ')[0] : 'Unknown';
            });

            new Chart(driverCtx, {
                type: 'bar',
                data: {
                    labels: driverLabels,
                    datasets: [{
                        label: 'Sales ($)',
                        data: Object.values(data.salesByDriver),
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (error) {
        console.error("Error loading reports:", error);
    }
}

function renderPendingOrders(orders) {
    const list = document.getElementById('pending-orders-list');
    list.innerHTML = '';
    if (orders.length === 0) {
        list.innerHTML = `<div class="bg-white p-4 rounded text-center text-gray-400 text-sm">No pending orders.</div>`;
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-400 mb-2";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="font-bold text-gray-900">#${order.id.slice(0, 6)}</span>
                <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>
            </div>
            <div class="text-sm text-gray-600 mb-3"><p><strong>${order.quantity} Items</strong> ($${order.totalPrice})</p><p class="truncate">${order.deliveryAddress}</p></div>
            <div class="flex gap-2">
                <select id="assign-driver-${order.id}" class="flex-1 text-sm border p-2 rounded bg-gray-50"><option value="">Select Driver...</option></select>
                <button class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 btn-assign" data-id="${order.id}">Assign</button>
            </div>
        `;
        list.appendChild(card);
    });
    populateDriverDropdowns();

    document.querySelectorAll('.btn-assign').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.target.dataset.id;
            const select = document.getElementById(`assign-driver-${orderId}`);
            const driverId = select.value;
            const driverName = select.options[select.selectedIndex].text;
            if (!driverId) return alert("Select a driver!");
            btn.innerText = "Assigning...";
            await assignDriverToOrder(orderId, driverId, driverName);
        });
    });
}

function populateDriverDropdowns() {
    const selects = document.querySelectorAll('select[id^="assign-driver-"]');
    selects.forEach(select => {
        while (select.options.length > 1) select.remove(1);
        cachedDrivers.forEach(driver => {
            if (driver.accessStatus === 'active') {
                const opt = document.createElement('option');
                opt.value = driver.id;
                opt.text = driver.displayName;
                select.appendChild(opt);
            }
        });
    });
}

function renderDriverLists(drivers, currentUser) {
    const pendingContainer = document.getElementById('pending-list');
    const activeContainer = document.getElementById('driver-list');
    const pendingSection = document.getElementById('pending-section');
    pendingContainer.innerHTML = '';
    activeContainer.innerHTML = '';

    const pendingDrivers = drivers.filter(d => d.accessStatus === 'pending');
    
    if (pendingDrivers.length > 0) {
        pendingSection.classList.remove('hidden');
        pendingDrivers.forEach(user => {
            const card = document.createElement('div');
            card.className = "bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center";
            card.innerHTML = `<div><p class="font-bold">${user.displayName}</p></div><button class="bg-green-600 text-white px-4 py-2 rounded btn-approve" data-id="${user.id}">Approve</button>`;
            pendingContainer.appendChild(card);
        });
    } else {
        pendingSection.classList.add('hidden');
    }

    drivers.filter(d => d.accessStatus !== 'pending').forEach(user => {
        const isSuspended = user.accessStatus === 'suspended';
        const card = document.createElement('div');
        card.className = `bg-white p-4 rounded-lg shadow flex flex-col gap-3 ${isSuspended ? 'opacity-75 bg-gray-100' : ''}`;
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div><p class="font-bold">${user.displayName}</p><span class="text-xs px-2 py-0.5 rounded ${isSuspended ? 'bg-red-100' : 'bg-green-100'}">${user.accessStatus}</span></div>
                <div class="text-right"><p class="text-xs text-gray-400">Stock</p><p class="text-xl font-bold text-blue-600">${user.currentStock || 0}</p></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                <button class="text-sm py-2 bg-blue-50 text-blue-700 rounded btn-restock" data-id="${user.id}" data-name="${user.displayName}">+ Stock</button>
                <button class="text-sm py-2 border text-gray-600 rounded btn-toggle-status" data-id="${user.id}" data-status="${user.accessStatus}">${isSuspended ? 'Activate' : 'Suspend'}</button>
            </div>
        `;
        activeContainer.appendChild(card);
    });

    attachDynamicEvents(currentUser);
}

function attachAdminEvents(currentUser) {
    document.getElementById('admin-logout').addEventListener('click', () => {
        if(unsubscribeDrivers) unsubscribeDrivers();
        logoutUser();
    });
    document.getElementById('close-restock').addEventListener('click', () => {
        document.getElementById('restock-modal').classList.add('hidden');
    });
}

function attachDynamicEvents(currentUser) {
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', async (e) => await updateUserStatus(e.target.dataset.id, 'active'));
    });
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const newStatus = e.target.dataset.status === 'active' ? 'suspended' : 'active';
            if(confirm(`Mark user as ${newStatus}?`)) await updateUserStatus(e.target.dataset.id, newStatus);
        });
    });
    document.querySelectorAll('.btn-restock').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = document.getElementById('restock-modal');
            document.getElementById('modal-driver-name').innerText = e.target.dataset.name;
            document.getElementById('restock-qty').value = '';
            
            const confirmBtn = document.getElementById('confirm-restock');
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            newConfirmBtn.addEventListener('click', async () => {
                const qty = document.getElementById('restock-qty').value;
                if(!qty || qty <= 0) return alert("Enter quantity");
                newConfirmBtn.innerText = "Processing...";
                await addStockToDriver(currentUser.uid, e.target.dataset.id, qty);
                modal.classList.add('hidden');
                newConfirmBtn.innerText = "Confirm";
            });
            modal.classList.remove('hidden');
        });
    });
}