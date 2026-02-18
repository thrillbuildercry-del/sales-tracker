<<<<<<< HEAD
import { db, collection, query, where, onSnapshot, doc, updateDoc, runTransaction, serverTimestamp, deleteDoc, addDoc, getDoc } from './firebase.js';
=======
import { 
    db, 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc, 
    runTransaction, 
    serverTimestamp, 
    deleteDoc, 
    addDoc, 
    getDoc 
} from './firebase.js';
>>>>>>> parent of c60ae61 (v2)

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

<<<<<<< HEAD
// --- MANAGEMENT ACTIONS ---
=======
// --- ASSET MANAGEMENT (Stock & Debt) ---
>>>>>>> parent of c60ae61 (v2)

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
<<<<<<< HEAD
            transaction.set(logRef, {
                type: 'restock',
                adminId, driverId,
=======
            
            // Log the action
            transaction.set(logRef, {
                type: 'restock',
                adminId, 
                driverId,
>>>>>>> parent of c60ae61 (v2)
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

<<<<<<< HEAD
// Peer-to-Peer Transfer
=======
// 2. Driver -> Driver (P2P Transfer)
>>>>>>> parent of c60ae61 (v2)
export const p2pTransfer = async (fromId, toId, quantity, debtAmount) => {
    const fromRef = doc(db, "users", fromId);
    const toRef = doc(db, "users", toId);
    
    try {
        await runTransaction(db, async (t) => {
            const fromDoc = await t.get(fromRef);
            const toDoc = await t.get(toRef);
            
<<<<<<< HEAD
=======
            if (!fromDoc.exists() || !toDoc.exists()) throw "One or both drivers not found";

>>>>>>> parent of c60ae61 (v2)
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
        console.error("Transfer failed:", e);
        return { success: false, error: e };
    }
};

<<<<<<< HEAD
// Resolve Stock Request
=======
// 3. Driver -> Warehouse/House (Collection)
export const adminCollectAssets = async (driverId, stockToCollect, debtToCollect) => {
    const driverRef = doc(db, "users", driverId);
    try {
        await runTransaction(db, async (t) => {
            const d = await t.get(driverRef);
            if (!d.exists()) throw "Driver not found";
            
            const currentStock = d.data().currentStock || 0;
            const currentDebt = d.data().currentDebt || 0;

            // Ensure we don't go below zero
            const newStock = Math.max(0, currentStock - parseInt(stockToCollect || 0));
            const newDebt = Math.max(0, currentDebt - parseInt(debtToCollect || 0));

            t.update(driverRef, {
                currentStock: newStock,
                currentDebt: newDebt
            });
        });
        return { success: true };
    } catch (e) {
        console.error("Collection failed:", e);
        return { success: false, error: e };
    }
};

// --- USER MANAGEMENT ---

export const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, "users", userId), { accessStatus: newStatus });
};

// --- REQUEST HANDLING ---

>>>>>>> parent of c60ae61 (v2)
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
    
<<<<<<< HEAD
    // Remove if exists (Edit logic)
=======
    // Remove existing shift for that day/time if it exists (simple overwrite logic)
>>>>>>> parent of c60ae61 (v2)
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