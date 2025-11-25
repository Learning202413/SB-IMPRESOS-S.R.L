/**
 * js/services/dashboard.service.js
 * Servicio que agrega datos de varios dominios (Producción, Usuarios) 
 * para el Dashboard Gerencial.
 * ACTUALIZADO: Sincronización total entre KPI y Gráfico de Tendencias.
 */
import { productionDB } from './production.db.js';
import { usersDB } from './users.db.js';

export const DashboardService = {
    
    async getKpiStats() {
        // 1. Obtenemos estadísticas generales
        const productionStats = await productionDB.getDashboardStats();
        const activeUserCount = await usersDB.getActiveUserCount();

        // 2. ESTRATEGIA DE SINCRONIZACIÓN:
        // Para que el KPI "OTs Completadas (Mes)" coincida EXACTAMENTE con el gráfico,
        // obtenemos los datos de tendencia y extraemos el valor del último mes.
        let completedMonthCount = 0;
        
        try {
            const trendData = await productionDB.getProductionTrend();
            
            // Si hay datos en el gráfico, tomamos el último (que corresponde al mes actual/reciente)
            if (trendData && trendData.length > 0) {
                const lastMonthData = trendData[trendData.length - 1];
                completedMonthCount = lastMonthData.count || 0;
            }
        } catch (e) {
            console.warn("No se pudo sincronizar KPI con tendencia:", e);
        }

        return {
            pendingOTs: productionStats.pendingOTs || 0,
            completedOTsMonth: completedMonthCount, // Dato sincronizado con el gráfico
            activeUsers: activeUserCount || 0
        };
    },

    async getUsersStatus() {
        return await usersDB.getUsers();
    },

    async getTrendData() {
        return await productionDB.getProductionTrend();
    }
};