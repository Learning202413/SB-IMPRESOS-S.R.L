/**
 * js/controllers/facturacion.controller.js
 * Controlador de Documentos Fiscales.
 * CORRECCIÓN: Carga automática de Flatpickr (Calendario) si no existe.
 */
import { FacturacionService } from '../services/facturacion.service.js';

export const FacturacionController = {
    // Estado de la vista
    currentPage: 1,
    itemsPerPage: 10,
    
    // Almacenamiento de datos
    allDocuments: [],
    filteredDocuments: [],

    // Estado de filtros
    filters: {
        search: '',
        docType: '', // 'FACTURA' o 'BOLETA'
        startDate: null,
        endDate: null
    },

    init: async function() {
        console.log("FacturacionController Inicializado.");
        
        // 1. Cargar dependencias (Calendario) si faltan
        await this.loadFlatpickr();

        // 2. Configurar UI
        this.setupDropdownHelpers();
        this.setupDatepicker();
        
        // 3. Cargar datos
        await this.loadAndRender();
        this.setupEvents();
    },

    // --- 0. CARGADOR DE LIBRERÍA CALENDARIO (FIX) ---
    async loadFlatpickr() {
        if (window.flatpickr) return; // Ya está cargado

        console.log("Cargando librería de calendario...");
        
        // 1. Cargar CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        document.head.appendChild(link);

        // 2. Cargar JS y esperar
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
            script.onload = () => {
                // Cargar idioma español opcionalmente
                const langScript = document.createElement('script');
                langScript.src = 'https://npmcdn.com/flatpickr/dist/l10n/es.js';
                langScript.onload = resolve;
                document.head.appendChild(langScript);
            };
            document.head.appendChild(script);
        });
    },

    // --- 1. CONFIGURACIÓN DEL DATEPICKER ---
    setupDatepicker() {
        const dateInput = document.getElementById('filter-date-range');
        
        if (dateInput && window.flatpickr) {
            window.flatpickr(dateInput, {
                mode: "range", 
                dateFormat: "d/m/Y", 
                locale: "es", // Español
                altInput: true, 
                altFormat: "d M Y", // Ej: 16 Nov 2025
                maxDate: "today", 
                
                onChange: (selectedDates) => {
                    if (selectedDates.length === 0) {
                        this.filters.startDate = null;
                        this.filters.endDate = null;
                    } else {
                        // Inicio del día (00:00:00)
                        this.filters.startDate = new Date(selectedDates[0]);
                        this.filters.startDate.setHours(0, 0, 0, 0);

                        // Fin del día o rango (23:59:59)
                        let endRaw = selectedDates.length === 2 ? selectedDates[1] : selectedDates[0];
                        this.filters.endDate = new Date(endRaw);
                        this.filters.endDate.setHours(23, 59, 59, 999);
                    }
                    console.log("Filtro fecha:", this.filters.startDate, this.filters.endDate);
                    this.currentPage = 1;
                    this.applyFilters();
                }
            });
        }
    },

    // --- 2. HELPERS VISUALES (DROPDOWNS) ---
    setupDropdownHelpers: function() {
        window.toggleDropdown = (menuId, chevronId) => {
            const menu = document.getElementById(menuId);
            const chevron = document.getElementById(chevronId);
            if (!menu) return;

            // Cerrar otros dropdowns
            document.querySelectorAll('[id$="-dropdown"]').forEach(el => { if(el.id !== menuId) el.classList.add('hidden'); });
            document.querySelectorAll('[id$="-chevron"]').forEach(el => { if(el.id !== chevronId) el.style.transform = 'rotate(0deg)'; });

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

        // Cerrar al hacer clic fuera (Ignorando el calendario)
        window.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.flatpickr-calendar')) {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id$="-chevron"]').forEach(el => el.style.transform = 'rotate(0deg)');
            }
        });
    },

    // --- 3. PARSEO DE FECHAS (Robust Date Parser) ---
    parseLogDate(dateString) {
        if (!dateString) return null;
        const str = dateString.toString().trim();

        try {
            // Formatos ISO y estándar
            const nativeDate = new Date(str);
            if (!isNaN(nativeDate.getTime()) && str.includes('-')) return nativeDate;

            // Formato textual en español (ej: "16 nov 2025, 17:15")
            const cleanStr = str.toLowerCase().replace(/,/g, ''); 
            const parts = cleanStr.split(' '); 
            const months = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };

            let day, year, monthVal;
            parts.forEach(part => {
                if (months[part.substring(0, 3)] !== undefined) {
                    monthVal = months[part.substring(0, 3)];
                } else if (!isNaN(part) && part.length === 4) {
                    year = parseInt(part);
                } else if (!isNaN(part) && part.length <= 2 && !day) {
                    day = parseInt(part);
                }
            });

            if (day && year && monthVal !== undefined) {
                const resultDate = new Date(year, monthVal, day);
                // Intentar hora si existe
                const timePart = parts.find(p => p.includes(':'));
                if (timePart) {
                    const [h, m] = timePart.split(':');
                    resultDate.setHours(h || 0, m || 0, 0);
                }
                return resultDate;
            }
            return null;
        } catch (e) {
            console.error("Error fecha:", str, e);
            return null;
        }
    },

    // --- 4. CARGA Y FILTRADO ---
    async loadAndRender() {
        this.allDocuments = await FacturacionService.getAllDocuments();
        this.applyFilters();
    },

    applyFilters() {
        const searchTerm = this.filters.search.toLowerCase();
        const docTypeFilter = this.filters.docType; // 'FACTURA' o 'BOLETA' o ''

        this.filteredDocuments = this.allDocuments.filter(doc => {
            // A. Filtro Texto
            const textMatch = 
                doc.numero.toLowerCase().includes(searchTerm) ||
                doc.cliente_nombre.toLowerCase().includes(searchTerm) ||
                doc.ot_id.toLowerCase().includes(searchTerm);

            // B. Filtro Tipo (Dropdown)
            const typeMatch = docTypeFilter ? doc.tipo === docTypeFilter : true;

            // C. Filtro Fechas
            let dateMatch = true;
            if (this.filters.startDate && this.filters.endDate) {
                const docDate = this.parseLogDate(doc.fecha_emision);
                if (docDate) {
                    const t = docDate.getTime();
                    const start = this.filters.startDate.getTime();
                    const end = this.filters.endDate.getTime();
                    dateMatch = t >= start && t <= end;
                } else {
                    dateMatch = false;
                }
            }

            return textMatch && typeMatch && dateMatch;
        });

        // Paginación
        const totalItems = this.filteredDocuments.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);

        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedDocs = this.filteredDocuments.slice(startIndex, endIndex);

        this.renderTable(paginatedDocs);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    // --- 5. RENDERIZADO VISUAL ---
    renderTable(documents) {
        const tbody = document.getElementById('documents-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (documents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500 italic bg-gray-50">No se encontraron documentos fiscales con los filtros actuales.</td></tr>`;
            return;
        }

        documents.forEach(doc => {
            const isFactura = doc.tipo === 'FACTURA';
            const typeBadge = isFactura 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Factura Elec.</span>`
                : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">Boleta Elec.</span>`;

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4">${typeBadge}</td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 font-mono">
                        <div class="flex items-center">
                            <i data-lucide="hash" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${doc.numero}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">
                        <div class="font-bold text-gray-800">${doc.cliente_nombre}</div>
                        <div class="text-xs text-gray-500 flex items-center mt-0.5">
                            <i data-lucide="credit-card" class="w-3 h-3 mr-1 text-gray-400"></i>
                            ${doc.cliente_doc}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">
                        <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 text-xs font-semibold">
                            ${doc.ot_id}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                         <div class="flex items-center">
                            <i data-lucide="calendar" class="w-3 h-3 mr-1.5 text-gray-400"></i>
                            ${doc.fecha_emision}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-bold text-right text-gray-900">
                        S/ ${doc.total}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                        <button class="btn-download text-red-600 p-2 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition inline-flex items-center justify-center" title="Descargar PDF" data-id="${doc.id}">
                            <i data-lucide="file-down" class="w-5 h-5"></i>
                        </button>
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
        if (totalItems === 0) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> documentos
            </div>
            <div class="flex space-x-2">
                <button id="btn-prev-page" class="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i data-lucide="chevron-left" class="w-4 h-4 text-gray-600"></i>
                </button>
                <span class="px-3 py-1 text-sm font-medium text-gray-700">Página ${this.currentPage}</span>
                <button id="btn-next-page" class="px-3 py-1 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-600"></i>
                </button>
            </div>
        `;
        document.getElementById('btn-prev-page')?.addEventListener('click', () => {
            if (this.currentPage > 1) { this.currentPage--; this.applyFilters(); }
        });
        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) { this.currentPage++; this.applyFilters(); }
        });
        if(window.lucide) window.lucide.createIcons();
    },

    setupEvents() {
        // Búsqueda
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
        });

        // Dropdown (Hidden Input)
        document.getElementById('filter-doctype')?.addEventListener('change', (e) => {
            this.filters.docType = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
        });

        // Botón Limpiar
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            this.filters.search = '';
            this.filters.docType = '';
            this.filters.startDate = null;
            this.filters.endDate = null;
            
            // Reset UI
            document.getElementById('search-input').value = '';
            document.getElementById('selected-doctype-text').innerText = 'Todos los Tipos';
            document.getElementById('filter-doctype').value = '';
            
            const fp = document.getElementById('filter-date-range')._flatpickr;
            if(fp) fp.clear();
            
            this.currentPage = 1;
            this.applyFilters();
        });
        
        // Eventos Tabla (Descarga PDF)
        const tbody = document.getElementById('documents-table-body');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-download');
                if (btn) {
                    const docId = btn.dataset.id;
                    const originalContent = btn.innerHTML;
                    btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin text-red-600"></i>`; 
                    if(window.lucide) window.lucide.createIcons();
                    
                    this.downloadPDFDirectly(docId).finally(() => {
                        btn.innerHTML = originalContent;
                        if(window.lucide) window.lucide.createIcons();
                    });
                }
            });
        }
    },

    // --- (Funciones de PDF y Template se mantienen igual) ---
    async downloadPDFDirectly(docId) {
        if (!window.html2pdf) await this.loadHtml2PdfLibrary();
        const doc = this.allDocuments.find(d => d.id === docId);
        if (!doc) { alert("Error: No se encontró el documento."); return; }

        const element = document.createElement('div');
        element.innerHTML = this.getInvoiceTemplate(doc);
        const opt = {
            margin: 10, filename: `${doc.numero}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        try { await html2pdf().set(opt).from(element).save(); } 
        catch (error) { console.error("Error PDF:", error); alert("Error al generar PDF."); }
    },

    loadHtml2PdfLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    getInvoiceTemplate(doc) {
        // ... (Tu plantilla HTML de factura original se mantiene aquí intacta) ...
        const itemsHtml = doc.items ? doc.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.descripcion || item.producto || 'Servicio'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.cantidad || 1}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${parseFloat(item.precio || item.precio_unitario || 0).toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${parseFloat(item.subtotal || item.total || 0).toFixed(2)}</td>
            </tr>
        `).join('') : '<tr><td colspan="4">Sin detalles</td></tr>';

        return `
            <div style="font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; background: white;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #c0392b; padding-bottom: 20px;">
                    <div>
                        <h1 style="color: #c0392b; margin: 0; font-size: 24px;">IMPRESOS S.R.L.</h1>
                        <p style="margin: 5px 0; font-size: 14px;">Av. Ferrocarril 781, Huancayo 12001</p>
                        <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">RUC: 20486277069</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: bold; color: #555;">${doc.tipo === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA'}</div>
                        <div style="font-size: 18px; color: #c0392b; margin-top: 5px;">${doc.numero}</div>
                        <p style="margin-top: 5px; font-size: 13px;">Fecha: ${doc.fecha_emision}</p>
                    </div>
                </div>

                <div style="margin-bottom: 30px; background: #f8f9fa; padding: 15px; border-radius: 8px; font-size: 14px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 4px 0; width: 80px;"><strong>Cliente:</strong></td>
                            <td style="padding: 4px 0;">${doc.cliente_nombre}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>${doc.cliente_doc.length === 11 ? 'RUC' : 'DNI'}:</strong></td>
                            <td style="padding: 4px 0;">${doc.cliente_doc}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Dirección:</strong></td>
                            <td style="padding: 4px 0;">${doc.cliente_direccion || '-'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0;"><strong>Email:</strong></td>
                            <td style="padding: 4px 0;">${doc.cliente_email || '-'}</td>
                        </tr>
                    </table>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                    <thead>
                        <tr style="background: #333; color: white;">
                            <th style="padding: 10px; text-align: left;">Descripción</th>
                            <th style="padding: 10px; text-align: right;">Cant.</th>
                            <th style="padding: 10px; text-align: right;">P. Unit</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="float: right; width: 250px; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Subtotal:</span> <span>S/ ${doc.subtotal}</span></div>
                    <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>IGV (18%):</span> <span>S/ ${doc.igv}</span></div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #333; font-weight: bold; font-size: 16px;">
                        <span>TOTAL:</span> <span>S/ ${doc.total}</span>
                    </div>
                </div>
                <div style="clear: both;"></div>
                <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                    Representación impresa del Comprobante Electrónico.<br>
                    Gracias por su preferencia.
                </div>
            </div>
        `;
    }
};