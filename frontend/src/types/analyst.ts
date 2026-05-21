export interface AnalystDashboardStats {
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    popularProducts: Array<{ name: string; orders_count: number; total_quantity: number; revenue: number }>;
}

export interface ReportSummary {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    uniqueCustomers: number;
}

export interface StatusStat {
    status: string;
    count: number;
    revenue: number;
    percentage: number;
}
