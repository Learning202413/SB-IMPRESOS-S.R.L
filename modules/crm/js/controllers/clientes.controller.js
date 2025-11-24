/**
 * js/controllers/clientes.controller.js
 * Controlador para la vista de lista de clientes.
 * ACTUALIZADO: Paginación idéntica a Usuarios (Lógica y Visual).
 */
import { ClientesService } from '../services/clientes.service.js';

export const ClientesController = {
    currentPage: 1,
    itemsPerPage: 10,

    init: async function() {
        console.log("ClientesController (CRM) inicializado.");
        await this.loadAndRender();
        this.setupEvents();
    },

    async loadAndRender() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        
        // 1. Obtener todos los datos
        const allClients = await ClientesService.getAllClients();

        // 2. Filtrar
        const filtered = allClients.filter(c => 
            c.razon_social.toLowerCase().includes(searchTerm) || 
            c.ruc.includes(searchTerm) ||
            c.nombre_contacto.toLowerCase().includes(searchTerm)
        );

        // 3. Lógica de Paginación (Cálculos)
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        // Ajustar página actual si se sale de rango
        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        
        // 4. Cortar los datos para la página actual
        const paginatedClients = filtered.slice(startIndex, endIndex);

        // 5. Renderizar
        this.renderTable(paginatedClients);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderTable(clients) {
        const tbody = document.getElementById('client-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">No se encontraron clientes con los filtros actuales.</td></tr>';
            return;
        }

        clients.forEach(client => {
            const isNatural = (client.tipo_persona === 'NATURAL') || (!client.tipo_persona && client.ruc.length === 8);
            
            const tipoBadge = isNatural 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Persona</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Empresa</span>`;

            const initial = client.razon_social ? client.razon_social.charAt(0).toUpperCase() : '?';

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150" data-client-id="${client.id}">
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200 mr-3 flex-shrink-0">
                                ${initial}
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">${client.razon_social}</div>
                            </div>
                        </div>
                    </td>
                    
                    <td class="px-6 py-4">
                        ${tipoBadge}
                    </td>

                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">
                         <div class="flex items-center">
                            <i data-lucide="hash" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${client.ruc}
                        </div>
                    </td>
                    
                    <td class="px-6 py-4 text-sm text-gray-700">
                        <div class="flex items-center">
                            <i data-lucide="user" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${client.nombre_contacto || '-'}
                        </div>
                    </td>
                    
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="flex items-center">
                            <i data-lucide="mail" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${client.email || '-'}
                        </div>
                    </td>
                    
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-center space-x-2">
                            <a href="#/cliente-detalle/${client.id}" class="inline-flex items-center justify-center text-blue-600 p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition" title="Editar">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </a>
                            <button class="text-red-600 p-2 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition btn-delete" title="Eliminar" 
                                data-client-id="${client.id}" 
                                data-client-name="${client.razon_social}"
                                data-client-ruc="${client.ruc}">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });

        if (window.lucide) window.lucide.createIcons();
    },

    // --- NUEVA LÓGICA DE PAGINACIÓN (Idéntica a Usuarios) ---
    renderPagination(totalItems, startItem, endItem, totalPages) {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        if (totalItems === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500">No hay resultados.</span>';
            return;
        }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> clientes
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
        const searchInput = document.getElementById('search-input');
        // Resetear a página 1 cuando se busca
        searchInput?.addEventListener('input', () => {
            this.currentPage = 1; 
            this.loadAndRender();
        });

        const tableBody = document.getElementById('client-table-body');
        tableBody?.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.btn-delete');
            if (deleteButton) {
                const { clientId, clientName, clientRuc } = deleteButton.dataset;
                const docLabel = (clientRuc && clientRuc.length === 8) ? 'DNI' : 'RUC';
                
                const confirmHtml = `
                    <p class="text-gray-500 text-sm mb-5">
                        ¿Estás seguro de que deseas eliminar a este cliente? Esta acción no se puede deshacer.
                    </p>
                    <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center text-left mb-4 shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-gray-400 border border-gray-200 mr-3 flex-shrink-0 font-bold text-xs">
                            <i data-lucide="building-2" class="w-5 h-5 text-red-400"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800 leading-tight">${clientName}</p>
                            <p class="text-xs text-gray-500 mt-0.5">${docLabel}: ${clientRuc}</p>
                        </div>
                    </div>
                `;

                window.UI.showConfirmModal(
                    'Eliminar Cliente',
                    confirmHtml,
                    'Eliminar',
                    async () => {
                        await ClientesService.deleteClient(clientId);
                        window.UI.showNotification('Atención', 'Cliente eliminado correctamente.');
                        this.loadAndRender();
                    }
                );
            }
        });
    }
};