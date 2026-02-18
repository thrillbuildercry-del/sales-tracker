import { db, collection, query, where, getDocs, orderBy } from './firebase.js';

/**
 * Fetch all completed sales and delivered orders for the last 7 days
 * Returns aggregated data for Admin Charts
 */
export const getWeeklyReport = async () => {
    // 1. Define time range (Last 7 days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    // 2. Fetch Sales (Walk-ups)
    const salesRef = collection(db, 'sales');
    // Note: If this fails, check browser console for Firestore Index creation link
    const salesQuery = query(salesRef, where('timestamp', '>=', lastWeek), orderBy('timestamp'));
    const salesSnap = await getDocs(salesQuery);

    // 3. Fetch Delivered Orders (App Orders)
    const ordersRef = collection(db, 'orders');
    // We look for 'completed' (new status) or 'delivered' (legacy status)
    const ordersQuery = query(ordersRef, where('status', 'in', ['completed', 'delivered']));
    const ordersSnap = await getDocs(ordersQuery);

    let totalRevenue = 0;
    let totalItems = 0;
    const salesByDriver = {}; // { 'Driver Name': revenue }
    const dailyRevenue = {};  // { 'Mon': 100, 'Tue': 200 }

    // Helper to aggregate data
    const processItem = (amount, driverId, dateObj) => {
        if (!amount || !driverId) return;
        
        totalRevenue += amount;
        
        // Group by Driver ID (UI will map ID to Name later)
        if (!salesByDriver[driverId]) salesByDriver[driverId] = 0;
        salesByDriver[driverId] += amount;

        // Group by Day of Week
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        if (!dailyRevenue[dayName]) dailyRevenue[dayName] = 0;
        dailyRevenue[dayName] += amount;
    };

    // Process Walk-up Sales
    salesSnap.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            processItem(data.grossRevenue, data.driverId, data.timestamp.toDate());
            totalItems += (data.quantity || 0);
        }
    });

    // Process App Orders
    ordersSnap.forEach(doc => {
        const data = doc.data();
        const dateRaw = data.deliveredAt || data.createdAt;
        if (dateRaw) {
            const date = dateRaw.toDate();
            // Filter manually for last week to avoid complex composite index requirement
            if (date >= lastWeek) {
                processItem(data.totalPrice, data.assignedDriverId, date);
                totalItems += (data.quantity || 0);
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