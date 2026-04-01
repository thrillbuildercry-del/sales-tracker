import { createOrder, subscribeToMyOrders } from '../services/order-service.js';
import { calculateSaleMetrics } from '../utils/calculations.js';
import { logoutUser } from '../services/auth-manager.js';

const appRoot = document.getElementById('app-root');
let unsubscribeOrders = null;

export const renderBuyerDashboard = (user) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-50 pb-20">
            <header class="bg-white shadow-sm p-4 sticky top-0 z-50 flex justify-between items-center">
                <h1 class="text-xl font-bold text-blue-900">Order Now</h1>
                <button id="logout-buyer" class="text-sm text-gray-500 hover:text-red-500">Sign Out</button>
            </header>

            <main class="p-4 max-w-lg mx-auto space-y-6">
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h2 class="font-bold text-lg mb-4 text-gray-800">New Order</h2>
                    
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-500 mb-2">Select Quantity</label>
                        <div class="flex gap-2">
                            ${[1, 2, 3, 4].map(num => `
                                <button class="qty-btn flex-1 py-3 border rounded-lg font-bold text-lg transition duration-200 hover:border-blue-400" data-qty="${num}">${num}</button>
                            `).join('')}
                        </div>
                    </div>

                    <div id="price-display" class="hidden bg-blue-50 p-4 rounded-lg mb-4 flex justify-between items-center">
                        <span class="text-blue-800 font-medium">Total Price:</span>
                        <span class="text-2xl font-bold text-blue-900" id="total-price">$0</span>
                    </div>

                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-500 mb-2">Delivery Address</label>
                        <textarea id="address-input" rows="2" class="w-full border p-3 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter street address..."></textarea>
                    </div>

                    <button id="place-order-btn" class="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        Place Order
                    </button>
                </div>

                <div>
                    <h2 class="font-bold text-lg mb-2 text-gray-800">My Orders</h2>
                    <div id="orders-list" class="space-y-3 pb-10">
                        <p class="text-gray-400 text-center py-4">Loading history...</p>
                    </div>
                </div>
            </main>
        </div>
    `;

    attachBuyerEvents(user);
    unsubscribeOrders = subscribeToMyOrders(user.uid, (orders) => renderOrderHistory(orders));
};

function renderOrderHistory(orders) {
    const list = document.getElementById('orders-list');
    list.innerHTML = '';

    if (orders.length === 0) {
        list.innerHTML = `<div class="text-center text-gray-400 py-8">No orders yet.</div>`;
        return;
    }

    orders.forEach(order => {
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'assigned': 'bg-blue-100 text-blue-800',
            'delivered': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        };
        const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
        let driverInfo = (order.status === 'assigned' && order.driverName) 
            ? `<div class="mt-2 text-xs text-blue-600 font-medium">🚚 Driver: ${order.driverName}</div>` : '';

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg shadow-sm border border-gray-100";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div><span class="font-bold text-gray-900">${order.quantity} Items</span><span class="text-gray-500 text-sm"> • $${order.totalPrice}</span></div>
                <span class="text-xs px-2 py-1 rounded-full font-bold ${statusColors[order.status]}">${statusLabel}</span>
            </div>
            <p class="text-sm text-gray-600 truncate">${order.deliveryAddress}</p>
            ${driverInfo}
        `;
        list.appendChild(card);
    });
}

function attachBuyerEvents(user) {
    let selectedQty = 0;
    const qtyBtns = document.querySelectorAll('.qty-btn');
    const priceDisplay = document.getElementById('price-display');
    const totalPriceEl = document.getElementById('total-price');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const addressInput = document.getElementById('address-input');

    document.getElementById('logout-buyer').addEventListener('click', () => {
        if(unsubscribeOrders) unsubscribeOrders();
        logoutUser();
    });

    qtyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            qtyBtns.forEach(b => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600'));
            e.target.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
            selectedQty = parseInt(e.target.dataset.qty);
            const metrics = calculateSaleMetrics(selectedQty);
            priceDisplay.classList.remove('hidden');
            totalPriceEl.innerText = `$${metrics.grossRevenue}`;
        });
    });

    placeOrderBtn.addEventListener('click', async () => {
        const address = addressInput.value.trim();
        if (selectedQty === 0 || !address) return alert("Please select quantity and enter address.");
        
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerText = "Placing Order...";
        
        const metrics = calculateSaleMetrics(selectedQty);
        const result = await createOrder(user.uid, selectedQty, address, metrics);

        if (result.success) {
            addressInput.value = '';
            selectedQty = 0;
            priceDisplay.classList.add('hidden');
            qtyBtns.forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
            placeOrderBtn.innerText = "Place Order";
            placeOrderBtn.disabled = false;
        } else {
            alert("Error: " + result.error);
            placeOrderBtn.disabled = false;
        }
    });
}