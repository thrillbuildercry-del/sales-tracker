import { db, doc, runTransaction, serverTimestamp, collection, addDoc, updateDoc, query, where, orderBy, onSnapshot, getDocs, deleteDoc } from './firebase.js';
import { calculateSaleMetrics } from '../utils/calculations.js';
import { DRIVER_ECONOMICS } from '../config/constants.js';

// --- SALES & STOCK ---

export const processSale = async (userId, quantity, isDeal = true) => {
    const metrics = calculateSaleMetrics(quantity, isDeal);
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
                type: isDeal ? 'deal' : 'standard',
                timestamp: serverTimestamp()
            });
        });
        return { success: true, metrics };
    } catch (error) {
        console.error("Sale Failed:", error);
        return { success: false, error };
    }
};

export const requestStock = async (userId, userName) => {
    try {
        await addDoc(collection(db, "stock_requests"), {
            requesterUid: userId,
            requesterName: userName,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

export const saveVehicleInfo = async (userId, vehicleData) => {
    try {
        await updateDoc(doc(db, "users", userId), { vehicle: vehicleData });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

// --- SHIFTS & COVER ---

export const requestCover = async (userId, userName, shiftData, coverStart, coverEnd) => {
    try {
        await addDoc(collection(db, "cover_requests"), {
            requesterUid: userId,
            requesterName: userName,
            originalDate: shiftData.date,
            originalStart: shiftData.start,
            originalEnd: shiftData.end,
            coverStart,
            coverEnd,
            status: 'open',
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

/**
 * Listen to ALL open cover requests (to show on calendar)
 */
export const subscribeToAllCoverRequests = (callback) => {
    const q = query(collection(db, "cover_requests"), where("status", "==", "open"));
    return onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reqs);
    });
};

/**
 * Accept a cover request (Take the shift)
 */
export const acceptCoverRequest = async (reqId, accepterUid, accepterName) => {
    const reqRef = doc(db, "cover_requests", reqId);
    
    // We use a transaction to ensure two people don't grab it at once
    try {
        await runTransaction(db, async (t) => {
            const reqDoc = await t.get(reqRef);
            if (!reqDoc.exists()) throw "Request not found";
            if (reqDoc.data().status !== 'open') throw "Shift already taken";

            // 1. Mark request as filled
            t.update(reqRef, {
                status: 'filled',
                filledByUid: accepterUid,
                filledByName: accepterName
            });

            // 2. Add shift to Accepter's roster
            // Note: This requires the Admin service logic to formally update the 'shifts' array.
            // For safety/permission rules, usually only Admin can write to 'users/{id}'.
            // However, assuming Driver has write access to their own 'shifts' or we use a cloud function:
            // We will do a direct update here for the MVP.
            const userRef = doc(db, "users", accepterUid);
            const userDoc = await t.get(userRef);
            const currentShifts = userDoc.data().shifts || [];
            
            const newShift = {
                date: reqDoc.data().originalDate,
                start: reqDoc.data().coverStart,
                end: reqDoc.data().coverEnd,
                type: 'covered'
            };
            
            t.update(userRef, { shifts: [...currentShifts, newShift] });
        });
        return { success: true };
    } catch (error) {
        console.error("Accept Cover Failed:", error);
        return { success: false, error };
    }
};

// --- STATS & HISTORY ---

export const getDriverStats = async (userId) => {
    // 1. Get Sales History
    const q = query(
        collection(db, "sales"), 
        where("driverId", "==", userId),
        orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    const history = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Calculate Weekly Stats
    // Assuming 'Week' starts Sunday. 
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);

    let weeklyUnits = 0;
    let weeklyProfit = 0;

    history.forEach(sale => {
        if (sale.timestamp && sale.timestamp.toDate() >= startOfWeek) {
            weeklyUnits += sale.quantity;
            weeklyProfit += (sale.driverProfit || (sale.quantity * DRIVER_ECONOMICS.PROFIT_PER_ITEM));
        }
    });

    // Prediction: Simple linear projection based on days passed?
    // Or just "Potential" based on the unit count provided in prompt ($20 per unit).
    // The prompt asks for "prediction for weekly profits (20 each unit sold)". 
    // We'll return the calculated current profit and maybe a target.
    
    return {
        history,
        weeklyUnits,
        weeklyProfit
    };
};