import { ColaService } from '../services/cola.service.js';

export const ColaController = {
    // Estado Paginación
    currentPage: 1,
    itemsPerPage: 10,
    myTasks: [],

    init: async function() {
        console.log("ColaController: Cargando mis tareas...");
        
        // Setup Search
        document.getElementById('search-input')?.addEventListener('input', () => {
            this.currentPage = 1;
            this.applyFilters();
        });

        await this.loadTasks();
        window.startTask = this.startTask.bind(this);
    },

    async loadTasks() {
        let tasks = await ColaService.getMyTasks();

        // Mock de respaldo (Lógica original)
        if (!tasks || tasks.length === 0) {
            tasks = [
                { id: '1', ot_id: 'OT-1234', cliente: 'Industrias Gráficas S.A.', producto: '1000 Revistas A4', fecha_creacion: '16 nov 2025, 17:01', estado: 'Diseño Pendiente', badgeColor: 'bg-blue-100 text-blue-800' },
                { id: '2', ot_id: 'OT-1235', cliente: 'Editorial Futuro EIRL', producto: '500 Libros Tapa Dura', fecha_creacion: '15 nov 2025, 11:00', estado: 'En diseño', badgeColor: 'bg-indigo-100 text-indigo-800' },
                { id: '3', ot_id: 'OT-1230', cliente: 'Cliente Particular', producto: '250 Tarjetas Personales', fecha_creacion: '14 nov 2025, 09:30', estado: 'Cambios Solicitados', badgeColor: 'bg-red-100 text-red-800' }
            ];
        }
        
        this.myTasks = tasks;
        this.applyFilters();
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        
        const filtered = this.myTasks.filter(task => 
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

    // Lógica Original de StartTask
    async startTask(id) {
        const btn = document.getElementById(`btn-action-${id}`);
        if(btn) {
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-1"></i> Iniciando...';
            if(window.lucide) window.lucide.createIcons();
        }

        await ColaService.updateStatus(id, 'En diseño');
        window.location.hash = `#/detalle/${id}`;
    },

    renderTable(tasks) {
        const tbody = document.getElementById('tasks-table-body'); 
        if(!tbody) return;
        tbody.innerHTML = '';

        if (tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">No se encontraron tareas.</td></tr>`;
            return;
        }

        tasks.forEach(task => {
            let actionHtml = '';
            
            if (task.estado === 'Diseño Pendiente') {
                actionHtml = `
                    <button id="btn-action-${task.id}" onclick="window.startTask('${task.id}')" class="flex items-center justify-center mx-auto px-3 py-1 text-sm bg-[#E31B23] text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition">
                        <i data-lucide="play" class="w-4 h-4 mr-1"></i> Comenzar
                    </button>
                `;
            } else {
                let btnText = 'Continuar';
                let icon = 'edit';
                if (task.estado === 'Cambios Solicitados') btnText = 'Corregir';
                
                actionHtml = `
                    <a href="#/detalle/${task.id}" class="flex items-center justify-center mx-auto px-3 py-1 text-sm bg-[#E31B23] text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition">
                        <i data-lucide="${icon}" class="w-4 h-4 mr-1"></i> ${btnText}
                    </a>
                `;
            }

            const badgeClass = task.badgeColor || 'bg-blue-100 text-blue-800';

            const row = `
                <tr class="hover:bg-gray-50 transition border-b last:border-0">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${task.ot_id || task.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.producto}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.fecha_creacion}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}">${task.estado}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        ${actionHtml}
                    </td>
                </tr>
            `;
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
    }
};