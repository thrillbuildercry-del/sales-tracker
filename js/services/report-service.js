import { db, collection, query, where, getDocs, orderBy } from './firebase.js';

/**
 * Fetch all completed sales and delivered orders for the last 7 days
 * Returns aggregated data for charts
 */
export const getWeeklyReport = async () => {
    // 1. Define time range (Last 7 days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    // 2. Fetch Walk-up Sales
    const salesRef = collection(db, 'sales');
    // Note: This query requires a Firestore Index (Click the link in console if it fails)
    const salesQuery = query(salesRef, where('timestamp', '>=', lastWeek), orderBy('timestamp'));
    const salesSnap = await getDocs(salesQuery);

    // 3. Fetch Delivered Orders
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('status', '==', 'delivered'));
    const ordersSnap = await getDocs(ordersQuery);

    let totalRevenue = 0;
    let totalItems = 0;
    const salesByDriver = {}; // { 'driverId': revenue }
    const dailyRevenue = {};  // { 'Mon': 100, 'Tue': 200 }

    // Helper to process items
    const processItem = (amount, driverId, dateObj) => {
        if (!amount || !driverId) return;
        
        totalRevenue += amount;
        
        // Group by Driver
        if (!salesByDriver[driverId]) salesByDriver[driverId] = 0;
        salesByDriver[driverId] += amount;

        // Group by Day
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        if (!dailyRevenue[dayName]) dailyRevenue[dayName] = 0;
        dailyRevenue[dayName] += amount;
    };

    // Process Walk-up Sales
    salesSnap.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            processItem(data.grossRevenue, data.driverId, data.timestamp.toDate());
            totalItems += data.quantity;
        }
    });

    // Process Deliveries
    ordersSnap.forEach(doc => {
        const data = doc.data();
        // Manual date filter for orders to avoid complex composite indexes
        // We prioritize deliveredAt, fallback to createdAt
        const dateRaw = data.deliveredAt || data.createdAt;
        if (dateRaw) {
            const date = dateRaw.toDate();
            if (date >= lastWeek) {
                processItem(data.totalPrice, data.assignedDriverId, date);
                totalItems += data.quantity;
            }
        }
    });

    return {
        totalRevenue,
        totalItems,
        salesByDriver,
        dailyRevenue
    };
};