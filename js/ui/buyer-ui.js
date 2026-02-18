import { createOrder, subscribeToMyOrders } from '../services/order-service.js';
import { logoutUser } from '../services/auth-manager.js';
import { PRICING } from '../config/constants.js';

const appRoot = document.getElementById('app-root');
let unsubscribeOrders = null;

export const renderBuyerDashboard = (user) => {
    appRoot.innerHTML = `
        <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-200">
            <header class="bg-blue-600 dark:bg-gray-800 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
                <h1 class="text-lg font-bold flex items-center"><i data-lucide="shopping-cart" class="w-5 h-5 mr-2"></i> Shop Deals</h1>
                <div class="flex gap-2">
                    <button onclick="window.toggleTheme()" class="p-2 bg-blue-700 dark:bg-gray-700 rounded-full hover:bg-blue-800"><i data-lucide="moon" class="w-5 h-5"></i></button>
                    <button id="logout-buyer" class="text-sm bg-blue-700 dark:bg-gray-700 hover:bg-blue-800 px-3 py-1 rounded font-bold">Sign Out</button>
                </div>
            </header>

            <main class="p-4 max-w-md mx-auto space-y-6">
                
                <div id="active-order-card" class="hidden bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-l-4 border-blue-500 animate-fadeIn">
                    <div class="flex justify-between items-start mb-2">
                        <h2 class="font-bold text-lg dark:text-white" id="order-status-text">Processing...</h2>
                        <div class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold" id="order-eta">--:--</div>
                    </div>
                    
                    <div id="driver-info" class="hidden mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border dark:border-gray-600">
                        <div class="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                            <i data-lucide="truck" class="w-4 h-4 mr-2"></i>
                            Runner: <span id="driver-name" class="ml-1">--</span>
                        </div>
                        <div class="text-gray-500 dark:text-gray-400 text-xs mt-1 ml-6" id="vehicle-info">Vehicle info...</div>
                    </div>
                </div>

                <div id="shop-section">
                    <h2 class="text-gray-500 text-xs uppercase font-bold mb-3">Select Deal Quantity</h2>
                    <div class="grid grid-cols-2 gap-3">
                        ${[1, 2, 3, 4].map(num => `
                            <button class="deal-btn p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center hover:border-blue-500 transition active:scale-95" data-qty="${num}" data-price="${PRICING.DEAL_TIERS[num]}">
                                <div class="text-2xl font-bold dark:text-white">${num} Item${num > 1 ? 's' : ''}</div>
                                <div class="text-green-600 font-bold">$${PRICING.DEAL_TIERS[num]}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div>
                    <h2 class="font-bold text-gray-800 dark:text-white mb-2 text-sm">Recent Orders</h2>
                    <div id="orders-list" class="space-y-2 pb-10">
                        <p class="text-gray-400 text-center text-sm py-4">Loading history...</p>
                    </div>
                </div>
            </main>

            <div id="checkout-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center hidden backdrop-blur-sm">
                <div class="bg-white dark:bg-gray-800 w-11/12 max-w-sm p-6 rounded-2xl shadow-2xl">
                    <h2 class="text-xl font-bold mb-4 dark:text-white">Confirm Order</h2>
                    <div class="mb-6 text-center">
                        <div class="text-4xl font-bold text-green-600" id="checkout-total">$0</div>
                        <div class="text-xs text-gray-500 uppercase mt-1">Cash on Delivery</div>
                    </div>
                    <div class="space-y-3">
                        <textarea id="address-input" rows="2" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter Delivery Address..."></textarea>
                        <button id="btn-confirm-order" class="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-lg">Submit Order</button>
                        <button id="btn-cancel-checkout" class="w-full text-gray-500 py-2 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
    attachBuyerEvents(user);
    
    // Listen for Real-time Updates
    unsubscribeOrders = subscribeToMyOrders(user.uid, (orders) => {
        handleOrdersUpdate(orders);
    });
};

function handleOrdersUpdate(orders) {
    const list = document.getElementById('orders-list');
    const activeCard = document.getElementById('active-order-card');
    const shopSection = document.getElementById('shop-section');
    
    list.innerHTML = '';

    // Filter for Active Order (Pending/Assigned/Arrived)
    // We ignore 'completed' and 'cancelled' for the "Active Card"
    const activeOrder = orders.find(o => ['pending', 'assigned', 'accepted', 'arrived'].includes(o.status));

    if (activeOrder) {
        activeCard.classList.remove('hidden');
        shopSection.classList.add('opacity-50', 'pointer-events-none'); // Disable shop while active order exists
        
        // Update Status Text
        const statusMap = {
            'pending': 'Finding a runner...',
            'assigned': 'Runner assigned!',
            'accepted': 'Runner is on the way',
            'arrived': 'Runner has arrived!'
        };
        document.getElementById('order-status-text').innerText = statusMap[activeOrder.status] || 'Processing...';
        document.getElementById('order-eta').innerText = activeOrder.eta || '--:--';

        // Update Driver Info
        if(activeOrder.driverName) {
            document.getElementById('driver-info').classList.remove('hidden');
            document.getElementById('driver-name').innerText = activeOrder.driverName;
            document.getElementById('vehicle-info').innerText = activeOrder.vehicle || "Vehicle details pending...";
        } else {
            document.getElementById('driver-info').classList.add('hidden');
        }

    } else {
        activeCard.classList.add('hidden');
        shopSection.classList.remove('opacity-50', 'pointer-events-none');
    }

    // Render History List (Completed/Cancelled only, or all)
    // Let's show all for history log
    if (orders.length === 0) list.innerHTML = `<div class="text-center text-gray-400 text-sm py-8">No past orders.</div>`;
    
    orders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : '';
        const statusColors = {
            'pending': 'text-yellow-600',
            'assigned': 'text-blue-600',
            'accepted': 'text-blue-600',
            'arrived': 'text-purple-600',
            'delivered': 'text-green-600',
            'completed': 'text-green-600',
            'cancelled': 'text-red-600'
        };

        const div = document.createElement('div');
        div.className = "bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <div class="font-bold text-sm dark:text-white">${order.quantity} Items <span class="text-gray-400 font-normal">• $${order.totalPrice}</span></div>
                <div class="text-xs text-gray-500 truncate w-40">${order.deliveryAddress}</div>
            </div>
            <div class="text-xs font-bold ${statusColors[order.status] || 'text-gray-500'} uppercase">${order.status}</div>
        `;
        list.appendChild(div);
    });
}

function attachBuyerEvents(user) {
    let selectedQty = 0;
    let selectedPrice = 0;
    const modal = document.getElementById('checkout-modal');
    
    // Logout
    document.getElementById('logout-buyer').addEventListener('click', () => {
        if(unsubscribeOrders) unsubscribeOrders();
        logoutUser();
    });

    // Deal Buttons
    document.querySelectorAll('.deal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('button');
            selectedQty = parseInt(btnEl.dataset.qty);
            selectedPrice = parseInt(btnEl.dataset.price);
            
            document.getElementById('checkout-total').innerText = `$${selectedPrice}`;
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('address-input').focus(), 100);
        });
    });

    // Cancel Modal
    document.getElementById('btn-cancel-checkout').addEventListener('click', () => {
        modal.classList.add('hidden');
        document.getElementById('address-input').value = '';
    });

    // Confirm Order
    document.getElementById('btn-confirm-order').addEventListener('click', async () => {
        const address = document.getElementById('address-input').value.trim();
        const btn = document.getElementById('btn-confirm-order');
        
        if(!address) return alert("Please enter a delivery address");
        
        btn.disabled = true;
        btn.innerText = "Placing Order...";
        
        // Pass metrics object structure expected by service
        const metrics = { grossRevenue: selectedPrice }; 
        const result = await createOrder(user.uid, selectedQty, address, metrics);

        if(result.success) {
            modal.classList.add('hidden');
            document.getElementById('address-input').value = '';
            // Toast or UI update happens via listener
        } else {
            alert("Order failed: " + result.error);
        }
        btn.disabled = false;
        btn.innerText = "Submit Order";
    });
}