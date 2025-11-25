/**
 * js/controllers/recepcion.controller.js
 * Controlador Completo: 
 * - Tabs (Pendientes / Historial).
 * - Paginación (Estilo Usuarios).
 * - Buscador Global.
 * - PDF y Lógica de Recepción.
 */
import { RecepcionService } from '../services/recepcion.service.js';

export const RecepcionController = {
    currentOC: null,
    allOCs: [],
    
    // Estado de UI y Paginación
    activeTab: 'pending', // 'pending' o 'completed'
    currentPage: 1,
    itemsPerPage: 10,
    
    // Almacenes de datos filtrados para paginación
    filteredPending: [],
    filteredCompleted: [],

    _boundHandleReceiveSubmit: null,

    init: async function() {
        console.log("RecepcionController inicializado.");
        this.setupTabs();
        this.allOCs = await RecepcionService.getPendingOCs(); 
        this.applyFilters(); 
        this.setupEvents();
    },

    setupTabs: function() {
        // Función global llamada por el HTML onclick
        window.switchTab = (tabName) => {
            this.activeTab = tabName;
            this.currentPage = 1; // Resetear página al cambiar tab

            // Actualizar estilos de botones (UI)
            const btnPending = document.getElementById('tab-btn-pending');
            const btnCompleted = document.getElementById('tab-btn-completed');
            const viewPending = document.getElementById('view-pending');
            const viewCompleted = document.getElementById('view-completed');

            if (tabName === 'pending') {
                btnPending.className = "px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 focus:outline-none transition-colors";
                btnCompleted.className = "px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors border-b-2 border-transparent hover:border-gray-300";
                viewPending.classList.remove('hidden');
                viewCompleted.classList.add('hidden');
            } else {
                btnPending.className = "px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors border-b-2 border-transparent hover:border-gray-300";
                btnCompleted.className = "px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 focus:outline-none transition-colors";
                viewPending.classList.add('hidden');
                viewCompleted.classList.remove('hidden');
            }

            // Renderizar datos del tab seleccionado
            this.updateActiveView();
        };
        
        if(window.lucide) window.lucide.createIcons();
    },

    applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';

        // 1. Filtrar todo primero
        const filtered = this.allOCs.filter(oc => {
            return (oc.id && oc.id.toLowerCase().includes(searchTerm)) || 
                   (oc.proveedor_nombre && oc.proveedor_nombre.toLowerCase().includes(searchTerm));
        });

        // 2. Separar en listas
        this.filteredPending = [];
        this.filteredCompleted = [];

        filtered.forEach(oc => {
            const estado = oc.estado ? oc.estado.trim().toLowerCase() : '';
            const isCompleted = estado.includes('completada') || estado.includes('recibida') || estado.includes('finalizada');
            
            if (isCompleted) {
                this.filteredCompleted.push(oc);
            } else {
                this.filteredPending.push(oc);
            }
        });

        // 3. Resetear página y renderizar la vista actual
        this.currentPage = 1;
        this.updateActiveView();
    },

    updateActiveView() {
        // Determinar qué lista usar según el tab activo
        const list = this.activeTab === 'pending' ? this.filteredPending : this.filteredCompleted;
        
        // Calcular paginación
        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedItems = list.slice(startIndex, endIndex);

        // Renderizar tabla correspondiente
        if (this.activeTab === 'pending') {
            this.renderPendingTable(paginatedItems);
        } else {
            this.renderCompletedTable(paginatedItems);
        }

        // Renderizar controles de paginación
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderPagination(totalItems, startItem, endItem, totalPages) {
        const container = document.getElementById('pagination-controls');
        if (!container) return;

        if (totalItems === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500">No hay resultados en esta vista.</span>';
            return;
        }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> órdenes
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

        // Listeners de paginación
        document.getElementById('btn-prev-page')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateActiveView();
            }
        });

        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updateActiveView();
            }
        });
    },

    renderPendingTable(ocs) {
        const tbody = document.getElementById('pending-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (ocs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500 italic bg-gray-50">No hay órdenes pendientes.</td></tr>';
            return;
        }

        ocs.forEach(oc => {
            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4 text-sm font-mono text-gray-500">
                        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 font-bold">${oc.id}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-8 w-8 rounded bg-orange-50 flex items-center justify-center text-orange-600 mr-3 border border-orange-100">
                                <i data-lucide="building-2" class="w-4 h-4"></i>
                            </div>
                            <span class="text-sm font-bold text-gray-900">${oc.proveedor_nombre}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        ${oc.fecha}
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            Enviada
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                            <button class="btn-receive flex items-center justify-center px-3 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all transform active:scale-95" data-id="${oc.id}" title="Recibir Mercancía">
                                <i data-lucide="package-check" class="w-3.5 h-3.5 mr-1.5"></i> Recibir
                            </button>
                            <button class="btn-download text-gray-500 p-2 rounded-lg hover:bg-gray-100 border border-transparent hover:border-gray-200 transition" title="Descargar PDF" data-id="${oc.id}">
                                <i data-lucide="file-down" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        if(window.lucide) window.lucide.createIcons();
    },

    renderCompletedTable(ocs) {
        const tbody = document.getElementById('completed-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (ocs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500 italic bg-gray-50">No hay historial de órdenes completadas.</td></tr>';
            return;
        }

        ocs.forEach(oc => {
            const fechaRecepcionDisplay = oc.fecha_recepcion || '<span class="text-xs text-gray-400">---</span>';

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4 text-sm font-mono text-gray-500">
                        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 font-bold">${oc.id}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-8 w-8 rounded bg-green-50 flex items-center justify-center text-green-600 mr-3 border border-green-100">
                                <i data-lucide="check-check" class="w-4 h-4"></i>
                            </div>
                            <span class="text-sm font-bold text-gray-900">${oc.proveedor_nombre}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        ${oc.fecha}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700 font-medium">
                        ${fechaRecepcionDisplay}
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            Recibida Completa
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                            <button class="btn-download text-gray-500 p-2 rounded-lg hover:bg-gray-100 border border-transparent hover:border-gray-200 transition" title="Ver PDF" data-id="${oc.id}">
                                <i data-lucide="file-text" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        if(window.lucide) window.lucide.createIcons();
    },

    renderModalItemsInContainer(oc) {
        const container = document.getElementById('receive-modal-container');
        if (!container) return;
        
        const title = container.querySelector('h3');
        if (title) title.innerHTML = `Recibir Mercancía <span class="text-gray-400 font-normal ml-2 text-base">| OC: ${oc.id}</span>`;
        
        const tbody = container.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
            oc.items.forEach(item => {
                const row = `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-sm font-medium text-gray-800 item-name border-b border-gray-100">
                            ${item.producto}
                        </td>
                        <td class="px-4 py-3 text-sm text-center text-gray-600 border-b border-gray-100">
                            <span class="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono font-bold">${item.cantidad}</span>
                        </td>
                        <td class="px-4 py-3 text-center border-b border-gray-100">
                            <input type="number" value="${item.cantidad}" max="${item.cantidad}" min="0" class="item-qty block w-20 mx-auto py-1.5 px-2 text-center text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow">
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        }
    },

    async handleReceiveSubmit(e) {
        if (e.target.id === 'receive-form') {
            e.preventDefault();
            const form = e.target;
            const itemsReceived = [];
            form.querySelectorAll('tbody tr').forEach(row => {
                itemsReceived.push({
                    producto: row.querySelector('.item-name').textContent.trim(),
                    cantidad: row.querySelector('.item-qty').value
                });
            });
            const comments = form.querySelector('textarea').value;
            
            await RecepcionService.receiveOC(this.currentOC.id, itemsReceived, comments);
            window.UI.hideModal('receive-modal-container');
            window.UI.showNotification('Recepción Exitosa', 'Stock actualizado y movido al historial.');
            
            this.allOCs = await RecepcionService.getPendingOCs(); 
            this.applyFilters();
        }
    },

    // PDF Lógica (Intacta)
    async downloadPDFDirectly(ocId) {
        if (!window.html2pdf) await this.loadHtml2PdfLibrary();
        const response = await RecepcionService.getOCForPDF(ocId);
        if (!response.success) { alert("Error: OC no encontrada."); return; }
        const data = response.data;
        const element = document.createElement('div');
        element.innerHTML = this.getOCTemplate(data);
        const opt = { margin: 10, filename: `${data.numero}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        try { await html2pdf().set(opt).from(element).save(); } catch (error) { console.error("Error PDF:", error); }
    },

    loadHtml2PdfLibrary() {
        return new Promise((resolve, reject) => {
            if (window.html2pdf) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    getOCTemplate(data) {
        const itemsHtml = data.items ? data.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.producto}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.cantidad}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${parseFloat(item.precio || 0).toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${(parseFloat(item.precio || 0) * parseFloat(item.cantidad)).toFixed(2)}</td>
            </tr>`).join('') : '';

        return `
            <div style="font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; background: white;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #c0392b; padding-bottom: 20px;">
                    <div><h1 style="color: #c0392b; margin: 0; font-size: 24px;">IMPRESOS S.R.L.</h1><p style="margin: 5px 0; font-size: 14px;">Av. Ferrocarril 781, Huancayo 12001</p><p style="margin: 5px 0; font-size: 14px; font-weight: bold;">RUC: 20486277069</p></div>
                    <div style="text-align: right;"><div style="font-size: 20px; font-weight: bold; color: #555;">ORDEN DE COMPRA</div><div style="font-size: 18px; color: #c0392b; margin-top: 5px;">${data.numero}</div><p style="margin-top: 5px; font-size: 13px;">Fecha: ${data.fecha_emision}</p></div>
                </div>
                <div style="margin-bottom: 30px; background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 14px;">
                    <table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 4px 0; width: 100px;"><strong>Proveedor:</strong></td><td>${data.proveedor_nombre}</td></tr><tr><td><strong>RUC/DNI:</strong></td><td>${data.proveedor_doc}</td></tr><tr><td><strong>Dirección:</strong></td><td>${data.proveedor_direccion}</td></tr></table>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;"><thead><tr style="background: #333; color: white;"><th style="padding: 10px; text-align: left;">Producto</th><th style="padding: 10px; text-align: center;">Cant.</th><th style="padding: 10px; text-align: right;">P. Unit</th><th style="padding: 10px; text-align: right;">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                <div style="float: right; width: 250px; font-size: 14px;"><div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Subtotal:</span> <span>S/ ${data.subtotal}</span></div><div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>IGV (18%):</span> <span>S/ ${data.igv}</span></div><div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #333; font-weight: bold; font-size: 16px;"><span>TOTAL:</span> <span>S/ ${data.total}</span></div></div>
            </div>`;
    },

    setupEvents() {
        document.getElementById('search-input')?.addEventListener('input', () => this.applyFilters());

        const handleTableClick = async (e) => {
            const btnReceive = e.target.closest('.btn-receive');
            if (btnReceive) {
                const ocId = btnReceive.dataset.id;
                this.currentOC = await RecepcionService.getOCById(ocId);
                if (!this.currentOC) this.currentOC = this.allOCs.find(oc => oc.id === ocId);

                if(this.currentOC) {
                    window.UI.showModal('receive-modal-container', 'receive-modal-content');
                    setTimeout(() => this.renderModalItemsInContainer(this.currentOC), 50);
                }
            }
            const btnDownload = e.target.closest('.btn-download');
            if (btnDownload) {
                const ocId = btnDownload.dataset.id;
                const originalContent = btnDownload.innerHTML;
                btnDownload.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>`;
                if(window.lucide) window.lucide.createIcons();
                this.downloadPDFDirectly(ocId).finally(() => {
                    btnDownload.innerHTML = originalContent;
                    if(window.lucide) window.lucide.createIcons();
                });
            }
        };

        const pendingTbody = document.getElementById('pending-table-body');
        if (pendingTbody) {
             const newBody = pendingTbody.cloneNode(true);
             pendingTbody.parentNode.replaceChild(newBody, pendingTbody);
             newBody.addEventListener('click', handleTableClick);
        }

        const completedTbody = document.getElementById('completed-table-body');
        if (completedTbody) {
             const newBody = completedTbody.cloneNode(true);
             completedTbody.parentNode.replaceChild(newBody, completedTbody);
             newBody.addEventListener('click', handleTableClick);
        }

        const modalContainer = document.getElementById('receive-modal-container');
        if (modalContainer) {
            if (!this._boundHandleReceiveSubmit) {
                this._boundHandleReceiveSubmit = this.handleReceiveSubmit.bind(this);
            }
            modalContainer.removeEventListener('submit', this._boundHandleReceiveSubmit);
            modalContainer.addEventListener('submit', this._boundHandleReceiveSubmit);
        }
    }
};