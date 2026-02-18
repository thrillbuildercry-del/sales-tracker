import { 
    db, collection, addDoc, query, where, onSnapshot, 
    serverTimestamp, doc, updateDoc, orderBy 
} from './firebase.js';

const ORDERS_REF = collection(db, 'orders');

// --- BUYER ACTIONS ---

export const createOrder = async (buyerId, quantity, address, priceInfo) => {
    try {
        await addDoc(ORDERS_REF, {
            buyerId,
            quantity: parseInt(quantity),
            totalPrice: priceInfo.grossRevenue,
            deliveryAddress: address,
            status: 'pending', 
            assignedDriverId: null,
            createdAt: serverTimestamp(),
            driverName: null,
            eta: null,
            vehicle: null
        });
        return { success: true };
    } catch (error) {
        console.error("Error creating order:", error);
        return { success: false, error: error.message };
    }
};

export const subscribeToMyOrders = (buyerId, callback) => {
    const q = query(ORDERS_REF, where("buyerId", "==", buyerId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

// --- DRIVER ACTIONS ---

export const acceptOrder = async (orderId, driverId, driverName, vehicleString, eta) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
        status: 'accepted',
        assignedDriverId: driverId,
        driverName: driverName,
        vehicle: vehicleString,
        eta: eta,
        acceptedAt: serverTimestamp()
    });
};

export const markArrived = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status: 'arrived' });
};

export const completeOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
        status: 'completed',
        deliveredAt: serverTimestamp()
    });
};

export const subscribeToPendingOrders = (callback) => {
    const q = query(ORDERS_REF, where("status", "==", "pending"));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const subscribeToDriverActiveOrders = (driverId, callback) => {
    const q = query(
        ORDERS_REF, 
        where("assignedDriverId", "==", driverId),
        where("status", "in", ["accepted", "arrived"])
    );
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

// --- ADMIN ACTIONS ---

export const assignDriverToOrder = async (orderId, driverId, driverName) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
        status: 'assigned', // Maps to 'accepted' logic in driver view
        assignedDriverId: driverId,
        driverName: driverName,
        assignedAt: serverTimestamp()
    });
};