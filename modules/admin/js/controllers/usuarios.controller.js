/**
 * js/controllers/usuarios.controller.js
 * Controlador unificado: Gestión de Usuarios + Lógica Visual de Dropdowns.
 * ACTUALIZADO: Validación de Email duplicado y notificación de 'Atención' al eliminar.
 */
import { usersDB } from '../services/users.db.js';

export const UsuariosController = {
    // Estado de paginación
    currentPage: 1,
    itemsPerPage: 10,
    
    // Estado de ordenamiento
    sortState: { 
        key: 'name', 
        direction: 'asc' 
    },

    // Referencia para limpiar eventos
    _submitHandler: null,

    init: async function() {
        console.log("UsuariosController: Iniciando...");
        
        // 1. Configurar la lógica visual de los Dropdowns (Selects Custom)
        this.setupDropdownHelpers();

        // 2. Cargar datos iniciales
        await this.applyFilters();
        
        // 3. Configurar eventos de la tabla y modales
        this.setupEvents();
        this.setupSortEvents(); 
    },

    // --- LÓGICA VISUAL (CUSTOM DROPDOWNS) ---
    setupDropdownHelpers: function() {
        // Definimos las funciones globales que el HTML 'onclick' está buscando
        
        // A) Mostrar/Ocultar Menú
        window.toggleDropdown = (menuId, chevronId) => {
            const menu = document.getElementById(menuId);
            const chevron = document.getElementById(chevronId);
            
            if (!menu) return;

            // Cerrar otros dropdowns
            document.querySelectorAll('[id$="-dropdown"]').forEach(el => {
                if(el.id !== menuId) el.classList.add('hidden');
            });
            document.querySelectorAll('[id$="-chevron"]').forEach(el => {
                if(el.id !== chevronId) el.style.transform = 'rotate(0deg)';
            });

            // Alternar el actual
            menu.classList.toggle('hidden');
            const isHidden = menu.classList.contains('hidden');
            if (chevron) {
                chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        };

        // B) Seleccionar Opción
        window.selectCustomOption = (type, value, text) => {
            // 1. Actualizar texto visual del botón
            const textElement = document.getElementById(`selected-${type}-text`);
            if(textElement) textElement.innerText = text;

            // 2. Actualizar el Input Oculto
            const hiddenInput = document.getElementById(`filter-${type}`);
            if(hiddenInput) {
                hiddenInput.value = value;
                
                // 3. Disparar evento 'change' manualmente para activar el filtro
                const event = new Event('change');
                hiddenInput.dispatchEvent(event);
            }

            // 4. Cerrar dropdown
            window.toggleDropdown(`${type}-dropdown`, `${type}-chevron`);
        };

        // C) Listener para cerrar al hacer clic fuera (Global)
        window.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id$="-chevron"]').forEach(el => el.style.transform = 'rotate(0deg)');
            }
        });

        // Asegurar que los iconos se rendericen si Lucide ya cargó
        if(window.lucide) window.lucide.createIcons();
    },

    // --- LÓGICA DE NEGOCIO Y DATOS ---

    sortUsers(users, key, direction) {
        const isNumeric = ['id'].includes(key); 
        
        users.sort((a, b) => {
            let valA = a[key] || (isNumeric ? 0 : '');
            let valB = b[key] || (isNumeric ? 0 : '');

            if (!isNumeric && typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;

            return direction === 'asc' ? comparison : comparison * -1;
        });
        
        return users;
    },

    async applyFilters() {
        const searchTerm = document.getElementById('search-user-input')?.value.toLowerCase() || '';
        
        // Ahora leemos el valor de los inputs ocultos (hidden) que actualizan los dropdowns
        const roleFilter = document.getElementById('filter-role')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';

        const users = await usersDB.getUsers(); 

        const filteredUsers = users.filter(user => {
            const matchesSearch = (user.name && user.name.toLowerCase().includes(searchTerm)) || 
                                  (user.email && user.email.toLowerCase().includes(searchTerm));
            const matchesRole = roleFilter ? user.role === roleFilter : true;
            const matchesStatus = statusFilter ? user.status === statusFilter : true;
            return matchesSearch && matchesRole && matchesStatus;
        });

        const sortedUsers = this.sortUsers(filteredUsers, this.sortState.key, this.sortState.direction);

        const totalItems = sortedUsers.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

        this.renderTable(paginatedUsers);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderTable(users) {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500 italic bg-gray-50">No se encontraron usuarios con los filtros actuales.</td></tr>';
            this.updateTableHeader();
            return;
        }
        
        this.updateTableHeader();

        users.forEach(user => {
            const isOnline = user.status === 'Online';
            const statusBadge = isOnline 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"><span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>Online</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Offline</span>`;

            const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200 mr-3">
                                ${initial}
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">${user.name || 'Sin Nombre'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="flex items-center">
                            <i data-lucide="mail" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${user.email || 'Sin Email'}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">
                        <div class="flex items-center">
                            <i data-lucide="shield" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${user.role || 'Sin Rol'}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        ${statusBadge}
                    </td>
                    <td class="px-6 py-4 text-center space-x-2">
                        <button class="text-blue-600 p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition btn-edit" data-id="${user.id}" title="Editar">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button class="text-red-600 p-2 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition btn-delete" data-id="${user.id}" data-name="${user.name}" data-email="${user.email}" data-role="${user.role}" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        
        if(window.lucide) window.lucide.createIcons();
    },

    updateTableHeader() {
        const thead = document.querySelector('.table-header-bg tr') || document.querySelector('thead tr'); 
        if (!thead) return;
        const sortKey = this.sortState.key;
        const sortDir = this.sortState.direction;
        
        const getSortIcon = (key) => {
            if (sortKey === key) {
                return `<i data-lucide="${sortDir === 'asc' ? 'arrow-down-narrow-wide' : 'arrow-up-narrow-wide'}" class="w-4 h-4 mr-1 text-white"></i>`;
            }
            return '';
        };

        thead.innerHTML = `
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" data-sort-key="name">
                <div class="flex items-center justify-start">${getSortIcon('name')}Usuario</div>
            </th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" data-sort-key="email">
                <div class="flex items-center justify-start">${getSortIcon('email')}Email</div>
            </th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" data-sort-key="role">
                <div class="flex items-center justify-start">${getSortIcon('role')}Rol Asignado</div>
            </th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" data-sort-key="status">
                <div class="flex items-center justify-start">${getSortIcon('status')}Estado</div>
            </th>
            <th class="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">Acciones</th>
        `;
        if(window.lucide) window.lucide.createIcons();
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
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> usuarios
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
    
    setupSortEvents() {
        const thead = document.querySelector('thead');
        if (!thead) return;
        
        const newThead = thead.cloneNode(true);
        thead.parentNode.replaceChild(newThead, thead);

        newThead.addEventListener('click', (e) => {
            const th = e.target.closest('th');
            const key = th?.dataset.sortKey;

            if (key) {
                if (this.sortState.key === key) {
                    this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortState.key = key;
                    this.sortState.direction = 'asc';
                }
                this.currentPage = 1;
                this.applyFilters();
            }
        });
    },

    async handleFormSubmit(e) {
        // --- CREAR USUARIO ---
        if (e.target.id === 'user-create-form') {
            e.preventDefault();
            const form = e.target; 
            
            // 1. Capturamos datos INCLUYENDO PASSWORD (NUEVO)
            const newUser = {
                name: form.querySelector('#user-create-name').value,
                email: form.querySelector('#user-create-email').value,
                role: form.querySelector('#user-create-role').value,
                password: form.querySelector('#user-create-password').value, // Captura contraseña
                status: 'Offline'
            };

            // Validación actualizada para incluir password
            if (!newUser.name || !newUser.email || !newUser.password) {
                window.UI.showNotification('Error', 'Todos los campos (incluyendo contraseña) son obligatorios.');
                return;
            }

            // --- VALIDACIÓN DE DUPLICADOS (CREATE) ---
            const allUsers = await usersDB.getUsers();
            const exists = allUsers.some(u => u.email.toLowerCase() === newUser.email.toLowerCase());
            
            if (exists) {
                window.UI.showNotification('Error', 'El correo electrónico ya se encuentra registrado.');
                return;
            }
            // -----------------------------------------

            // Indicador visual de carga
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Creando...';
            if(window.lucide) window.lucide.createIcons();

            const result = await usersDB.addUser(newUser); 

            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

            if (result.success) {
                window.UI.hideModal('user-modal-container');
                window.UI.showNotification('Éxito', 'Usuario creado correctamente en el sistema.');
                
                document.getElementById('search-user-input').value = '';
                this.currentPage = 1; 
                this.applyFilters();
            } else {
                window.UI.showNotification('Error', result.message);
            }
        }

        // --- EDITAR USUARIO ---
        if (e.target.id === 'user-edit-form') {
            e.preventDefault();
            const form = e.target;
            const id = form.querySelector('#user-edit-id-field').value;
            
            const updates = {
                name: form.querySelector('#user-edit-name').value,
                email: form.querySelector('#user-edit-email').value,
                role: form.querySelector('#user-edit-role').value,
            };

            // --- VALIDACIÓN DE DUPLICADOS (EDIT) ---
            const allUsers = await usersDB.getUsers();
            const exists = allUsers.some(u => u.email.toLowerCase() === updates.email.toLowerCase() && u.id !== id);

            if (exists) {
                window.UI.showNotification('Error', 'El correo electrónico ya pertenece a otro usuario.');
                return;
            }
            // ---------------------------------------

            const result = await usersDB.updateUser(id, updates); 
            
            if (result.success) {
                window.UI.hideModal('user-modal-container');
                window.UI.showNotification('Actualizado', 'Datos modificados.');
                this.applyFilters();
            } else {
                window.UI.showNotification('Error', 'Error al actualizar.');
            }
        }
    },

    setupEvents() {
        const resetPageAndFilter = () => {
            this.currentPage = 1;
            this.applyFilters();
        };

        document.getElementById('search-user-input')?.addEventListener('input', resetPageAndFilter);
        
        // Escuchamos el evento 'change' en los inputs ocultos (filter-role, filter-status)
        document.getElementById('filter-role')?.addEventListener('change', resetPageAndFilter);
        document.getElementById('filter-status')?.addEventListener('change', resetPageAndFilter);

        document.getElementById('btn-create-user')?.addEventListener('click', () => {
            const form = document.getElementById('user-create-form');
            if(form) form.reset();
            window.UI.showModal('user-modal-container', 'user-create-modal-content');
        });

        const modalContainer = document.getElementById('user-modal-container');
        if (modalContainer) {
            if (!this._submitHandler) {
                this._submitHandler = this.handleFormSubmit.bind(this);
            }
            modalContainer.removeEventListener('submit', this._submitHandler);
            modalContainer.addEventListener('submit', this._submitHandler);
        }

        const tbody = document.getElementById('users-table-body');
        if (tbody) {
             const newTbody = tbody.cloneNode(true);
             tbody.parentNode.replaceChild(newTbody, tbody);

             newTbody.addEventListener('click', async (e) => {
                const btnDelete = e.target.closest('.btn-delete');
                if (btnDelete) {
                    const { id, name, role, email } = btnDelete.dataset;
                    
                    const confirmHtml = `
                        <p class="text-gray-500 text-sm mb-5">
                            ¿Estás seguro de que deseas eliminar a este usuario?
                        </p>
                        <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center text-left mb-4 shadow-sm">
                            <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-gray-400 border border-gray-200 mr-3 flex-shrink-0 font-bold text-xs">
                                <i data-lucide="user" class="w-5 h-5 text-red-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-800 leading-tight">${name}</p>
                                <p class="text-xs text-gray-500 mt-0.5">${role}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-400 italic">Email: ${email}</p>
                    `;

                    window.UI.showConfirmModal('Eliminar Usuario', confirmHtml, 'Eliminar', async () => {
                        await usersDB.deleteUser(id); 
                        // --- ACTUALIZADO: Usa 'Atención' para notificar la eliminación ---
                        window.UI.showNotification('Atención', 'Usuario eliminado correctamente.');
                        // ---------------------------------------------------------------
                        this.applyFilters(); 
                    });
                }
                
                const btnEdit = e.target.closest('.btn-edit');
                if (btnEdit) {
                    const id = btnEdit.dataset.id;
                    const users = await usersDB.getUsers(); 
                    const user = users.find(u => u.id === id);
                    if (user) {
                        window.UI.showModal('user-modal-container', 'user-edit-modal-content');
                        const container = document.getElementById('user-modal-container');
                        if(container) {
                            container.querySelector('#user-edit-id-field').value = user.id;
                            container.querySelector('#user-edit-name').value = user.name;
                            container.querySelector('#user-edit-email').value = user.email;
                            container.querySelector('#user-edit-role').value = user.role;
                        }
                    }
                }
            });
        }
    }
};