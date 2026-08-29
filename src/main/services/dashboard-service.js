/**
 * Dashboard Service
 * Coordinates business rules and persistence for dashboard operations.
 */

const dashboardRepository = require('../repositories/dashboard-repository');
const logger = require('../utils/logger');

class DashboardService {
  async getStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const todayStats = await dashboardRepository.getSalesStats(today, new Date());
      const monthStats = await dashboardRepository.getSalesStats(monthStart, new Date());
      const inventoryStats = await dashboardRepository.getInventoryStats();
      const customerStats = await dashboardRepository.getCustomerStats();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStats = await dashboardRepository.getSalesStats(yesterday, today);
      
      const todayComparison = yesterdayStats.total > 0 
        ? ((todayStats.total - yesterdayStats.total) / yesterdayStats.total) * 100 
        : 0;

      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      const lastMonthStats = await dashboardRepository.getSalesStats(lastMonthStart, lastMonthEnd);
      
      const monthComparison = lastMonthStats.total > 0
        ? ((monthStats.total - lastMonthStats.total) / lastMonthStats.total) * 100
        : 0;

      return {
        today: {
          sales: todayStats.total,
          transactions: todayStats.count,
          comparison: todayComparison
        },
        month: {
          sales: monthStats.total,
          transactions: monthStats.count,
          comparison: monthComparison
        },
        inventory: {
          totalProducts: inventoryStats.totalProducts,
          lowStock: inventoryStats.lowStock,
          outOfStock: inventoryStats.outOfStock,
          totalValue: inventoryStats.totalValue
        },
        customers: {
          total: customerStats.total,
          newThisMonth: customerStats.newThisMonth
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard statistics:', error);
      throw error;
    }
  }

  async getChartData(period = 'last7days') {
    try {
      let daysToSubtract;
      
      switch (period) {
        case 'last7days':
        case 'week':
          daysToSubtract = 6;
          break;
        case 'month':
          daysToSubtract = 29;
          break;
        case 'year':
          daysToSubtract = 364;
          break;
        default:
          daysToSubtract = 6;
      }

      const data = await dashboardRepository.getSalesChartData(daysToSubtract);
      
      const total = data.reduce((sum, d) => sum + d.sales, 0);
      const average = total / data.length;

      // Format labels for display - show day abbreviations
      const formattedData = data.map((d, index) => {
        const date = new Date(d.date + 'T00:00:00Z');
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          ...d,
          displayLabel: dayLabel
        };
      });

      return {
        success: true,
        data: {
          labels: formattedData.map(d => d.displayLabel),
          sales: formattedData.map(d => d.sales),
          total,
          average
        }
      };
    } catch (error) {
      logger.error('Failed to get chart data:', error);
      throw error;
    }
  }

  async getTopProducts(limit = 10) {
    try {
      return await dashboardRepository.getTopProducts(limit);
    } catch (error) {
      logger.error('Failed to get top products:', error);
      throw error;
    }
  }

  async getLowStockProducts() {
    try {
      return await dashboardRepository.getLowStockProducts();
    } catch (error) {
      logger.error('Failed to get low stock products:', error);
      throw error;
    }
  }

  async getRecentSales(limit = 5) {
    try {
      return await dashboardRepository.getRecentSales(limit);
    } catch (error) {
      logger.error('Failed to get recent sales:', error);
      throw error;
    }
  }
}

module.exports = new DashboardService();
