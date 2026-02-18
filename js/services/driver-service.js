import { db, doc, runTransaction, serverTimestamp, collection, addDoc, updateDoc, query, where, orderBy, onSnapshot, getDocs } from './firebase.js';
import { calculateSaleMetrics } from '../utils/calculations.js';

// --- SALES ---

export const processSale = async (userId, quantity, type = 'standard') => {
    // type: 'standard' or 'deal'
    const metrics = calculateSaleMetrics(quantity, type);
    const userRef = doc(db, "users", userId);
    const salesRef = collection(db, "sales");

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User does not exist!";
            
            const userData = userDoc.data();
            const newStock = (userData.currentStock || 0) - quantity;
            const newDebt = (userData.currentDebt || 0) + metrics.debtIncrease;

            if (newStock < 0) throw "Insufficient Stock!";

            transaction.update(userRef, {
                currentStock: newStock,
                currentDebt: newDebt
            });

            const newSaleRef = doc(salesRef); 
            transaction.set(newSaleRef, {
                driverId: userId,
                quantity: metrics.quantity,
                grossRevenue: metrics.grossRevenue,
                debtIncrease: metrics.debtIncrease,
                driverProfit: metrics.driverProfit,
                type: type, 
                timestamp: serverTimestamp()
            });
        });
        return { success: true, metrics };
    } catch (error) {
        console.error("Sale Failed:", error);
        return { success: false, error };
    }
};

// --- STATS & HISTORY ---

export const getDriverStats = async (userId) => {
    const q = query(
        collection(db, "sales"), 
        where("driverId", "==", userId),
        orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    const history = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Calculate Weekly Stats
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);

    let weeklyUnits = 0;
    let weeklyProfit = 0;

    history.forEach(sale => {
        if (sale.timestamp && sale.timestamp.toDate() >= startOfWeek) {
            weeklyUnits += sale.quantity;
            weeklyProfit += (sale.driverProfit || 0);
        }
    });
    
    return { history, weeklyUnits, weeklyProfit };
};

// --- MISC ---

export const requestStock = async (userId, userName) => {
    await addDoc(collection(db, "stock_requests"), {
        requesterUid: userId, requesterName: userName, status: 'pending', timestamp: serverTimestamp()
    });
};

export const saveVehicleInfo = async (userId, vehicleData) => {
    await updateDoc(doc(db, "users", userId), { vehicle: vehicleData });
};

export const requestCover = async (userId, userName, shiftData, coverStart, coverEnd) => {
    await addDoc(collection(db, "cover_requests"), {
        requesterUid: userId, requesterName: userName, 
        originalDate: shiftData.date, originalStart: shiftData.start, originalEnd: shiftData.end,
        coverStart, coverEnd, status: 'open', timestamp: serverTimestamp()
    });
};

export const subscribeToAllCoverRequests = (callback) => {
    const q = query(collection(db, "cover_requests"), where("status", "==", "open"));
    return onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reqs);
    });
};

export const acceptCoverRequest = async (reqId, accepterUid, accepterName) => {
    const reqRef = doc(db, "cover_requests", reqId);
    await updateDoc(reqRef, { status: 'filled', filledByUid: accepterUid, filledByName: accepterName });
    return { success: true };
};