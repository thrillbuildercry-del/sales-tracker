import { db, collection, query, where, onSnapshot, doc, updateDoc, runTransaction, serverTimestamp, deleteDoc, addDoc, getDoc } from './firebase.js';

// --- REAL-TIME LISTENERS ---

export const subscribeToDrivers = (callback) => {
    const q = query(collection(db, "users"), where("role", "==", "driver"));
    return onSnapshot(q, (snapshot) => {
        const drivers = [];
        snapshot.forEach((doc) => drivers.push({ id: doc.id, ...doc.data() }));
        callback(drivers);
    });
};

export const subscribeToStockRequests = (callback) => {
    const q = query(collection(db, "stock_requests"), where("status", "==", "pending"));
    return onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reqs);
    });
};

export const subscribeToCoverRequests = (callback) => {
    const q = query(collection(db, "cover_requests"), where("status", "==", "open"));
    return onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reqs);
    });
};

// --- MANAGEMENT ACTIONS ---

export const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, "users", userId), { accessStatus: newStatus });
};

// Admin Distribute Stock (Direct Add)
export const addStockToDriver = async (adminId, driverId, quantity) => {
    const driverRef = doc(db, "users", driverId);
    const logRef = doc(collection(db, "inventory_log"));
    
    // Also resolve any pending requests for this driver implicitly? 
    // For now, let's keep it manual.

    try {
        await runTransaction(db, async (transaction) => {
            const driverDoc = await transaction.get(driverRef);
            if (!driverDoc.exists()) throw "Driver not found";
            const newStock = (driverDoc.data().currentStock || 0) + parseInt(quantity);
            
            transaction.update(driverRef, { currentStock: newStock });
            transaction.set(logRef, {
                type: 'restock',
                adminId, driverId,
                quantity: parseInt(quantity),
                timestamp: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

// Peer-to-Peer Transfer
export const p2pTransfer = async (fromId, toId, quantity, debtAmount) => {
    const fromRef = doc(db, "users", fromId);
    const toRef = doc(db, "users", toId);
    
    try {
        await runTransaction(db, async (t) => {
            const fromDoc = await t.get(fromRef);
            const toDoc = await t.get(toRef);
            
            const fromData = fromDoc.data();
            const toData = toDoc.data();

            // Deduct from Source
            t.update(fromRef, {
                currentStock: (fromData.currentStock || 0) - quantity,
                currentDebt: (fromData.currentDebt || 0) - debtAmount
            });

            // Add to Target
            t.update(toRef, {
                currentStock: (toData.currentStock || 0) + quantity,
                currentDebt: (toData.currentDebt || 0) + debtAmount
            });
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
};

// Resolve Stock Request
export const resolveStockRequest = async (reqId) => {
    await updateDoc(doc(db, "stock_requests", reqId), { status: 'completed' });
};

export const dismissStockRequest = async (reqId) => {
    await deleteDoc(doc(db, "stock_requests", reqId));
};

// --- SCHEDULE MANAGEMENT ---

export const assignShift = async (driverId, shiftData) => {
    // shiftData: { date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM' }
    const userRef = doc(db, "users", driverId);
    const userDoc = await getDoc(userRef);
    let shifts = userDoc.data().shifts || [];
    
    // Remove if exists (Edit logic)
    shifts = shifts.filter(s => !(s.date === shiftData.date && s.start === shiftData.start));
    shifts.push(shiftData);
    
    await updateDoc(userRef, { shifts });
};

export const deleteShift = async (driverId, date, start) => {
    const userRef = doc(db, "users", driverId);
    const userDoc = await getDoc(userRef);
    let shifts = userDoc.data().shifts || [];
    shifts = shifts.filter(s => !(s.date === date && s.start === start));
    await updateDoc(userRef, { shifts });
};