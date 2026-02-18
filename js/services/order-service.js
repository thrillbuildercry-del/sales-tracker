import { 
    db, collection, addDoc, query, where, onSnapshot, 
    serverTimestamp, doc, updateDoc, orderBy 
} from './firebase.js';

const ORDERS_REF = collection(db, 'orders');

/**
 * Buyer: Create a new order
 */
export const createOrder = async (buyerId, quantity, address, priceInfo) => {
    try {
        await addDoc(ORDERS_REF, {
            buyerId,
            quantity: parseInt(quantity),
            totalPrice: priceInfo.grossRevenue,
            deliveryAddress: address,
            status: 'pending', // pending -> assigned -> delivered -> cancelled
            assignedDriverId: null,
            createdAt: serverTimestamp(),
            driverName: null
        });
        return { success: true };
    } catch (error) {
        console.error("Error creating order:", error);
        return { success: false, error };
    }
};

/**
 * Buyer: Listen to MY orders
 * NOTE: If this fails, check console for "Index Required" link.
 */
export const subscribeToMyOrders = (buyerId, callback) => {
    const q = query(
        ORDERS_REF, 
        where("buyerId", "==", buyerId),
        orderBy("createdAt", "desc") 
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

/**
 * Admin: Listen to ALL Pending orders
 */
export const subscribeToPendingOrders = (callback) => {
    const q = query(ORDERS_REF, where("status", "==", "pending"));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

/**
 * Admin: Assign Driver to Order
 */
export const assignDriverToOrder = async (orderId, driverId, driverName) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
        status: 'assigned',
        assignedDriverId: driverId,
        driverName: driverName,
        assignedAt: serverTimestamp()
    });
};

/**
 * Driver: Listen to My Active Deliveries
 */
export const subscribeToDriverOrders = (driverId, callback) => {
    const q = query(
        ORDERS_REF, 
        where("assignedDriverId", "==", driverId),
        where("status", "==", "assigned")
    );
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

/**
 * Driver: Complete Delivery
 */
export const completeOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
        status: 'delivered',
        deliveredAt: serverTimestamp()
    });
};