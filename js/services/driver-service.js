
import { db, doc, runTransaction, serverTimestamp, collection, addDoc } from './firebase.js';
import { calculateSaleMetrics } from '../utils/calculations.js';

/**
 * Records a sale: Updates User (Stock/Debt) and creates a Sale Record
 */
export const processSale = async (userId, quantity) => {
    const metrics = calculateSaleMetrics(quantity);
    const userRef = doc(db, "users", userId);
    const salesRef = collection(db, "sales");

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Get current user data
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User does not exist!";
            
            const userData = userDoc.data();
            const newStock = (userData.currentStock || 0) - quantity;
            const newDebt = (userData.currentDebt || 0) + metrics.debtIncrease;

            if (newStock < 0) {
                throw "Insufficient Stock!";
            }

            // 2. Update User Data
            transaction.update(userRef, {
                currentStock: newStock,
                currentDebt: newDebt
            });

            // 3. Create Sale Record (We can't return ID from transaction directly, but we write it)
            // Note: In Firestore transactions, write operations must come after reads.
            // Since 'addDoc' generates an ID automatically, we use a slightly different approach for transactions 
            // if we want strict consistency, but for sales logs, a batch or standard write is often okay. 
            // However, to be strict, we can generate a ref first.
            const newSaleRef = doc(salesRef); 
            transaction.set(newSaleRef, {
                driverId: userId,
                quantity: metrics.quantity,
                grossRevenue: metrics.grossRevenue,
                debtIncrease: metrics.debtIncrease,
                driverProfit: metrics.driverProfit,
                timestamp: serverTimestamp(),
                type: 'walk-up'
            });
        });
        return { success: true, metrics };
    } catch (error) {
        console.error("Sale Transaction Failed:", error);
        return { success: false, error: error };
    }
};

/**
 * Start Shift Logic
 */
export const startShift = async (userId) => {
    const shiftRef = collection(db, "shifts");
    const userRef = doc(db, "users", userId);
    
    // Create a new shift document
    const docRef = await addDoc(shiftRef, {
        driverId: userId,
        startTime: serverTimestamp(),
        status: 'open'
    });

    // Update user to know they are on a shift
    // (Optional: You might want to store currentShiftId on the user to prevent double starts)
    return docRef.id;
};