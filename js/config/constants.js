export const ROLES = {
    ADMIN: 'admin',
    DRIVER: 'driver',
    BUYER: 'buyer'
};

export const STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    SUSPENDED: 'suspended'
};

// Pricing Logic: Standard (Linear) vs Deal (Discounted)
export const PRICING = {
    SINGLE_PRICE: 80, // Standard linear price base
    DEAL_TIERS: {
        1: 80,
        2: 150,
        3: 220,
        4: 280
    }
};

export const DRIVER_ECONOMICS = {
    PROFIT_PER_ITEM: 20, // Standard profit
    BASE_COST: 60 // What driver owes house per item
};