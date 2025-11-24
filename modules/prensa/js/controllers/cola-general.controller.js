import { ColaGeneralService } from '../services/cola.general.service.js';

export const ColaGeneralController = {
    // ESTADO DE PAGINACIÓN (Añadido)
    currentPage: 1,
    itemsPerPage: 10,
    allTasks: [], 

    init: async function() {
        console.log("ColaGeneralController (Prensa): Buscando OTs listas...");
        await this.loadTasks();
        this.setupEvents();
    },

    async loadTasks() {
        // Lógica original: Obtener todas las tareas
        const tasks = await ColaGeneralService.getIncomingTasks();
        this.allTasks = tasks || [];
        
        // Renderizar aplicando filtros y paginación
        this.applyFilters();
    },

    // LÓGICA DE FILTRADO Y PAGINACIÓN (Añadido)
    applyFilters() {
        const searchTerm = document.getElementById('search-general-input')?.value.toLowerCase() || '';
        
        const filtered = this.allTasks.filter(task => 
            (task.ot_id && task.ot_id.toLowerCase().includes(searchTerm)) || 
            (task.cliente && task.cliente.toLowerCase().includes(searchTerm)) ||
            (task.maquina && task.maquina.toLowerCase().includes(searchTerm))
        );

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedItems = filtered.slice(startIndex, endIndex);

        this.renderTable(paginatedItems);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderTable(tasks) {
        const tbody = document.getElementById('tasks-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (tasks.length === 0) {
            // Estilo Usuarios para mensaje vacío
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">No hay tareas pendientes provenientes de Pre-Prensa.</td></tr>';
            return;
        }

        tasks.forEach(task => {
            const row = `
                <tr class="hover:bg-gray-50 transition border-b last:border-0" data-id="${task.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${task.ot_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">${task.maquina}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.producto}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${task.estado}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button class="btn-take-task flex items-center justify-center mx-auto px-3 py-1 text-sm bg-[#E31B23] text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition">
                            <i data-lucide="user-plus" class="w-4 h-4 mr-1"></i> Tomar
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        if (window.lucide) window.lucide.createIcons();
    },

    // RENDERIZADO DE PAGINACIÓN (Añadido)
    renderPagination(totalItems, startItem, endItem, totalPages) {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        if (totalItems === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500">No hay resultados.</span>';
            return;
        }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> tareas
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
                this.applyFilters();
            }
        });

        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.applyFilters();
            }
        });
    },

    setupEvents() {
        // Evento de Búsqueda (Añadido)
        document.getElementById('search-general-input')?.addEventListener('input', () => {
            this.currentPage = 1;
            this.applyFilters();
        });

        document.getElementById('tasks-table-body')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-take-task');
            if (btn) {
                const tr = btn.closest('tr');
                const id = tr.dataset.id;
                
                // Lógica de Negocio Original
                btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4"></i>';
                await ColaGeneralService.assignTaskToMe(id);
                
                window.UI.showNotification('Tarea Asignada', 'OT movida a "Mis Tareas de Prensa".');
                
                // Actualizar la vista (Eliminar fila y recargar paginación)
                tr.remove();
                await this.loadTasks(); 
            }
        });
    }
};