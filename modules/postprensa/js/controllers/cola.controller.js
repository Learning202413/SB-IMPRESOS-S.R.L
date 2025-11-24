import { PostPrensaColaService } from '../services/cola.service.js';

// Helper local para obtener el nombre del usuario actual para la UI
const getUsername = () => {
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    return user ? user.name : '[Equipo de Acabados]';
};

export const ColaController = {
    // ESTADO DE PAGINACIÓN 
    currentPage: 1,
    itemsPerPage: 10,
    myTasks: [],

    init: async function() {
        console.log("ColaController (Mis Tareas) inicializado.");
        
        // Mostrar el nombre del usuario logueado en el encabezado
        const userNameEl = document.getElementById('current-user-name');
        if (userNameEl) userNameEl.textContent = getUsername();
        
        await this.loadMyTasks();
        this.setupEvents();
        // Exponer para el onclick del HTML inyectado
        window.startPostPrensaTask = this.startTask.bind(this);
    },

    async loadMyTasks() {
        const tasks = await PostPrensaColaService.getMyTasks();
        this.myTasks = tasks || [];
        
        this.applyFilters();
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        
        const filtered = this.myTasks.filter(task => 
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

    // CORRECCIÓN FUNCIONALIDAD Y VISUAL (Punto 1 y 2)
    async startTask(id) {
        const btn = document.getElementById(`btn-action-${id}`);
        const originalContent = btn ? btn.innerHTML : '';

        // Feedback visual de carga (Igual a Prensa/Pre-Prensa)
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-1"></i> Procesando...';
            if(window.lucide) window.lucide.createIcons();
        }

        try {
            await PostPrensaColaService.startProcessing(id);
            // CORRECCIÓN FUNCIONAL: Agregar redirección a la vista de trabajo
            window.location.hash = `#/calidad/${id}`; 
        } catch (error) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                if(window.lucide) window.lucide.createIcons();
            }
            console.error("Error al iniciar tarea:", error);
            if(window.UI) window.UI.showNotification('Error', 'No se pudo iniciar el proceso de acabado.');
        }
    },

    renderTable(tasks) {
        const tbody = document.getElementById('tasks-table-body');
        if(!tbody) return;
        tbody.innerHTML = '';

        if (tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500 italic bg-gray-50">No tienes tareas asignadas.</td></tr>`;
            return;
        }

        tasks.forEach(task => {
            let actionHtml = '';
            
            // CORRECCIÓN VISUAL: Estilo uniforme (rojo principal) y ID para feedback visual
            const primaryActionClass = "flex items-center justify-center mx-auto px-3 py-1 text-sm bg-red-600 text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition";

            if (task.estado === 'Pendiente' || task.estado === 'Asignada') {
                actionHtml = `
                    <button id="btn-action-${task.id}" onclick="window.startPostPrensaTask('${task.id}')" class="${primaryActionClass}">
                        <i data-lucide="play" class="w-4 h-4 mr-1"></i> Procesar
                    </button>
                `;
            } else {
                actionHtml = `
                    <a href="#/calidad/${task.id}" class="${primaryActionClass}">
                        <i data-lucide="arrow-right-circle" class="w-4 h-4 mr-1"></i> Continuar
                    </a>
                `;
            }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${task.ot_id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.cliente}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.producto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">${task.estacion}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.badgeColor}">${task.estado}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${actionHtml}</td>
            `;
            tbody.appendChild(tr);
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
    },

    setupEvents() {
        // Evento de Búsqueda
        document.getElementById('search-input')?.addEventListener('input', () => {
            this.currentPage = 1;
            this.applyFilters();
        });
    }
};