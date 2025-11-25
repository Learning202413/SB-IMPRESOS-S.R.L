import { ColaService } from '../services/cola.service.js';

export const ColaController = {
    // ESTADO DE PAGINACIÓN (Añadido)
    currentPage: 1,
    itemsPerPage: 10,
    myTasks: [],

    init: async function() {
        console.log("ColaController (Prensa): Cargando mis tareas...");
        
        // Setup Search (Añadido)
        document.getElementById('search-input')?.addEventListener('input', () => {
            this.currentPage = 1;
            this.applyFilters();
        });

        await this.loadTasks();
        // Exponer función globalmente para el onclick del HTML generado dinámicamente
        window.startPrensaTask = this.startTask.bind(this);
    },

    async loadTasks() {
        const tasks = await ColaService.getMyTasks();
        this.myTasks = tasks || [];
        
        // Renderizar aplicando filtros y paginación
        this.applyFilters();
    },
    
    // LÓGICA DE FILTRADO Y PAGINACIÓN (Añadido)
    applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        
        const filtered = this.myTasks.filter(task => 
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

    // LOGICA DEL BOTÓN "INICIAR" (Lógica original, sin cambios)
    async startTask(id) {
        const btn = document.getElementById(`btn-action-${id}`);
        if(btn) {
            // Feedback visual de carga
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-1"></i> ...';
            if(window.lucide) window.lucide.createIcons();
        }

        // 1. Cambiar estado a 'En proceso' en la BD
        await ColaService.updateStatus(id, 'En proceso');
        
        // 2. Redirigir a la terminal del operador
        window.location.hash = `#/operador/${id}`;
    },

    renderTable(tasks) {
        const tbody = document.getElementById('tasks-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (tasks.length === 0) {
             // Estilo Usuarios para mensaje vacío
            tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500 italic bg-gray-50">No tienes tareas activas.</td></tr>';
            return;
        }

        tasks.forEach(task => {
            let actionHtml = '';

            // LÓGICA DE ESTADOS PARA EL BOTÓN DE ACCIÓN (Lógica original, sin cambios)
            if (task.estado === 'Asignada a Prensa') {
                actionHtml = `
                    <button id="btn-action-${task.id}" onclick="window.startPrensaTask('${task.id}')" class="flex items-center justify-center mx-auto px-3 py-1 text-sm bg-[#E31B23] text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition">
                        <i data-lucide="play" class="w-4 h-4 mr-1"></i> Iniciar
                    </button>
                `;
            } else {
                actionHtml = `
                    <a href="#/operador/${task.id}" class="flex items-center justify-center mx-auto px-3 py-1 text-sm bg-[#E31B23] text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition">
                        <i data-lucide="arrow-right-circle" class="w-4 h-4 mr-1"></i> Continuar
                    </a>
                `;
            }

            const row = `
                <tr class="hover:bg-gray-50 transition border-b last:border-0">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${task.ot_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">${task.maquina}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.producto}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.fecha}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.badgeColor}">${task.estado}</span>
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
    }
};