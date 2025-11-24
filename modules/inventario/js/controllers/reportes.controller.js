/**
 * js/controllers/reportes.controller.js
 * Controlador para la vista de reportes de inventario.
 * ACTUALIZADO: Gráfico ABC y Tabla de Alertas.
 */
import { ReportesService } from '../services/reportes.service.js';

export const ReportesController = {
    init: async function() {
        console.log("ReportesController (Inventario) inicializado.");
        await this.loadReports();
    },

    async loadReports() {
        // 1. Cargar estadísticas generales
        const invStats = await ReportesService.getInventoryStats();
        const purchStats = await ReportesService.getPurchaseStats();

        // 2. Cargar datos para el gráfico ABC
        const abcStats = await ReportesService.getABCStats();
        this.renderABCChart(abcStats);

        // 3. Cargar datos de "Próximos a Agotar"
        const nearDepletionItems = await ReportesService.getNearDepletionItems();
        this.renderNearDepletionTable(nearDepletionItems);

        // 4. Actualizar Métricas numéricas
        this.setText('metric-idle-c', invStats.idleC);
        this.setText('metric-freq', purchStats.purchaseFrequency);
        this.setText('metric-cycle', `${purchStats.cycleTime} días`);

        // 5. Renderizar Tabla de Reposición (Stock Crítico)
        this.renderReplenishmentTable(invStats.replenishmentList);
    },

    setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    },

    // --- NUEVO: Renderizar Gráfico Circular ABC ---
    renderABCChart(stats) {
        const chartContainer = document.getElementById('abc-chart-container');
        const legendContainer = document.getElementById('abc-legend');
        
        if (!chartContainer || !legendContainer) return;

        // Calcular grados para el conic-gradient
        const pctA = parseFloat(stats.percentages.A);
        const pctB = parseFloat(stats.percentages.B);
        const pctC = parseFloat(stats.percentages.C);

        // Colores: A=Azul, B=Verde, C=Naranja/Gris
        const colorA = '#3b82f6'; // blue-500
        const colorB = '#22c55e'; // green-500
        const colorC = '#f97316'; // orange-500

        // Construir el gradiente dinámico
        // A va de 0% a pctA%
        // B va de pctA% a (pctA + pctB)%
        // C llena el resto
        const gradient = `conic-gradient(
            ${colorA} 0% ${pctA}%, 
            ${colorB} ${pctA}% ${pctA + pctB}%, 
            ${colorC} ${pctA + pctB}% 100%
        )`;

        // Inyectar HTML del gráfico
        chartContainer.innerHTML = `
            <div class="relative w-48 h-48 rounded-full shadow-inner" style="background: ${gradient};">
                <div class="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex items-center justify-center flex-col">
                    <span class="text-2xl font-bold text-gray-800">${stats.total}</span>
                    <span class="text-xs text-gray-500 uppercase">Items</span>
                </div>
            </div>
        `;

        // Inyectar Leyenda
        legendContainer.innerHTML = `
            <div class="flex items-center justify-between text-sm">
                <div class="flex items-center"><span class="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>Clase A</div>
                <span class="font-bold text-gray-700">${pctA}% (${stats.counts.A})</span>
            </div>
            <div class="flex items-center justify-between text-sm mt-2">
                <div class="flex items-center"><span class="w-3 h-3 rounded-full bg-green-500 mr-2"></span>Clase B</div>
                <span class="font-bold text-gray-700">${pctB}% (${stats.counts.B})</span>
            </div>
            <div class="flex items-center justify-between text-sm mt-2">
                <div class="flex items-center"><span class="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Clase C</div>
                <span class="font-bold text-gray-700">${pctC}% (${stats.counts.C})</span>
            </div>
        `;
    },

    // --- NUEVO: Renderizar Tabla "Próximos a Agotar" ---
    renderNearDepletionTable(list) {
        const container = document.getElementById('near-depletion-list');
        if (!container) return;

        container.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 py-6">
                    <i data-lucide="check-circle" class="w-10 h-10 mb-2 text-green-200"></i>
                    <p class="text-sm">Niveles de stock estables.</p>
                </div>`;
        } else {
            const table = document.createElement('table');
            table.className = 'min-w-full text-sm';
            table.innerHTML = `
                <thead class="bg-orange-50 text-orange-800">
                    <tr>
                        <th class="text-left py-2 px-2 rounded-l-lg">Producto</th>
                        <th class="text-center py-2 px-2">Inv. Actual</th>
                        <th class="text-center py-2 px-2">Mínimo</th>
                        <th class="text-right py-2 px-2 rounded-r-lg">Estado</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-orange-100"></tbody>
            `;
            
            const tbody = table.querySelector('tbody');

            list.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-orange-50/50 transition';
                row.innerHTML = `
                    <td class="py-3 px-2">
                        <div class="font-bold text-gray-800">${item.nombre}</div>
                        <div class="text-xs text-gray-500">SKU: ${item.sku}</div>
                    </td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700">${item.stock}</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-500">${item.min}</td>
                    <td class="py-3 px-2 text-right">
                        <div class="flex flex-col items-end">
                            <span class="text-xs font-bold text-orange-600">${item.healthPct}% del Mín</span>
                            <span class="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 mt-1 flex items-center">
                                ⚠️ Atención
                            </span>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            container.appendChild(table);
        }
        if(window.lucide) window.lucide.createIcons();
    },

    renderReplenishmentTable(list) {
        const tbody = document.getElementById('replenishment-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-green-600 bg-green-50 rounded-lg border border-green-100">¡Todo el stock está saludable!</td></tr>';
            return;
        }

        list.forEach(item => {
            const row = `
                <tr class="border-b hover:bg-red-50 transition last:border-0">
                    <td class="py-3 px-2 text-gray-800">
                        <div class="font-bold">${item.producto}</div>
                        <div class="text-xs text-gray-500 font-mono">${item.sku}</div>
                    </td>
                    <td class="py-3 px-2 text-right">
                        <span class="font-bold text-red-600 text-lg">-${item.deficit}</span>
                        <span class="text-xs text-red-400 font-normal block">unidades</span>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
    }
};