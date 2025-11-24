/**
 * js/controllers/dashboard.controller.js
 * Controlador actualizado para mapear los nuevos KPIs:
 * Cotizaciones | En Producción | Rechazadas | Completadas
 */
import { DashboardService } from '../services/dashboard.service.js';

export const DashboardController = {
    init: async function() {
        console.log("DashboardController inicializado.");
        try {
            await this.loadKpis();
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error("Error cargando KPIs:", error);
        }
    },

    async loadKpis() {
        // 1. Obtener datos calculados
        const data = await DashboardService.getKpiStats();

        // 2. Referencias al DOM (IDs actualizados en dashboard.html)
        const elQuotes = document.getElementById('kpi-quotes');
        const elProduction = document.getElementById('kpi-production'); 
        const elRejected = document.getElementById('kpi-rejected');
        const elCompleted = document.getElementById('kpi-completed');

        // 3. Animar valores
        this.animateValue(elQuotes, 0, data.activeQuotes, 800);
        this.animateValue(elProduction, 0, data.activeProduction, 800);
        this.animateValue(elRejected, 0, data.totalRejected, 800);
        this.animateValue(elCompleted, 0, data.totalCompleted, 800);
    },

    animateValue(obj, start, end, duration) {
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.textContent = end;
            }
        };
        window.requestAnimationFrame(step);
    }
};