/**
 * js/controllers/ordenes.controller.js
 * Controlador Actualizado:
 * - Paginación idéntica a Usuarios.
 * - VISUAL: Alineación perfecta (Fix del "Ojo Bailarín").
 * - LÓGICA: Se agrega un placeholder invisible cuando no hay check para mantener la grilla.
 */
import { OrdenesService } from '../services/ordenes.service.js';

export const OrdenesController = {
    // Estado
    currentTab: 'activas',
    currentPage: 1,
    itemsPerPage: 10,
    
    init: async function() {
        console.log("OrdenesController (CRM) inicializado.");
        this.setupTabs();
        await this.loadAndRender();
        this.setupEvents();
    },

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Reset visual
                tabButtons.forEach(btn => {
                    btn.classList.remove('tab-active', 'border-red-600', 'text-red-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                tabContents.forEach(content => content.classList.add('hidden'));

                // Activar actual
                const tabId = e.currentTarget.dataset.tab;
                e.currentTarget.classList.remove('border-transparent', 'text-gray-500');
                e.currentTarget.classList.add('tab-active', 'border-red-600', 'text-red-600');
                document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
                
                this.currentTab = tabId;
                this.currentPage = 1; 
                this.loadAndRender();
            });
        });
        const defaultTab = document.querySelector('[data-tab="activas"]');
        if (defaultTab) defaultTab.click();
    },

    async loadAndRender() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const allOrders = await OrdenesService.getAllOrders();

        const productionStates = [
            'Orden creada', 
            'Diseño Pendiente', 'En diseño', 'En Aprobación de Cliente', 'Diseño Aprobado', 'Cambios Solicitados', 'En Pre-prensa',
            'Asignada a Prensa', 'En Preparación', 'Imprimiendo', 'En proceso', 'En prensa',
            'En Post-Prensa', 'En Acabados', 'En Control de Calidad'
        ];

        let filteredByTab = [];

        if (this.currentTab === 'activas') {
            filteredByTab = allOrders.filter(o => ['Nueva', 'En Negociación'].includes(o.estado));
        } else if (this.currentTab === 'ots') {
            filteredByTab = allOrders.filter(o => productionStates.includes(o.estado));
        } else if (this.currentTab === 'completadas') {
            filteredByTab = allOrders.filter(o => o.estado === 'Completado');
        } else if (this.currentTab === 'rechazadas') {
            filteredByTab = allOrders.filter(o => ['Rechazada', 'Cancelada'].includes(o.estado));
        }

        const filteredData = filteredByTab.filter(o => 
            (o.codigo && o.codigo.toLowerCase().includes(searchTerm)) || 
            (o.cliente_nombre && o.cliente_nombre.toLowerCase().includes(searchTerm)) ||
            (o.ot_id && o.ot_id.toLowerCase().includes(searchTerm))
        );
        
        // Paginación
        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        this.renderTable(paginatedData);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderTable(orders) {
        const activeTabEl = document.getElementById(`tab-${this.currentTab}`);
        const tbody = activeTabEl?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (orders.length === 0) {
            const colSpan = (this.currentTab === 'ots' || this.currentTab === 'completadas') ? 6 : 7;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-8 text-gray-500 italic bg-gray-50">No se encontraron registros en esta sección.</td></tr>`;
            return;
        }

        orders.forEach(order => {
            const productsSummary = order.items ? order.items.map(i => i.producto).join(', ') : 'Sin items';
            const itemsCount = order.items ? order.items.length : 0;
            
            // --- BADGES ---
            let displayEstado = order.estado;
            const getBadge = (colorClass, text) => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${text}</span>`;
            let badgeHTML = '';

            const estadosPreprensa = ['Diseño Pendiente', 'En diseño', 'En Aprobación de Cliente', 'Diseño Aprobado', 'Cambios Solicitados', 'Orden creada'];
            const estadosPrensa = ['Asignada a Prensa', 'En Preparación', 'Imprimiendo', 'En proceso'];
            const estadosPost = ['En Post-Prensa', 'En Acabados', 'En Control de Calidad'];

            if (estadosPreprensa.includes(order.estado)) displayEstado = 'En Pre-prensa';
            else if (estadosPrensa.includes(order.estado)) displayEstado = 'En Prensa';
            else if (estadosPost.includes(order.estado)) displayEstado = 'En Post-Prensa';

            switch (displayEstado) {
                case 'Nueva': case 'En Negociación': badgeHTML = getBadge('bg-yellow-100 text-yellow-800 border border-yellow-200', displayEstado); break;
                case 'En Pre-prensa': badgeHTML = getBadge('bg-purple-100 text-purple-800 border border-purple-200', 'En Pre-prensa'); break;
                case 'En Prensa': badgeHTML = getBadge('bg-indigo-100 text-indigo-800 border border-indigo-200', 'En Prensa'); break;
                case 'En Post-Prensa': badgeHTML = getBadge('bg-orange-100 text-orange-800 border border-orange-200', 'Post-Prensa'); break;
                case 'Completado': badgeHTML = getBadge('bg-green-100 text-green-800 border border-green-200', 'Completado'); break;
                case 'Rechazada': badgeHTML = getBadge('bg-red-100 text-red-800 border border-red-200', 'Rechazada'); break;
                default: badgeHTML = getBadge('bg-gray-100 text-gray-600 border border-gray-200', displayEstado);
            }
            
            // --- ACCIONES ESTANDARIZADAS ---
            
            // 1. Botón VER (Ojo) - w-8 h-8
            const btnView = `
                <a href="#/orden-detalle/${order.id}/view" 
                   class="h-8 w-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition" 
                   title="Ver Detalle">
                   <i data-lucide="eye" class="w-4 h-4"></i>
                </a>`;
            
            // 2. Botón EDITAR (Lápiz) - w-8 h-8
            const btnEdit = `
                <a href="#/orden-detalle/${order.id}/edit" 
                   class="h-8 w-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition" 
                   title="Editar">
                   <i data-lucide="edit-3" class="w-4 h-4"></i>
                </a>`;

            // 3. Icono CHECK (Facturado) - w-8 h-8
            const iconCheck = `
                <div class="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center border border-green-100" title="Facturado">
                    <i data-lucide="check" class="w-4 h-4 text-green-600"></i>
                </div>`;
            
            // 4. PLACEHOLDER INVISIBLE (Para alinear cuando no hay check) - w-8 h-8
            const iconPlaceholder = `<div class="h-8 w-8"></div>`;

            let actionsHTML = '';

            if (this.currentTab === 'ots' || this.currentTab === 'completadas') {
                // LOGICA: Ojo + (Check O Espacio Vacío)
                actionsHTML = `<div class="flex items-center justify-center space-x-2">${btnView}`;
                
                if (order.estado_facturacion === 'Facturado') {
                     actionsHTML += iconCheck;
                } else {
                     actionsHTML += iconPlaceholder; // <--- AQUÍ ESTÁ EL TRUCO DE ALINEACIÓN
                }
                actionsHTML += `</div>`;

            } else if (this.currentTab === 'rechazadas') {
                // Solo Ojo
                actionsHTML = `<div class="flex items-center justify-center">${btnView}</div>`;

            } else {
                // Activas: Editar + Ojo
                actionsHTML = `<div class="flex items-center justify-center space-x-2">${btnEdit}${btnView}</div>`;
            }

            const totalVal = order.total ? parseFloat(order.total).toFixed(2) : '0.00';
            let columnsHTML = '';
            
            if (this.currentTab === 'ots' || this.currentTab === 'completadas') {
                let displayId = order.ot_id;
                if (!displayId || displayId === 'PENDIENTE') displayId = order.codigo;

                columnsHTML = `
                    <td class="px-6 py-4"><div class="flex items-center"><i data-lucide="hash" class="w-3 h-3 mr-1.5 text-gray-400"></i><span class="text-sm font-bold text-gray-900">${displayId}</span></div></td>
                    <td class="px-6 py-4"><div class="flex items-center"><div class="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 mr-2">${order.cliente_nombre ? order.cliente_nombre.charAt(0).toUpperCase() : '?'}</div><span class="text-sm font-medium text-gray-700">${order.cliente_nombre || 'Sin Nombre'}</span></div></td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${productsSummary}">${itemsCount} línea(s) <span class="text-gray-400 text-xs">(${productsSummary})</span></td>
                    <td class="px-6 py-4 text-sm font-bold text-gray-900">S/ ${totalVal}</td>
                    <td class="px-6 py-4">${badgeHTML}</td>
                `;
            } else {
                columnsHTML = `
                    <td class="px-6 py-4"><div class="flex items-center"><i data-lucide="file-text" class="w-3 h-3 mr-1.5 text-gray-400"></i><span class="text-sm font-bold text-gray-900">${order.codigo || '-'}</span></div></td>
                    <td class="px-6 py-4"><div class="flex items-center"><div class="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 mr-2">${order.cliente_nombre ? order.cliente_nombre.charAt(0).toUpperCase() : '?'}</div><span class="text-sm font-medium text-gray-700">${order.cliente_nombre || 'Sin Nombre'}</span></div></td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${productsSummary}">${itemsCount} línea(s) <span class="text-gray-400 text-xs">(${productsSummary})</span></td>
                    <td class="px-6 py-4 text-sm font-bold text-gray-900">S/ ${totalVal}</td>
                    <td class="px-6 py-4 text-sm text-gray-500"><div class="flex items-center"><i data-lucide="calendar" class="w-3 h-3 mr-1.5 text-gray-400"></i>${order.fecha_creacion || '-'}</div></td>
                    <td class="px-6 py-4">${badgeHTML}</td>
                `;
            }

            const row = `<tr class="hover:bg-gray-50 group transition-colors duration-150">${columnsHTML}<td class="px-6 py-4 whitespace-nowrap text-center">${actionsHTML}</td></tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });

        if (window.lucide) window.lucide.createIcons();
    },

    renderPagination(totalItems, startItem, endItem, totalPages) {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        if (totalItems === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500">No hay resultados.</span>';
            return;
        }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> registros
            </div>
            <div class="flex space-x-2">
                <button id="btn-prev-page" class="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="px-3 py-1 text-sm font-medium text-gray-700">Página ${this.currentPage}</span>
                <button id="btn-next-page" class="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        if(window.lucide) window.lucide.createIcons();

        document.getElementById('btn-prev-page')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadAndRender();
            }
        });

        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.loadAndRender();
            }
        });
    },

    setupEvents() {
        document.getElementById('search-input')?.addEventListener('input', () => {
            this.currentPage = 1; 
            this.loadAndRender();
        });
    }
};