/**
 * js/controllers/dashboard.controller.js
 * Controlador para la vista del dashboard de inventario (KPIs).
 */
import { DashboardService } from '../services/dashboard.service.js';

export const DashboardController = {
    init: async function() {
        console.log("DashboardController (Inventario) inicializado.");
        await this.loadKPIs();
    },

    async loadKPIs() {
        const kpis = await DashboardService.getKPIs();

        // Actualizar DOM
        this.updateText('kpi-critical', kpis.criticalCount);
        this.updateText('kpi-pending-ocs', kpis.pendingOCs);
        this.updateText('kpi-total-items', kpis.totalItems);
        this.updateText('kpi-near-depletion', kpis.nearDepletion);
    },

    updateText(id, value) {
        const el = document.getElementById(id);
        if (el) {
            // Animación simple de conteo
            el.textContent = value;
            el.classList.add('animate-pulse');
            setTimeout(() => el.classList.remove('animate-pulse'), 500);
        }
    }
};