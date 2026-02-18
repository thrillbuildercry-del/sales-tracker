import { db, doc, runTransaction, serverTimestamp, collection, addDoc, updateDoc, getDoc } from './firebase.js';
import { calculateSaleMetrics } from '../utils/calculations.js';

// --- SALES & STOCK ---

export const processSale = async (userId, quantity, isDeal = true) => {
    // Determine metrics based on Deal vs Standard
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

// --- SETTINGS ---

export const saveVehicleInfo = async (userId, vehicleData) => {
    try {
        await updateDoc(doc(db, "users", userId), {
            vehicle: vehicleData
        });
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
};

// --- SHIFTS ---

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