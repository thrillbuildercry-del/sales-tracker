// js/services/admin-service.js
import { db, collection, query, where, onSnapshot, doc, updateDoc, runTransaction, serverTimestamp } from './firebase.js';

/**
 * Real-time listener for all drivers (Pending & Active)
 * @param {function} callback - Function to run when data changes
 */
export const subscribeToDrivers = (callback) => {
    const q = query(collection(db, "users"), where("role", "==", "driver"));
    
    // Real-time listener
    return onSnapshot(q, (snapshot) => {
        const drivers = [];
        snapshot.forEach((doc) => {
            drivers.push({ id: doc.id, ...doc.data() });
        });
        callback(drivers);
    });
};

/**
 * Approve or Suspend a user
 */
export const updateUserStatus = async (userId, newStatus) => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        accessStatus: newStatus
    });
};

/**
 * Distribute Stock to a Driver
 * Records in 'inventory_log' AND updates 'users' collection atomically.
 */
export const addStockToDriver = async (adminId, driverId, quantity) => {
    const driverRef = doc(db, "users", driverId);
    const logRef = doc(collection(db, "inventory_log"));

    try {
        await runTransaction(db, async (transaction) => {
            const driverDoc = await transaction.get(driverRef);
            if (!driverDoc.exists()) throw "Driver not found";

            const currentStock = driverDoc.data().currentStock || 0;
            const newStock = currentStock + parseInt(quantity);

            // 1. Update Driver Stock
            transaction.update(driverRef, { currentStock: newStock });

            // 2. Create Log Entry
            transaction.set(logRef, {
                type: 'restock',
                adminId: adminId,
                driverId: driverId,
                quantity: parseInt(quantity),
                timestamp: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error) {
        console.error("Restock failed:", error);
        return { success: false, error };
    }
};