/**
 * js/controllers/produccion.controller.js
 * Controlador de Control de Producción (Admin).
 * Lógica Completa: Gestión de OTs, Asignación, Reasignación y Eliminación con Notificaciones.
 * ACTUALIZADO: Usa notificación de 'Atención' al desasignar una tarea.
 */
import { productionDB } from '../services/production.db.js'; 
import { usersDB } from '../services/users.db.js'; 

export const ProductionController = {
    _submitHandler: null,

    init: async function() {
        console.log("ProductionController: Iniciando...");
        this.setupTabs();
        await this.loadOTs();
        this.setupListAssignButtons();
        this.setupModalEvents();
    },

    setupTabs() {
        const tabUnassigned = document.getElementById('tab-unassigned');
        const tabAssigned = document.getElementById('tab-assigned');
        
        if (!tabUnassigned || !tabAssigned) return;

        const switchTab = (view) => {
            if (view === 'unassigned') {
                // Estilo Activo Rojo (Sin Asignar)
                tabUnassigned.className = "flex-1 lg:flex-none px-5 py-2 text-sm font-bold text-red-700 bg-white rounded-md shadow-sm transition-all duration-200 flex items-center justify-center";
                // Estilo Inactivo (En Proceso)
                tabAssigned.className = "flex-1 lg:flex-none px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-md transition-all duration-200 flex items-center justify-center";
                
                document.getElementById('view-unassigned').classList.remove('hidden');
                document.getElementById('view-assigned').classList.add('hidden');
            } else {
                // Estilo Activo Azul (En Proceso)
                tabAssigned.className = "flex-1 lg:flex-none px-5 py-2 text-sm font-bold text-blue-700 bg-white rounded-md shadow-sm transition-all duration-200 flex items-center justify-center";
                // Estilo Inactivo (Sin Asignar)
                tabUnassigned.className = "flex-1 lg:flex-none px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-md transition-all duration-200 flex items-center justify-center";
                
                document.getElementById('view-assigned').classList.remove('hidden');
                document.getElementById('view-unassigned').classList.add('hidden');
            }
            this.loadOTs();
        };

        tabUnassigned.addEventListener('click', () => switchTab('unassigned'));
        tabAssigned.addEventListener('click', () => switchTab('assigned'));
    },

    async loadOTs() {
        try {
            const allOTs = await productionDB.getOTs();
            const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';

            const unassignedList = [];
            const assignedList = [];

            allOTs.forEach(ot => {
                if (ot.estado === 'Completado') return;

                const s = (ot.estado || '').toLowerCase();
                const matchesSearch = (
                    (ot.ot_id && ot.ot_id.toLowerCase().includes(searchTerm)) ||
                    (ot.cliente_nombre && ot.cliente_nombre.toLowerCase().includes(searchTerm))
                );
                if (!matchesSearch) return;

                let needsAssignment = false;
                let currentAssignee = null;
                let nextRoleNeeded = '';

                // Lógica de Negocio: Determinación de estado y rol necesario
                if (s === 'orden creada' || s.includes('diseño pendiente')) {
                    if (!ot.asignado_a) { needsAssignment = true; nextRoleNeeded = 'Diseñador'; } 
                    else { currentAssignee = ot.asignado_nombre_preprensa; }
                }
                else if (s === 'en prensa' || s === 'listo para prensa' || s === 'asignada a prensa') {
                    if (!ot.asignado_prensa) { needsAssignment = true; nextRoleNeeded = 'Operador Prensa'; } 
                    else { currentAssignee = ot.asignado_nombre_prensa; }
                }
                else if (s === 'en post-prensa' || s === 'pendiente' || s.includes('acabados')) {
                    if (!ot.asignado_postprensa) { needsAssignment = true; nextRoleNeeded = 'Operador Acabados'; } 
                    else { currentAssignee = ot.asignado_nombre_postprensa; }
                }
                else {
                    if (ot.asignado_nombre_postprensa) currentAssignee = ot.asignado_nombre_postprensa;
                    else if (ot.asignado_nombre_prensa) currentAssignee = ot.asignado_nombre_prensa;
                    else if (ot.asignado_nombre_preprensa) currentAssignee = ot.asignado_nombre_preprensa;
                }

                if (needsAssignment) {
                    ot.roleNeeded = nextRoleNeeded;
                    unassignedList.push(ot);
                } else {
                    ot.assigneeDisplay = currentAssignee || 'En Proceso';
                    assignedList.push(ot);
                }
            });

            this.renderUnassigned(unassignedList);
            this.renderAssigned(assignedList);

        } catch (error) {
            console.error("Error cargando OTs:", error);
        }
    },

    renderUnassigned(list) {
        const tbody = document.getElementById('table-body-unassigned');
        const empty = document.getElementById('empty-unassigned');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (list.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.forEach(ot => {
                const prod = (ot.items && ot.items[0]) ? ot.items[0].producto : 'Varios';
                
                const row = `
                    <tr class="hover:bg-gray-50 border-b last:border-0 transition group" data-ot-id="${ot.id}">
                        <td class="px-6 py-4">
                            <span class="font-bold text-gray-900">${ot.ot_id}</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-600">${ot.cliente_nombre}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">${prod}</td>
                        <td class="px-6 py-4">
                             <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                ${ot.estado}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-700">
                             <div class="flex items-center">
                                <i data-lucide="user-plus" class="w-4 h-4 mr-1.5 text-gray-400"></i>
                                ${ot.roleNeeded}
                             </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <button class="btn-assign px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95">
                                Asignar
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        }
        if(window.lucide) window.lucide.createIcons();
    },

    renderAssigned(list) {
        const tbody = document.getElementById('table-body-assigned');
        const empty = document.getElementById('empty-assigned');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (list.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.forEach(ot => {
                const prod = (ot.items && ot.items[0]) ? ot.items[0].producto : 'Varios';
                
                const row = `
                    <tr class="hover:bg-gray-50 border-b last:border-0 transition group" data-ot-id="${ot.id}" data-ot-name="${ot.ot_id}" data-assignee="${ot.assigneeDisplay}">
                        <td class="px-6 py-4 font-bold text-gray-900">${ot.ot_id}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">${ot.cliente_nombre}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">${prod}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                ${ot.estado}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-700">
                            <div class="flex items-center">
                                <div class="h-6 w-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold mr-2 border border-blue-100">
                                    ${ot.assigneeDisplay.charAt(0).toUpperCase()}
                                </div>
                                ${ot.assigneeDisplay}
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center space-x-1">
                                <button class="btn-assign text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-all" title="Reasignar">
                                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                                </button>
                                <button class="btn-delete text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Eliminar Asignación">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        }
        if (window.lucide) window.lucide.createIcons();
    },

    setupListAssignButtons() {
        const handleTableClick = async (e) => {
            const btnAssign = e.target.closest('.btn-assign');
            const btnDelete = e.target.closest('.btn-delete');
            const row = e.target.closest('tr');
            
            if (!row) return;
            const otId = row.dataset.otId;

            // --- CASO 1: ASIGNAR / REASIGNAR ---
            if (btnAssign) {
                const all = await productionDB.getOTs();
                const ot = all.find(o => o.id == otId || o.ot_id == otId);
                if (ot) this.openAssignModal(ot);
            }

            // --- CASO 2: ELIMINAR (Desasignar) ---
            if (btnDelete) {
                const otName = row.dataset.otName;
                const assignee = row.dataset.assignee;

                const confirmHtml = `
                    <p class="text-gray-500 text-sm mb-5">
                        ¿Estás seguro de que deseas retirar la asignación actual?
                    </p>
                    <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center text-left mb-4 shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-gray-400 border border-gray-200 mr-3 flex-shrink-0 font-bold text-xs">
                            <i data-lucide="user-minus" class="w-5 h-5 text-red-400"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800 leading-tight">${otName}</p>
                            <p class="text-xs text-gray-500 mt-0.5">Asignado a: ${assignee}</p>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 italic">La orden volverá a la lista de "Sin Asignar".</p>
                `;

                window.UI.showConfirmModal('Desasignar Tarea', confirmHtml, 'Retirar Asignación', async () => {
                    // Lógica para quitar la asignación en DB
                    await productionDB.assignOT(otId, null, null, 'Orden Creada'); 
                    
                    // --- ACTUALIZADO: Usa 'Atención' para notificar la desasignación ---
                    window.UI.showNotification('Atención', 'La orden ha vuelto a la cola de pendientes.');
                    // -----------------------------------------------------------------
                    
                    this.loadOTs();
                });
            }
        };

        // Attach listeners
        document.getElementById('table-body-unassigned')?.addEventListener('click', handleTableClick);
        document.getElementById('table-body-assigned')?.addEventListener('click', handleTableClick);
        document.getElementById('search-input')?.addEventListener('input', () => this.loadOTs());
    },

    getModalElement(selector) {
        const container = document.getElementById('assign-modal-container');
        return container ? container.querySelector(selector) : null;
    },

    async openAssignModal(ot) {
        let roleToAssign = 'Diseñador (Pre-Prensa)';
        const s = (ot.estado || '').toLowerCase();

        if (s.includes('post') || s.includes('acabados') || s === 'pendiente') roleToAssign = 'Operador (Post-Prensa)';
        else if (s.includes('prensa')) roleToAssign = 'Operador (Prensa)';
        else roleToAssign = 'Diseñador (Pre-Prensa)';

        window.UI.showModal('assign-modal-container', 'assign-modal-content');

        setTimeout(() => {
            const title = this.getModalElement('#assign-modal-title');
            const label = this.getModalElement('#assign-role-label');
            const otInput = this.getModalElement('#assign-ot-id');
            const resourceInput = this.getModalElement('#assign-resource-id');
            const searchInput = this.getModalElement('#assign-search-input');
            const confirmBtn = this.getModalElement('#confirm-assign-button');

            if(title) title.textContent = `Asignar OT: ${ot.ot_id}`;
            if(label) label.innerHTML = `Rol sugerido: <span class="text-red-600">${roleToAssign}</span>`;
            if(otInput) otInput.value = ot.id;
            
            if(searchInput) {
                searchInput.value = '';
                searchInput.placeholder = `Buscar ${roleToAssign.split(' ')[0]}...`;
                searchInput.focus();
                const newSearch = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearch, searchInput);
                newSearch.addEventListener('input', (e) => {
                    if(confirmBtn) confirmBtn.disabled = true;
                    this.renderSuggestions(roleToAssign, e.target.value);
                });
            }
            
            if(resourceInput) resourceInput.value = '';
            if(confirmBtn) confirmBtn.disabled = true;

            this.renderSuggestions(roleToAssign);
        }, 50);
    },

    async renderSuggestions(roleFilter, searchTerm = '') {
        const listEl = this.getModalElement('#assign-suggestions-list');
        if (!listEl) return;
        
        let users = await usersDB.getUsers();
        const roleKey = roleFilter.split(' ')[0]; 

        users = users.filter(u => {
            const roleMatch = u.role === roleFilter || u.role.startsWith(roleKey);
            const nameMatch = !searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (roleFilter.includes('Post') && u.role.includes('Prensa') && !u.role.includes('Post')) return false;
            if (roleFilter.includes('Prensa') && !roleFilter.includes('Post') && u.role.includes('Post')) return false;
            
            return roleMatch && nameMatch;
        });

        listEl.innerHTML = '';
        if (users.length === 0) {
            listEl.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400">
                    <i data-lucide="user-x" class="w-8 h-8 mb-2"></i>
                    <p class="text-sm">No se encontraron colaboradores.</p>
                </div>
            `;
            if(window.lucide) window.lucide.createIcons();
            return;
        }

        users.forEach(u => {
            const div = document.createElement('div');
            // Estilo visual del ítem de la lista
            div.className = "p-4 hover:bg-red-50 cursor-pointer border-b last:border-0 flex justify-between items-center group transition-colors";
            div.innerHTML = `
                <div class="flex items-center">
                    <div class="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs mr-3 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
                        ${u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 group-hover:text-red-700 text-sm transition-colors">${u.name}</div>
                        <div class="text-xs text-gray-500">${u.role}</div>
                    </div>
                </div>
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                     <i data-lucide="check-circle" class="w-5 h-5 text-red-500"></i>
                </div>
            `;
            div.onclick = () => {
                this.getModalElement('#assign-resource-id').value = u.id;
                this.getModalElement('#assign-search-input').value = u.name;
                this.getModalElement('#confirm-assign-button').disabled = false;
                
                listEl.querySelectorAll('div.bg-red-50').forEach(d => {
                    d.classList.remove('bg-red-50', 'border-l-4', 'border-red-500');
                    d.querySelector('.opacity-0')?.classList.remove('opacity-100');
                });
                
                div.classList.add('bg-red-50');
                div.querySelector('.opacity-0').classList.remove('opacity-0');
            };
            listEl.appendChild(div);
        });
        if(window.lucide) window.lucide.createIcons();
    },

    setupModalEvents() {
        const modalContainer = document.getElementById('assign-modal-container');
        if (modalContainer) {
            if(this._submitHandler) modalContainer.removeEventListener('submit', this._submitHandler);
            
            this._submitHandler = async (e) => {
                if (e.target.id === 'assign-form') {
                    e.preventDefault();
                    const otId = this.getModalElement('#assign-ot-id').value;
                    const userId = this.getModalElement('#assign-resource-id').value;
                    const userName = this.getModalElement('#assign-search-input').value;
                    
                    if (!userId) return;

                    const allUsers = await usersDB.getUsers();
                    const selectedUser = allUsers.find(u => u.id === userId);
                    let newStatus = 'Asignado';
                    
                    if (selectedUser.role.includes('Diseñador')) {
                        newStatus = 'Diseño Pendiente';
                    } 
                    else if (selectedUser.role.includes('Post') || selectedUser.role.includes('Acabados')) {
                        newStatus = 'Pendiente'; 
                    }
                    else if (selectedUser.role.includes('Prensa')) {
                        newStatus = 'Asignada a Prensa';
                    }

                    await productionDB.assignOT(otId, userId, userName, newStatus);
                    
                    window.UI.hideModal('assign-modal-container');
                    
                    // --- NOTIFICACIÓN DE ÉXITO (MANTIENE VERDE) ---
                    window.UI.showNotification('Asignado', `Tarea enviada a ${userName}`);
                    
                    this.loadOTs();
                }
            };
            modalContainer.addEventListener('submit', this._submitHandler);
        }
    }
};