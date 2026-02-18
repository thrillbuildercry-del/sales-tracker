import { processSale } from '../services/driver-service.js';
import { subscribeToDriverOrders, completeOrder } from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { calculateSaleMetrics } from '../utils/calculations.js';

const appRoot = document.getElementById('app-root');

export const renderDriverDashboard = (user) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-100 pb-20">
            <header class="bg-blue-900 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
                <div><h1 class="font-bold text-xl">Driver Panel</h1><p class="text-xs text-blue-200">${user.displayName}</p></div>
                <div class="text-right"><div class="text-xs text-blue-200">Debt</div><div class="font-bold text-lg text-red-400">$${user.currentDebt || 0}</div></div>
            </header>

            <main class="p-4 space-y-4">
                <div class="bg-white rounded-xl shadow p-6 flex justify-between items-center border-l-4 border-blue-500">
                    <div><h2 class="text-gray-500 text-sm uppercase">Current Stock</h2><span class="text-4xl font-bold text-gray-800" id="stock-display">${user.currentStock || 0}</span></div>
                </div>

                <div id="deliveries-section" class="hidden">
                    <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Active Deliveries</h2>
                    <div id="delivery-list" class="space-y-3"></div>
                </div>

                <button id="btn-new-sale" class="w-full bg-green-600 text-white rounded-xl p-4 shadow-lg flex items-center justify-center gap-3"><span class="text-xl font-bold">Record Walk-Up Sale</span></button>
                <button id="logout-driver" class="w-full mt-8 text-red-600 text-sm font-semibold p-4">Sign Out</button>
            </main>

            <div id="sale-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <div class="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl m-4">
                    <div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold">New Sale</h3><button id="close-modal" class="text-gray-400">X</button></div>
                    <div class="mb-6 flex gap-2">
                        ${[1, 2, 3, 4].map(num => `<button class="qty-btn flex-1 py-3 border-2 rounded-lg font-bold text-lg" data-qty="${num}">${num}</button>`).join('')}
                    </div>
                    <div id="sale-preview" class="hidden bg-gray-50 rounded-lg p-4 mb-6 space-y-2 border">
                        <div class="flex justify-between"><span class="text-gray-500">Price:</span><span class="font-bold" id="preview-revenue">$0</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Profit:</span><span class="font-bold text-green-600" id="preview-profit">$0</span></div>
                    </div>
                    <button id="confirm-sale" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl">Confirm Sale</button>
                </div>
            </div>
        </div>
    `;

    attachDriverEvents(user);
    subscribeToDriverOrders(user.uid, (orders) => renderDriverDeliveries(orders));
};

function renderDriverDeliveries(orders) {
    const section = document.getElementById('deliveries-section');
    const list = document.getElementById('delivery-list');
    list.innerHTML = '';

    if (orders.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = "bg-blue-900 text-white p-4 rounded-xl shadow-lg";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2"><h3 class="font-bold text-lg">Delivery #${order.id.slice(0,4)}</h3><span class="bg-blue-700 text-xs px-2 py-1 rounded">Assigned</span></div>
            <div class="mb-4 text-blue-100 text-sm">
                <p class="font-bold text-white text-lg">${order.quantity} Items</p>
                <p class="opacity-75">${order.deliveryAddress}</p>
                <p class="mt-1 text-yellow-400 font-bold">Collect: $${order.totalPrice}</p>
            </div>
            <button class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg btn-complete-delivery" data-id="${order.id}">Mark Delivered</button>
        `;
        list.appendChild(card);
    });

    document.querySelectorAll('.btn-complete-delivery').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("Confirm delivery completed?")) await completeOrder(e.target.dataset.id);
        });
    });
}

function attachDriverEvents(user) {
    const modal = document.getElementById('sale-modal');
    const qtyBtns = document.querySelectorAll('.qty-btn');
    const confirmBtn = document.getElementById('confirm-sale');
    let selectedQty = 0;

    document.getElementById('logout-driver').addEventListener('click', logoutUser);
    document.getElementById('btn-new-sale').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('close-modal').addEventListener('click', () => modal.classList.add('hidden'));

    qtyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            qtyBtns.forEach(b => b.classList.remove('border-green-500', 'text-green-600', 'bg-green-50'));
            e.target.classList.add('border-green-500', 'text-green-600', 'bg-green-50');
            selectedQty = parseInt(e.target.dataset.qty);
            const metrics = calculateSaleMetrics(selectedQty);
            document.getElementById('sale-preview').classList.remove('hidden');
            document.getElementById('preview-revenue').innerText = `$${metrics.grossRevenue}`;
            document.getElementById('preview-profit').innerText = `+$${metrics.driverProfit}`;
        });
    });

    confirmBtn.addEventListener('click', async () => {
        if(selectedQty === 0) return;
        confirmBtn.innerText = "Processing...";
        confirmBtn.disabled = true;
        const result = await processSale(user.uid, selectedQty);
        if (result.success) {
            modal.classList.add('hidden');
            alert(`Sale Successful! Profit: $${result.metrics.driverProfit}`);
            selectedQty = 0;
            confirmBtn.innerText = "Confirm Sale";
            confirmBtn.disabled = false;
        } else {
            alert("Error: " + result.error);
            confirmBtn.innerText = "Confirm Sale";
            confirmBtn.disabled = false;
        }
    });
}