import { ColaGeneralService } from '../services/cola.general.service.js';

// Helper seguro para notificaciones
const notify = (title, message) => {
    if (window.UI && typeof window.UI.showNotification === 'function') {
        window.UI.showNotification(title, message);
    } else {
        console.log(`[${title}] ${message}`);
    }
};

export const ColaGeneralController = {
    // 1. Estado de Paginación
    currentPage: 1,
    itemsPerPage: 10,
    allTasks: [], 

    init: async function() {
        console.log("ColaGeneralController (Pre-Prensa): Iniciando...");
        await this.loadTasks();
        this.setupEvents();
    },

    async loadTasks() {
        const tableBody = document.getElementById('tasks-table-body');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500 italic bg-gray-50">Cargando tareas del CRM...</td></tr>';
        
        try {
            // Llamada al servicio original
            const tasks = await ColaGeneralService.getUnassignedTasks();
            this.allTasks = tasks || [];
            
            // Aplicar filtros y paginación en lugar de renderizar directo
            this.applyFilters();

        } catch (error) {
            console.error("Error cargando tareas:", error);
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 italic bg-red-50">Error de conexión. Intente recargar.</td></tr>`;
        }
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-general-input')?.value.toLowerCase() || '';
        
        const filtered = this.allTasks.filter(task => 
            (task.ot_id && task.ot_id.toLowerCase().includes(searchTerm)) || 
            (task.cliente && task.cliente.toLowerCase().includes(searchTerm))
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
        const tableBody = document.getElementById('tasks-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (tasks.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic bg-gray-50">No hay OTs nuevas ("Orden creada") en el CRM.</td></tr>`;
            return;
        }

        tasks.forEach(task => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition duration-150 group';
            row.dataset.otId = task.id; 

            // ICONO ACTUALIZADO a user-plus
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <i data-lucide="hash" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                        <span class="text-sm font-bold text-gray-900">${task.ot_id || 'PENDIENTE'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                    <div class="flex items-center">
                        <i data-lucide="file-image" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                        ${task.producto}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Nueva (CRM)</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button type="button" class="btn-take-task inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition transform active:scale-95 w-24">
                        <i data-lucide="user-plus" class="w-3 h-3 mr-1.5"></i> Tomar
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
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

        // Listeners de paginación
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
        // Evento de Búsqueda
        document.getElementById('search-general-input')?.addEventListener('input', () => {
            this.currentPage = 1;
            this.applyFilters();
        });

        // Event delegation para "Tomar Tarea" (Lógica original intacta)
        const tableBody = document.getElementById('tasks-table-body');
        if (tableBody) {
            // Clonar para limpiar listeners previos
            const newBody = tableBody.cloneNode(true);
            tableBody.parentNode.replaceChild(newBody, tableBody);
            
            newBody.addEventListener('click', async (e) => {
                const takeButton = e.target.closest('.btn-take-task');
                
                if (takeButton) {
                    e.preventDefault();
                    const row = takeButton.closest('tr');
                    const dbId = row.dataset.otId;

                    if (!dbId) {
                        notify('Error', 'ID de tarea no válido.');
                        return;
                    }
                    
                    const originalContent = takeButton.innerHTML;
                    takeButton.disabled = true;
                    takeButton.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
                    if(window.lucide) window.lucide.createIcons();

                    try {
                        const success = await ColaGeneralService.assignTaskToMe(dbId);

                        if (success) {
                            notify('Tarea Asignada', `OT asignada correctamente. Revisa "Mis Tareas".`);
                            
                            row.style.transition = "all 0.5s ease";
                            row.style.opacity = "0";
                            row.style.transform = "translateX(50px)";

                            setTimeout(async () => {
                                // Recargamos para actualizar la paginación correctamente
                                await this.loadTasks();
                            }, 500);
                        } else {
                            throw new Error("La asignación falló en el servidor.");
                        }
                    } catch (err) {
                        console.error(err);
                        takeButton.disabled = false;
                        takeButton.innerHTML = originalContent;
                        if(window.lucide) window.lucide.createIcons();
                        notify('Error', 'No se pudo tomar la tarea. Verifique su conexión.');
                    }
                }
            });
        }
    }
};