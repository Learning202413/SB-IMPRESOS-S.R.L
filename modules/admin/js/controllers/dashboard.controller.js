/**
 * js/controllers/dashboard.controller.js
 * Controlador para el Dashboard Gerencial.
 */
import { DashboardService } from '../services/dashboard.service.js';

export const DashboardController = {
    init: async function() {
        console.log("DashboardController (Admin): Inicializado.");
        
        try {
            // Carga de datos
            const kpis = await DashboardService.getKpiStats();
            const users = await DashboardService.getUsersStatus();
            const trendData = await DashboardService.getTrendData(); 
            
            // Renderizado
            this.updateKPIs(kpis);
            this.renderUserList(users);
            this.renderTrendChart(trendData); 

        } catch (error) {
            console.error("Error cargando el dashboard:", error);
        }
    },

    updateKPIs(kpis) {
        // Selectores de las tarjetas
        const alertEl = document.querySelector('.border-red-500 .text-4xl');    // Pendientes
        const completedEl = document.querySelector('.border-green-500 .text-4xl'); // Completadas Mes
        const onlineEl = document.querySelector('.border-blue-500 .text-4xl');    // Usuarios Online
        
        if (alertEl) alertEl.textContent = kpis.pendingOTs;
        
        // Ahora este valor viene directamente del array del gráfico
        if (completedEl) completedEl.textContent = kpis.completedOTsMonth;
        
        if (onlineEl) onlineEl.textContent = kpis.activeUsers;
    },

    renderUserList(users) {
        const listContainer = document.querySelector('.divide-y'); 
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        const onlineUsers = users.filter(u => u.status === 'Online');

        if (onlineUsers.length === 0) {
            listContainer.innerHTML = '<li class="py-4 text-center text-gray-500 text-sm italic">No hay usuarios conectados.</li>';
            return;
        }
        
        onlineUsers.forEach(u => {
            const html = `
                <li class="py-3 flex items-center justify-between group hover:bg-gray-50 transition px-2 rounded-lg">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 font-bold text-xs border border-green-200">
                            ${u.name.charAt(0)}
                        </div>
                        <div>
                            <p class="font-medium text-gray-800 text-sm truncate w-32" title="${u.name}">${u.name}</p>
                            <p class="text-[10px] text-gray-500 truncate w-32">${u.role}</p>
                        </div>
                    </div>
                    <span class="flex items-center text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full border border-green-100">
                        <span class="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                        Online
                    </span>
                </li>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });
    },

    renderTrendChart(data) {
        const chartContainer = document.querySelector('.h-64.flex.items-end'); 
        if (!chartContainer) return;

        chartContainer.innerHTML = ''; 

        // Evitar división por cero
        const maxCount = Math.max(...data.map(d => d.count)) || 1; 

        data.forEach((d, index) => {
            const heightPct = d.count === 0 ? 5 : Math.round((d.count / maxCount) * 100); 
            const isLast = index === data.length - 1;
            
            const barColor = isLast ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-400 hover:bg-blue-500';
            const labelColor = isLast ? 'text-gray-900 font-bold' : 'text-gray-500 font-medium';
            // Capitalizar primera letra del mes
            const labelText = d.label.charAt(0).toUpperCase() + d.label.slice(1); 

            const barHtml = `
                <div class="flex flex-col items-center flex-1 group cursor-pointer h-full justify-end">
                    <div class="relative w-full max-w-[3rem] ${barColor} transition-all duration-500 ease-out rounded-t-md shadow-sm" style="height: ${heightPct}%">
                        <div class="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            ${d.count} OTs
                            <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    </div>
                    <span class="text-xs ${labelColor} mt-3">${labelText}</span>
                </div>
            `;
            chartContainer.insertAdjacentHTML('beforeend', barHtml);
        });
    }
};