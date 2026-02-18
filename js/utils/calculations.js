import { PRICING, DRIVER_ECONOMICS } from '../config/constants.js';

export const calculateSaleMetrics = (quantity, type = 'deal') => {
    let grossRevenue;

    if (type === 'standard') {
        // Standard: Linear $80 per item
        grossRevenue = quantity * PRICING.SINGLE_PRICE;
    } else {
        // Deal: Tiered pricing (1=$80, 2=$150, 3=$220, 4=$280)
        // Fallback to linear calculation if quantity > 4 for safety
        grossRevenue = PRICING.DEAL_TIERS[quantity] || (quantity * PRICING.DEAL_TIERS[1]); 
    }

    // Debt is ALWAYS $60 per unit owed to boss
    const debtIncrease = quantity * DRIVER_ECONOMICS.BASE_COST;

    // Driver Profit = What they collected (Revenue) - What they owe (Debt)
    const driverProfit = grossRevenue - debtIncrease;

    return {
        quantity,
        grossRevenue,
        debtIncrease,
        driverProfit
    };
};