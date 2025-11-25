/**
 * js/controllers/stock.controller.js
 * Controlador para Inventario.
 * FIX: Reincorporación del IGV en OC y diseño de modal eliminar.
 */
import { StockService } from '../services/stock.service.js';

export const StockController = {
    currentPage: 1,
    itemsPerPage: 10,
    sortState: { 
        key: 'nombre', 
        direction: 'asc' 
    },
    
    ocItems: [], 
    currentCategories: [],
    selectedProductProviders: [],
    tempSelectedProduct: null, 
    
    _boundHandleOCClick: null,
    _boundHandleOCSubmit: null,
    _boundHandleItemSubmit: null,
    _boundHandleTableAction: null,

    init: async function() {
        console.log("StockController: Iniciando...");
        this.setupDropdownHelpers();
        await this.setupCategoryFilter(); 
        await this.applyFilters();
        this.setupEvents();
        this.setupSortEvents();
    },

    setupDropdownHelpers: function() {
        window.toggleDropdown = (menuId, chevronId) => {
            const menu = document.getElementById(menuId);
            const chevron = document.getElementById(chevronId);
            if (!menu) return;

            document.querySelectorAll('[id$="-dropdown"]').forEach(el => {
                if(el.id !== menuId) el.classList.add('hidden');
            });
            document.querySelectorAll('[id$="-chevron"]').forEach(el => {
                if(el.id !== chevronId) el.style.transform = 'rotate(0deg)';
            });

            menu.classList.toggle('hidden');
            const isHidden = menu.classList.contains('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        };

        window.selectCustomOption = (type, value, text) => {
            const textElement = document.getElementById(`selected-${type}-text`);
            if(textElement) textElement.innerText = text;

            const hiddenInput = document.getElementById(`filter-${type}`);
            if(hiddenInput) {
                hiddenInput.value = value;
                const event = new Event('change');
                hiddenInput.dispatchEvent(event);
            }
            window.toggleDropdown(`${type}-dropdown`, `${type}-chevron`);
        };

        window.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id$="-chevron"]').forEach(el => el.style.transform = 'rotate(0deg)');
            }
        });
        if(window.lucide) window.lucide.createIcons();
    },

    async setupCategoryFilter() {
        try {
            const products = await StockService.getProducts();
            const categories = [...new Set(products.map(p => p.categoria).filter(c => c && c.trim() !== ''))].sort();
            
            const listContainer = document.getElementById('category-filter-list');
            if (listContainer) {
                let html = `<button type="button" class="w-full text-left flex items-center px-4 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors" onclick="window.selectCustomOption('category', '', 'Todas')">Todas</button>`;
                
                categories.forEach(cat => {
                    html += `<button type="button" class="w-full text-left flex items-center px-4 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors" onclick="window.selectCustomOption('category', '${cat}', '${cat}')">${cat}</button>`;
                });
                
                listContainer.innerHTML = html;
            }
        } catch (error) {
            console.error("Error cargando categorías para filtro:", error);
        }
    },

    getCategoryStyle(category) {
        if (!category) return 'bg-gray-100 text-gray-600 border-gray-200';
        const lower = category.toLowerCase();
        if (lower.includes('papel')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (lower.includes('tinta')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (lower.includes('placa')) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (lower.includes('quimico') || lower.includes('químico')) return 'bg-teal-100 text-teal-700 border-teal-200';
        return 'bg-indigo-50 text-indigo-700 border-indigo-100'; 
    },

    sortProducts(products, key, direction) {
        let dataKey = key;
        if (key === 'producto') dataKey = 'nombre'; 
        const isNumeric = ['stock', 'precio', 'min'].includes(dataKey);

        products.sort((a, b) => {
            let valA = a[dataKey];
            let valB = b[dataKey];
            if (valA === null || valA === undefined) valA = isNumeric ? 0 : '';
            if (valB === null || valB === undefined) valB = isNumeric ? 0 : '';

            if (isNumeric) {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA > valB) return direction === 'asc' ? 1 : -1;
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            return 0;
        });
        return products;
    },

    async applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const catFilter = document.getElementById('filter-category')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';
        const abcFilter = document.getElementById('filter-abc')?.value || '';

        let products = await StockService.getProducts();

        const filtered = products.filter(p => {
            const matchesSearch = (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) || 
                                  (p.sku && p.sku.toLowerCase().includes(searchTerm));
            
            const matchesCat = catFilter ? p.categoria === catFilter : true;
            const matchesAbc = abcFilter ? p.abc === abcFilter : true;
            
            let matchesStatus = true;
            if (statusFilter === 'Stock Crítico') matchesStatus = (p.stock <= p.min);
            if (statusFilter === 'OK') matchesStatus = (p.stock > p.min);

            return matchesSearch && matchesCat && matchesStatus && matchesAbc;
        });

        const sorted = this.sortProducts(filtered, this.sortState.key, this.sortState.direction);
        const totalItems = sorted.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginated = sorted.slice(startIndex, endIndex);

        this.renderTable(paginated);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
        this.updateTableHeaderIcon();
    },

    renderTable(products) {
        const tbody = document.getElementById('inventory-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-gray-500 italic bg-gray-50">No se encontraron productos.</td></tr>';
            return;
        }

        products.forEach(p => {
            const isCritical = p.stock <= p.min;
            const statusBadge = isCritical 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"><span class="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>Crítico</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">OK</span>`;
            
            const precio = parseFloat(p.precio || 0).toFixed(2);
            const provCount = p.proveedores ? p.proveedores.length : (p.proveedor_id ? 1 : 0);
            const provLabel = provCount > 1 ? `<span class="ml-1 text-[10px] bg-gray-100 px-1 rounded border border-gray-200 text-gray-500">+${provCount-1}</span>` : '';
            const catClass = this.getCategoryStyle(p.categoria);

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4 text-sm font-mono text-gray-500">${p.sku}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-8 w-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 mr-3 border border-blue-100">
                                <i data-lucide="package" class="w-4 h-4"></i>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">${p.nombre} ${provLabel}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${catClass}">${p.categoria || '-'}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="inline-block w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-center leading-6 text-xs font-bold border border-slate-200">${p.abc || '-'}</span>
                    </td>
                    <td class="px-6 py-4 text-sm text-right text-gray-700 font-mono">S/ ${precio}</td>
                    <td class="px-6 py-4 text-sm font-bold text-center text-gray-800">${p.stock}</td>
                    <td class="px-6 py-4 text-sm text-center text-gray-500">${p.min}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-6 py-4 text-center space-x-2">
                        <button class="text-blue-600 p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition btn-edit-item" data-sku="${p.sku}" title="Editar">
                            <i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                        <button class="text-red-600 p-2 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition btn-delete-item" data-sku="${p.sku}" data-name="${p.nombre}" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                    </td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });
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
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> productos
            </div>
            <div class="flex space-x-2">
                <button id="btn-prev-page" class="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="px-3 py-1 text-sm font-medium text-gray-700">Página ${this.currentPage}</span>
                <button id="btn-next-page" class="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition" ${this.currentPage >= totalPages ? 'disabled' : ''}>
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

    updateTableHeaderIcon() {
        const sortContainers = document.querySelectorAll('.sort-container');
        sortContainers.forEach(container => {
            const icon = container.querySelector('svg, i');
            if (icon) icon.remove();
        });

        const th = document.querySelector(`th[data-sort-key="${this.sortState.key}"] .sort-container`);
        if (th) {
            const iconName = this.sortState.direction === 'asc' ? 'arrow-down-narrow-wide' : 'arrow-up-narrow-wide';
            th.insertAdjacentHTML('afterbegin', `<i data-lucide="${iconName}" class="w-4 h-4 mr-1 text-white"></i>`);
            if(window.lucide) window.lucide.createIcons();
        }
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

    getElementInModal(modalId, selector) {
        const container = document.getElementById(modalId);
        return container ? container.querySelector(selector) : null;
    },

    renderProviderChips() {
        const container = this.getElementInModal('item-modal-container', '#selected-providers-container');
        if (!container) return;
        container.innerHTML = '';
        this.selectedProductProviders.forEach((prov, index) => {
            const chip = document.createElement('div');
            chip.className = 'flex items-center bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 animate-fade-in-up';
            chip.innerHTML = `<span>${prov.nombre}</span><button type="button" class="ml-2 text-blue-600 hover:text-red-600 remove-prov-chip" data-index="${index}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
            container.appendChild(chip);
        });
        container.querySelectorAll('.remove-prov-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                this.selectedProductProviders.splice(idx, 1);
                this.renderProviderChips();
                if (this.selectedProductProviders.length === 0) {
                   this.currentCategories = [];
                   const catInput = this.getElementInModal('item-modal-container', '#item-category-search');
                   if(catInput) { catInput.value = ''; catInput.disabled = true; catInput.classList.add('bg-gray-100', 'cursor-not-allowed'); }
                }
            });
        });
    },

    setupSearch(modalId, inputId, listId, fetchDataFn, onSelectFn) {
        const input = this.getElementInModal(modalId, `#${inputId}`);
        const list = this.getElementInModal(modalId, `#${listId}`);
        if (!input || !list) return;

        const renderList = async (query) => {
            try {
                const results = await fetchDataFn(query);
                list.innerHTML = '';
                if (!results || results.length === 0) {
                    list.innerHTML = '<div class="p-3 text-gray-500 text-sm italic">No se encontraron datos</div>';
                } else {
                    results.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-sm transition-colors flex justify-between items-center';
                        div.innerHTML = item.nombre ? `<span class="font-bold text-gray-800">${item.nombre}</span>` : `<span class="font-medium text-gray-700">${item.name || item}</span>`;
                        div.addEventListener('click', (e) => {
                            e.stopPropagation();
                            onSelectFn(item);
                            list.classList.add('hidden');
                        });
                        list.appendChild(div);
                    });
                }
                list.classList.remove('hidden');
            } catch (err) { console.error(err); }
        };

        input.addEventListener('input', (e) => renderList(e.target.value));
        input.addEventListener('click', () => { if(!input.disabled) renderList(''); });
        document.addEventListener('click', (e) => {
            if (document.body.contains(input) && !input.contains(e.target) && !list.contains(e.target)) list.classList.add('hidden');
        });
    },

    async handleTableAction(e) {
        const btnEdit = e.target.closest('.btn-edit-item');
        const btnDelete = e.target.closest('.btn-delete-item');

        if (btnEdit) {
            const sku = btnEdit.dataset.sku;
            const product = await StockService.getProductBySku(sku);
            if (product) {
                this.currentCategories = []; 
                window.UI.showModal('item-modal-container', 'item-modal-content');
                setTimeout(() => {
                    this.setupItemProviderSearch(); 
                    this.setupCategorySearch();
                    const container = document.getElementById('item-modal-container');
                    container.querySelector('#item-modal-title').textContent = 'Editar Insumo';
                    container.querySelector('#item-edit-mode').value = 'true';
                    container.querySelector('#item-original-sku').value = sku;
                    this.selectedProductProviders = product.proveedores ? [...product.proveedores] : (product.proveedor_id ? [{id: product.proveedor_id, nombre: product.proveedor_nombre}] : []);
                    this.renderProviderChips();
                    container.querySelector('#item-sku-display').value = sku;
                    container.querySelector('#item-name').value = product.nombre;
                    container.querySelector('#item-price').value = product.precio || '';
                    container.querySelector('#item-stock').value = product.stock;
                    container.querySelector('#item-min').value = product.min;
                    container.querySelector('#item-abc').value = product.abc || 'A';
                    container.querySelector('#item-desc').value = product.descripcion || '';
                    const catInput = container.querySelector('#item-category-search');
                    catInput.disabled = false;
                    catInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
                    catInput.value = product.categoria;
                    this.currentCategories = [product.categoria]; 
                }, 100);
            }
        }

        if (btnDelete) {
            e.preventDefault(); 
            const sku = btnDelete.dataset.sku;
            const name = btnDelete.dataset.name;

            const confirmHtml = `
                <p class="text-gray-500 text-sm mb-5">
                    ¿Estás seguro de que deseas eliminar este insumo del inventario?
                </p>
                <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center text-left mb-4 shadow-sm">
                    <div class="h-10 w-10 rounded-lg bg-white flex items-center justify-center text-gray-400 border border-gray-200 mr-3 flex-shrink-0 font-bold text-xs">
                        <i data-lucide="package" class="w-5 h-5 text-red-400"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-gray-800 leading-tight">${name}</p>
                        <p class="text-xs text-gray-500 mt-0.5">SKU: ${sku}</p>
                    </div>
                </div>
                <p class="text-xs text-red-400 italic">Esta acción no se puede deshacer.</p>
            `;

            if (window.UI && window.UI.showConfirmModal) {
                window.UI.showConfirmModal('Eliminar Insumo', confirmHtml, 'Eliminar', async () => {
                    await StockService.deleteProduct(sku);
                    window.UI.showNotification('Atención', 'Producto eliminado correctamente.');
                    this.applyFilters();
                    this.setupCategoryFilter(); 
                });
            } else {
                console.error("UI Module or showConfirmModal missing");
                if(confirm("¿Eliminar " + name + "?")) {
                    await StockService.deleteProduct(sku);
                    this.applyFilters();
                }
            }
        }
    },

    async handleItemSubmit(e) {
        if (e.target.id === 'item-form') {
            e.preventDefault();
            const form = e.target;
            const isEdit = form.querySelector('#item-edit-mode').value === 'true';
            const originalSku = form.querySelector('#item-original-sku').value;

            if (this.selectedProductProviders.length === 0) return window.UI.showNotification('Error', 'Seleccione al menos un proveedor.');

            const itemData = {
                proveedores: this.selectedProductProviders,
                proveedor_id: this.selectedProductProviders[0].id,
                proveedor_nombre: this.selectedProductProviders[0].nombre,
                nombre: form.querySelector('#item-name').value,
                categoria: form.querySelector('#item-category-search').value,
                abc: form.querySelector('#item-abc').value,
                precio: parseFloat(form.querySelector('#item-price').value) || 0,
                stock: parseInt(form.querySelector('#item-stock').value) || 0,
                min: parseInt(form.querySelector('#item-min').value) || 0,
                descripcion: form.querySelector('#item-desc').value
            };
            if(!itemData.categoria) return window.UI.showNotification('Atención', 'La categoría es obligatoria.');

            if (isEdit) {
                await StockService.updateProduct(originalSku, itemData);
                window.UI.showNotification('Actualizado', 'Producto modificado.');
            } else {
                await StockService.addProduct(itemData);
                window.UI.showNotification('Éxito', 'Producto agregado.');
            }
            window.UI.hideModal('item-modal-container');
            await this.applyFilters();
            this.setupCategoryFilter();
        }
    },

    handleOCClick(e) {
        const modalContainerOC = document.getElementById('oc-modal-container');
        const btnAdd = e.target.closest('#btn-add-oc-item');
        if (btnAdd) {
            e.preventDefault();
            const nameInput = modalContainerOC.querySelector('#oc-product-search');
            const qtyInput = modalContainerOC.querySelector('#oc-qty');
            const name = nameInput?.value.trim();
            const qty = parseFloat(qtyInput?.value);
            if (name && qty > 0) {
                let price = 0;
                if (this.tempSelectedProduct && this.tempSelectedProduct.nombre === name) price = parseFloat(this.tempSelectedProduct.precio || 0);
                this.ocItems.push({ producto: name, cantidad: qty, precio: price });
                this.renderOCItems();
                nameInput.value = ''; qtyInput.value = ''; this.tempSelectedProduct = null; nameInput.focus();
            } else { window.UI.showNotification('Error', 'Datos inválidos.'); }
        }
        const btnRemove = e.target.closest('.remove-item');
        if (btnRemove) {
            const idx = parseInt(btnRemove.dataset.idx);
            this.ocItems.splice(idx, 1);
            this.renderOCItems();
        }
    },

    async handleOCSubmit(e) {
        if (e.target.id === 'oc-form') {
            e.preventDefault();
            const form = e.target;
            const pid = form.querySelector('#oc-provider-id').value;
            if(!pid || this.ocItems.length === 0) return window.UI.showNotification('Error', 'Datos incompletos.');
            
            // Calculo de subtotal e IGV
            const subtotal = this.ocItems.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
            const igv = subtotal * 0.18;
            const total = subtotal + igv;
            
            const newOC = {
                proveedor_id: pid,
                proveedor_nombre: form.querySelector('#oc-provider-search').value,
                items: this.ocItems,
                total: total, // Se envía el total final (incluido IGV)
                notas: form.querySelector('#oc-notes').value
            };
            await StockService.createOC(newOC);
            window.UI.hideModal('oc-modal-container');
            window.UI.showNotification('Éxito', 'Orden de Compra generada.');
        }
    },

    setupOCProviderSearch() {
        this.setupSearch('oc-modal-container', 'oc-provider-search', 'oc-provider-list', async (q) => await StockService.searchProviders(q), (p) => {
            const nameInput = this.getElementInModal('oc-modal-container', '#oc-provider-search');
            const idInput = this.getElementInModal('oc-modal-container', '#oc-provider-id');
            if(nameInput) nameInput.value = p.name; if(idInput) idInput.value = p.id;
            this.ocItems = []; this.renderOCItems();
            const prodInput = this.getElementInModal('oc-modal-container', '#oc-product-search');
            if (prodInput) { prodInput.disabled = false; prodInput.placeholder = `Buscar productos de ${p.name}...`; prodInput.value = ''; prodInput.focus(); }
        });
    },
    setupOCProductSearch() {
        this.setupSearch('oc-modal-container', 'oc-product-search', 'oc-product-list', async (q) => {
            const pid = this.getElementInModal('oc-modal-container', '#oc-provider-id')?.value;
            return pid ? await StockService.getProductsForProvider(pid, q) : [];
        }, (p) => {
            this.tempSelectedProduct = p; 
            const prodInput = this.getElementInModal('oc-modal-container', '#oc-product-search');
            const qtyInput = this.getElementInModal('oc-modal-container', '#oc-qty');
            if(prodInput) prodInput.value = p.nombre; if(qtyInput) { qtyInput.value = ''; qtyInput.focus(); }
        });
    },
    setupItemProviderSearch() {
        this.setupSearch('item-modal-container', 'item-provider-search', 'item-provider-list', async (q) => await StockService.searchProviders(q), (p) => {
            if (!this.selectedProductProviders.some(x => x.id === p.id)) {
                this.selectedProductProviders.push({ id: p.id, nombre: p.name });
                this.renderProviderChips(); 
                const newCats = p.insumos ? p.insumos.split(',').map(s => s.trim()) : [];
                this.currentCategories = [...new Set([...this.currentCategories, ...newCats])];
                const input = this.getElementInModal('item-modal-container', '#item-provider-search');
                input.value = ''; 
                const catInput = this.getElementInModal('item-modal-container', '#item-category-search');
                if (catInput) { catInput.disabled = false; catInput.classList.remove('bg-gray-100', 'cursor-not-allowed'); }
            }
        });
    },
    setupCategorySearch() {
        this.setupSearch('item-modal-container', 'item-category-search', 'item-category-list', async (q) => { const c = this.currentCategories; return q ? c.filter(x => x.toLowerCase().includes(q.toLowerCase())) : c; }, (cat) => {
            this.getElementInModal('item-modal-container', '#item-category-search').value = cat;
        });
    },

    renderOCItems() {
        const tbody = this.getElementInModal('oc-modal-container', '#oc-items-table-body');
        if(!tbody) return;
        tbody.innerHTML = '';
        let subtotal = 0;
        this.ocItems.forEach((item, idx) => {
            const totalItem = item.cantidad * item.precio; 
            subtotal += totalItem;
            tbody.innerHTML += `<tr class="border-b hover:bg-gray-50"><td class="p-2 text-gray-700">${item.producto}</td><td class="p-2 text-right">S/ ${item.precio.toFixed(2)}</td><td class="p-2 text-right">${item.cantidad}</td><td class="p-2 text-right font-bold">S/ ${totalItem.toFixed(2)}</td><td class="p-2 text-right"><button type="button" class="text-red-500 hover:text-red-700 remove-item p-1" data-idx="${idx}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
        });
        
        const igv = subtotal * 0.18;
        const total = subtotal + igv;

        const container = document.getElementById('oc-modal-container');
        if(container) {
            container.querySelector('#oc-display-subtotal').textContent = `S/ ${subtotal.toFixed(2)}`;
            container.querySelector('#oc-display-igv').textContent = `S/ ${igv.toFixed(2)}`;
            container.querySelector('#oc-display-total').textContent = `S/ ${total.toFixed(2)}`;
        }
        if(window.lucide) window.lucide.createIcons();
    },

    setupEvents() {
        const resetPageAndFilter = () => { this.currentPage = 1; this.applyFilters(); };
        document.getElementById('search-input')?.addEventListener('input', resetPageAndFilter);
        document.getElementById('filter-category')?.addEventListener('change', resetPageAndFilter);
        document.getElementById('filter-status')?.addEventListener('change', resetPageAndFilter);
        document.getElementById('filter-abc')?.addEventListener('change', resetPageAndFilter);

        if (!this._boundHandleOCClick) {
            this._boundHandleOCClick = this.handleOCClick.bind(this);
            this._boundHandleOCSubmit = this.handleOCSubmit.bind(this);
            this._boundHandleItemSubmit = this.handleItemSubmit.bind(this);
            this._boundHandleTableAction = this.handleTableAction.bind(this);
        }

        const tableBody = document.getElementById('inventory-table-body');
        if (tableBody) { tableBody.removeEventListener('click', this._boundHandleTableAction); tableBody.addEventListener('click', this._boundHandleTableAction); }

        const modalOC = document.getElementById('oc-modal-container');
        if (modalOC) { modalOC.removeEventListener('click', this._boundHandleOCClick); modalOC.removeEventListener('submit', this._boundHandleOCSubmit); modalOC.addEventListener('click', this._boundHandleOCClick); modalOC.addEventListener('submit', this._boundHandleOCSubmit); }

        const modalItem = document.getElementById('item-modal-container');
        if (modalItem) { modalItem.removeEventListener('submit', this._boundHandleItemSubmit); modalItem.addEventListener('submit', this._boundHandleItemSubmit); }

        document.getElementById('btn-add-item')?.addEventListener('click', () => {
            this.currentCategories = []; this.selectedProductProviders = []; 
            window.UI.showModal('item-modal-container', 'item-modal-content');
            setTimeout(() => {
                const c = document.getElementById('item-modal-container');
                c.querySelector('#item-form').reset();
                c.querySelector('#item-modal-title').textContent = 'Agregar Nuevo Insumo';
                c.querySelector('#item-edit-mode').value = 'false';
                c.querySelector('#item-category-search').disabled = true;
                c.querySelector('#item-category-search').classList.add('bg-gray-100', 'cursor-not-allowed');
                this.renderProviderChips(); this.setupItemProviderSearch(); this.setupCategorySearch(); 
            }, 100);
        });

        document.getElementById('btn-create-oc')?.addEventListener('click', () => {
            this.ocItems = [];
            window.UI.showModal('oc-modal-container', 'oc-modal-content');
            setTimeout(() => { 
                document.getElementById('oc-form').reset();
                document.getElementById('oc-provider-id').value = '';
                document.getElementById('oc-display-subtotal').textContent = 'S/ 0.00';
                document.getElementById('oc-display-igv').textContent = 'S/ 0.00';
                document.getElementById('oc-display-total').textContent = 'S/ 0.00';
                this.setupOCProviderSearch(); this.setupOCProductSearch(); this.renderOCItems(); 
            }, 100);
        });
    }
};