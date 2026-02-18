import { PRICING, DRIVER_ECONOMICS } from '../config/constants.js';

export const calculateSaleMetrics = (quantity, isDeal = true) => {
    let grossRevenue;

    if (isDeal) {
        // Use Tiered Pricing (1=$80, 2=$150, etc.)
        grossRevenue = PRICING.DEAL_TIERS[quantity] || (quantity * PRICING.DEAL_TIERS[1]); // Fallback linear if > 4
    } else {
        // Use Standard Linear Pricing (1=$80, 2=$160)
        grossRevenue = quantity * PRICING.SINGLE_PRICE;
    }

    // Debt is always based on Base Cost ($60)
    const debtIncrease = quantity * DRIVER_ECONOMICS.BASE_COST;

    // Driver Profit is Revenue - Debt
    const driverProfit = grossRevenue - debtIncrease;

    return {
        quantity,
        grossRevenue,
        debtIncrease,
        driverProfit
    };
};