import { 
    db, collection, query, where, onSnapshot, doc, updateDoc, 
    runTransaction, serverTimestamp, deleteDoc, addDoc, getDoc 
} from './firebase.js';

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

// --- ASSET MANAGEMENT ---

// 1. Warehouse -> Driver (Restock)
export const addStockToDriver = async (adminId, driverId, quantity) => {
    const driverRef = doc(db, "users", driverId);
    const logRef = doc(collection(db, "inventory_log"));
    
    try {
        await runTransaction(db, async (transaction) => {
            const driverDoc = await transaction.get(driverRef);
            if (!driverDoc.exists()) throw "Driver not found";
            
            const currentStock = driverDoc.data().currentStock || 0;
            const newStock = currentStock + parseInt(quantity);
            
            transaction.update(driverRef, { currentStock: newStock });
            
            transaction.set(logRef, {
                type: 'restock',
                adminId, driverId, quantity: parseInt(quantity), timestamp: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

// 2. Driver -> Driver (Transfer)
export const p2pTransfer = async (fromId, toId, quantity, debtAmount) => {
    const fromRef = doc(db, "users", fromId);
    const toRef = doc(db, "users", toId);
    
    try {
        await runTransaction(db, async (t) => {
            const fromDoc = await t.get(fromRef);
            const toDoc = await t.get(toRef);
            if (!fromDoc.exists() || !toDoc.exists()) throw "Drivers not found";

            const fromData = fromDoc.data();
            const toData = toDoc.data();

            t.update(fromRef, {
                currentStock: (fromData.currentStock || 0) - parseInt(quantity || 0),
                currentDebt: (fromData.currentDebt || 0) - parseInt(debtAmount || 0)
            });

            t.update(toRef, {
                currentStock: (toData.currentStock || 0) + parseInt(quantity || 0),
                currentDebt: (toData.currentDebt || 0) + parseInt(debtAmount || 0)
            });
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
};

// 3. Driver -> Warehouse (Collection)
export const adminCollectAssets = async (driverId, stockToCollect, debtToCollect) => {
    const driverRef = doc(db, "users", driverId);
    try {
        await runTransaction(db, async (t) => {
            const d = await t.get(driverRef);
            if (!d.exists()) throw "Driver not found";
            
            const currentStock = d.data().currentStock || 0;
            const currentDebt = d.data().currentDebt || 0;

            const newStock = Math.max(0, currentStock - parseInt(stockToCollect || 0));
            const newDebt = Math.max(0, currentDebt - parseInt(debtToCollect || 0));

            t.update(driverRef, {
                currentStock: newStock,
                currentDebt: newDebt
            });
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
};

// --- USER & SCHEDULE ---

export const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, "users", userId), { accessStatus: newStatus });
};

export const resolveStockRequest = async (reqId) => {
    await updateDoc(doc(db, "stock_requests", reqId), { status: 'completed' });
};

export const dismissStockRequest = async (reqId) => {
    await deleteDoc(doc(db, "stock_requests", reqId));
};

export const assignShift = async (driverId, shiftData) => {
    const userRef = doc(db, "users", driverId);
    const userDoc = await getDoc(userRef);
    let shifts = userDoc.data().shifts || [];
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