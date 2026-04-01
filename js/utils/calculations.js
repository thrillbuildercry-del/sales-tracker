// js/utils/calculations.js
import { PRICING, DRIVER_ECONOMICS } from '../config/constants.js';

export const calculateSaleMetrics = (quantity) => {
    // 1. Get Revenue based on quantity (or default to linear if > 4)
    // Note: If quantity > 4, we assume a linear extension or prevent it. 
    // For now, let's assume standard pricing for 1-4, and linear extrapolation for 5+ based on single item?
    // Actually, looking at the pattern ($70 per extra item roughly), let's stick to the map or strict single price.
    // For safety, let's strictly use the map or a fallback.
    
    let grossRevenue = PRICING[quantity] || (quantity * PRICING[1]);

    // 2. Calculate Debt (What the driver owes the house)
    const debtIncrease = quantity * DRIVER_ECONOMICS.BASE_COST;

    // 3. Calculate Driver Profit
    const driverProfit = quantity * DRIVER_ECONOMICS.PROFIT_PER_ITEM;

    return {
        quantity,
        grossRevenue,
        debtIncrease,
        driverProfit
    };
};