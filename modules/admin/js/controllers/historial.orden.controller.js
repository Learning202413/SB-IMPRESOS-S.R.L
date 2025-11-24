/**
 * js/controllers/historial.orden.controller.js
 * Controlador de UI para Trazabilidad.
 * INTEGRADO: Detección inteligente de RUC/DNI y usuarios.
 * ACTUALIZADO: Incluye notificaciones de éxito y error.
 */
import { HistorialOrdenService } from '../services/historial.orden.service.js';

export const HistorialOrdenController = {
    init: function() {
        console.log("HistorialOrdenController inicializado.");
        
        const searchButton = document.getElementById('btn-search-ot');
        const searchInput = document.getElementById('search-ot-input');

        if(searchButton && searchInput) {
            const performSearch = () => this.handleSearch(searchInput.value.trim());
            
            searchButton.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }
    },

    async handleSearch(query) {
        const panel = document.getElementById('trace-panel');
        const timelineContainer = document.getElementById('trace-timeline');
        const summaryContainer = document.getElementById('order-summary');

        if (!query) {
            const input = document.getElementById('search-ot-input');
            input.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
            setTimeout(() => input.classList.remove('ring-2', 'ring-red-500', 'bg-red-50'), 500);
            return;
        }

        // Feedback de carga
        if (panel) panel.classList.remove('hidden');
        if (timelineContainer) {
            timelineContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                    <div class="p-4 bg-gray-100 rounded-full mb-4 animate-pulse">
                        <i data-lucide="loader-2" class="w-8 h-8 animate-spin text-red-600"></i>
                    </div>
                    <span class="font-medium">Analizando historial de la orden...</span>
                </div>`;
            if(window.lucide) window.lucide.createIcons();
        }
        if (summaryContainer) summaryContainer.innerHTML = ''; 

        // Llamada al servicio
        const result = await HistorialOrdenService.getTraceabilityData(query);

        // No encontrado
        if (!result) {
            if (timelineContainer) {
                timelineContainer.innerHTML = `
                    <div class="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg shadow-md">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <i data-lucide="x-circle" class="w-8 h-8 text-red-600"></i>
                            </div>
                            <div class="ml-4">
                                <h3 class="text-lg font-bold text-red-800">Orden No Encontrada</h3>
                                <p class="text-red-700 mt-1">No existe ningún registro con el ID: <strong>${query}</strong></p>
                            </div>
                        </div>
                    </div>
                `;
                if(window.lucide) window.lucide.createIcons();
            }
            
            // --- NOTIFICACIÓN DE ERROR AGREGADA ---
            window.UI.showNotification('Error', `La orden ${query} no existe.`);
            // --------------------------------------
            return;
        }

        // Éxito
        const { ot, events } = result;
        this.renderSummary(ot, summaryContainer);
        this.renderTimeline(events, timelineContainer);

        // --- NOTIFICACIÓN DE ÉXITO AGREGADA ---
        window.UI.showNotification('Éxito', 'Historial de orden encontrado.');
        // --------------------------------------
    },

    renderSummary(ot, container) {
        if (!container) return;

        const isCompleted = ot.estado && (ot.estado.toLowerCase().includes('completado') || ot.estado.toLowerCase().includes('despacho'));
        const statusColor = isCompleted ? 'bg-green-600' : 'bg-red-600';
        const statusText = ot.estado ? ot.estado.toUpperCase() : 'EN PROCESO';
        
        // --- LOGICA INTELIGENTE: RUC vs DNI ---
        const idValue = String(ot.cliente_id || 'No registrado');
        const clientName = (ot.cliente_nombre || '').toUpperCase();
        
        let idType = 'DNI'; // Por defecto

        // 1. Por longitud (RUC es 11, pero aceptamos más por si es ID extranjero o especial como el tuyo)
        if (idValue.length >= 11) {
            idType = 'RUC';
        } 
        // 2. Por nombre de empresa (si contiene S.A., S.R.L., etc. es RUC fijo)
        else if (
            clientName.includes('S.A.') || 
            clientName.includes('S.R.L') || 
            clientName.includes('E.I.R.L') || 
            clientName.includes('S.A.C') ||
            clientName.includes('LTDA') ||
            clientName.includes('MUNICIPALIDAD')
        ) {
            idType = 'RUC';
        }

        container.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-2xl shadow-gray-200/50 border border-gray-100 animate-fade-in-up">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-4 mb-4">
                    <h3 class="text-xl font-bold text-gray-800 flex items-center">
                        <i data-lucide="clipboard-list" class="w-5 h-5 mr-3 text-red-600"></i>
                        Detalles de la Orden <span class="ml-2 text-gray-400 font-normal text-lg">#${ot.ot_id || ot.id}</span>
                    </h3>
                    <span class="px-4 py-1.5 mt-2 md:mt-0 rounded-full text-xs font-bold text-white ${statusColor} shadow-md tracking-wide">
                        Estado actual: ${statusText}
                    </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div class="flex items-start space-x-3">
                        <div class="mt-1 p-2 bg-gray-50 rounded-lg text-gray-400">
                            <i data-lucide="user" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-gray-500 font-medium text-xs uppercase tracking-wide">Cliente</p>
                            <p class="text-gray-900 font-bold text-base mt-0.5">${ot.cliente_nombre || 'Cliente General'}</p>
                        </div>
                    </div>
                    <div class="flex items-start space-x-3">
                        <div class="mt-1 p-2 bg-gray-50 rounded-lg text-gray-400">
                            <i data-lucide="tag" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-gray-500 font-medium text-xs uppercase tracking-wide">${idType}</p>
                            <p class="text-gray-900 font-bold text-base mt-0.5 font-mono">${idValue}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        if(window.lucide) window.lucide.createIcons();
    },

    renderTimeline(events, container) {
        container.innerHTML = '';

        if (events.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                    <i data-lucide="calendar-off" class="w-10 h-10 mx-auto mb-2 text-gray-400"></i>
                    <p>Orden registrada, pero sin eventos cronológicos detectados.</p>
                </div>`;
            if(window.lucide) window.lucide.createIcons();
            return;
        }

        const mapColorStyle = (colorName) => {
            const map = {
                blue:   'bg-blue-600 text-blue-100',
                green:  'bg-green-600 text-green-100',
                indigo: 'bg-indigo-600 text-indigo-100',
                purple: 'bg-purple-600 text-purple-100',
                orange: 'bg-orange-600 text-orange-100',
                red:    'bg-red-600 text-white',
                gray:   'bg-gray-600 text-gray-100',
                yellow: 'bg-yellow-500 text-yellow-100'
            };
            return map[colorName] || map['gray'];
        };

        // Borde ROJO de la línea
        let html = '<ul class="relative space-y-12 border-l-2 border-red-600 ml-4 md:ml-6">';
        
        events.forEach((evt, index) => {
            const style = mapColorStyle(evt.color);
            const detailHtml = evt.details 
                ? `<p class="text-xs text-gray-600 mt-2 border-t border-gray-100 pt-2">${evt.details}</p>` 
                : '';
            
            const animationStyle = `animation-delay: ${index * 0.1}s; animation-fill-mode: both;`;

            // Formato de fecha para mostrar en tarjeta
            let dateDisplay = evt.time;
            let timeDisplay = '';
            if (evt.time.includes(',')) {
                const parts = evt.time.split(',');
                dateDisplay = parts[0];
                timeDisplay = parts[1];
            } else if (evt.time.includes(' ')) {
                 const parts = evt.time.split(' ');
                 dateDisplay = parts[0];
                 timeDisplay = parts.slice(1).join(' ');
            }

            // Clases: Sombra fuerte, borde gris, hover rojo
            const cardClasses = "bg-white p-5 rounded-xl shadow-2xl shadow-gray-400/30 border border-gray-100 transition-all duration-300 hover:shadow-red-400/50 hover:border-red-600";

            html += `
                <li class="relative pb-4 group animate-fade-in-up" style="${animationStyle}">
                    <span class="absolute flex items-center justify-center w-8 h-8 ${style} rounded-full -left-4 ring-4 ring-white z-10 shadow-lg transition-transform duration-300 group-hover:scale-125">
                        <i data-lucide="${evt.icon}" class="w-4 h-4"></i>
                    </span>
                    
                    <div class="ml-8 ${cardClasses}">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                            <h4 class="font-bold text-lg text-gray-900">${evt.title}</h4>
                            <span class="text-xs font-mono text-gray-400 mt-1 sm:mt-0">
                                ${dateDisplay} <span class="text-gray-600 font-semibold ml-1">${timeDisplay}</span>
                            </span>
                        </div>
                        
                        <div class="flex items-center text-sm text-gray-500 mt-1">
                            <i data-lucide="user" class="w-3.5 h-3.5 mr-1.5 text-gray-400"></i>
                            <span class="font-medium">${evt.user}</span>
                        </div>

                        ${detailHtml}
                    </div>
                </li>
            `;
        });

        html += `
            <li class="relative pb-4 group animate-fade-in-up" style="animation-delay: ${events.length * 0.1 + 0.1}s; animation-fill-mode: both;">
                <span class="absolute flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-500 rounded-full -left-4 ring-4 ring-white z-10 shadow-lg">
                    <i data-lucide="check-check" class="w-4 h-4"></i>
                </span>
                <div class="ml-8 text-gray-400 text-xs uppercase tracking-widest font-semibold pt-1">
                    Fin del Historial
                </div>
            </li>
        </ul>`;

        container.innerHTML = html;
        if(window.lucide) window.lucide.createIcons();
    }
};