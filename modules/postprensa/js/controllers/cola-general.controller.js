import { PostPrensaColaGeneralService } from '../services/cola-general.service.js';

export const ColaGeneralController = {
    // ESTADO DE PAGINACIÓN (Añadido)
    currentPage: 1,
    itemsPerPage: 10,
    allTasks: [], 

    init: async function() {
        console.log("ColaGeneralController (Post-Prensa) inicializado.");
        await this.loadTasks();
        this.setupEvents();
    },

    async loadTasks() {
        const tableBody = document.getElementById('tasks-table-body');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">Cargando tareas de Prensa...</td></tr>';

        // Lógica original: Obtener todas las tareas
        const tasks = await PostPrensaColaGeneralService.getIncomingTasks();
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
            (task.estacion && task.estacion.toLowerCase().includes(searchTerm))
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
            tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">No hay tareas pendientes de Acabados.</td></tr>`;
            return;
        }

        tasks.forEach(task => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition duration-150 group';
            row.dataset.otId = task.id;

            // Ícono actualizado a user-plus
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <i data-lucide="hash" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                        <span class="text-sm font-bold text-gray-900">${task.ot_id}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                    <div class="flex items-center">
                        <i data-lucide="layers" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                        ${task.estacion}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.producto}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Listo para Acabado</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button class="btn-take-task inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition transform active:scale-95 w-24">
                        <i data-lucide="user-plus" class="w-3 h-3 mr-1.5"></i> Tomar
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
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

        const tableBody = document.getElementById('tasks-table-body');
        if (tableBody) {
            tableBody.addEventListener('click', async (e) => {
                const takeButton = e.target.closest('.btn-take-task');
                if (takeButton) {
                    const row = takeButton.closest('tr');
                    const dbId = row.dataset.otId;
                    
                    // Lógica original para feedback visual y servicio
                    const originalContent = takeButton.innerHTML;
                    takeButton.disabled = true;
                    takeButton.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
                    if(window.lucide) window.lucide.createIcons();

                    try {
                        const success = await PostPrensaColaGeneralService.assignTaskToMe(dbId);

                        if (success) {
                            if(window.UI) window.UI.showNotification('Tarea Asignada', `Trabajo movido a Mis Tareas de Acabados.`);
                            
                            // Animación de Salida (Lógica original)
                            row.style.transition = "all 0.3s ease";
                            row.style.opacity = "0";
                            row.style.transform = "translateX(20px)";

                            setTimeout(async () => {
                                // Eliminar y recargar para actualizar paginación
                                row.remove();
                                await this.loadTasks(); 
                            }, 300);
                        } else {
                            throw new Error("Fallo al asignar");
                        }
                    } catch (err) {
                        takeButton.disabled = false;
                        takeButton.innerHTML = originalContent;
                        if(window.lucide) window.lucide.createIcons();
                        if(window.UI) window.UI.showNotification('Error', 'No se pudo tomar la tarea.');
                    }
                }
            });
        }
    }
};