/**
 * js/controllers/historial.global.controller.js
 * Controlador unificado: Auditoría Global.
 * CORREGIDO: Parser de fechas robusto y depuración de filtros.
 */
import { HistorialGlobalService } from '../services/historial.global.service.js';

export const HistorialGlobalController = {
    // Estado de la vista
    currentPage: 1,
    itemsPerPage: 10,
    allLogs: [],
    filteredLogs: [],
    
    // Estado de filtros
    filters: {
        search: '',
        service: '',
        startDate: null,
        endDate: null
    },

    init: async function() {
        console.log("HistorialGlobalController: Iniciando...");
        this.setupDropdownHelpers();
        this.setupDatepicker();
        await this.loadData();
        this.setupEvents();
    },

    // --- 1. CONFIGURACIÓN DEL DATEPICKER ---
    setupDatepicker() {
        const dateInput = document.getElementById('filter-date-range');
        if (dateInput && window.flatpickr) {
            window.flatpickr(dateInput, {
                mode: "range", 
                dateFormat: "d/m/Y", 
                locale: "es",
                altInput: true, 
                altFormat: "d M Y", 
                maxDate: "today", // No permitir fechas futuras
                
                onChange: (selectedDates) => {
                    if (selectedDates.length === 0) {
                        this.filters.startDate = null;
                        this.filters.endDate = null;
                    } else {
                        // Fecha Inicio: 00:00:00
                        this.filters.startDate = new Date(selectedDates[0]);
                        this.filters.startDate.setHours(0, 0, 0, 0);

                        // Fecha Fin: Si seleccionan 1 día, fin es ese mismo día 23:59:59
                        // Si es rango, fin es la segunda fecha
                        let endRaw = selectedDates.length === 2 ? selectedDates[1] : selectedDates[0];
                        this.filters.endDate = new Date(endRaw);
                        this.filters.endDate.setHours(23, 59, 59, 999);
                    }
                    console.log("📅 Filtro Fechas Actualizado:", this.filters.startDate, "hasta", this.filters.endDate);
                    this.currentPage = 1;
                    this.applyFilters();
                }
            });
        }
    },

    // --- 2. PARSEO DE FECHAS ROBUSTO (EL FIX PRINCIPAL) ---
    parseLogDate(dateString) {
        if (!dateString) return null;
        const str = dateString.toString().trim();

        try {
            // CASO 1: Formato ISO estándar (ej: "2025-11-23T10:00:00")
            // O formatos que JS entiende nativamente
            const nativeDate = new Date(str);
            if (!isNaN(nativeDate.getTime()) && str.includes('-')) {
                return nativeDate;
            }

            // CASO 2: Formato con barras DD/MM/YYYY (ej: "23/11/2025")
            if (str.includes('/')) {
                // Separamos fecha de hora si existe (ej: "23/11/2025 10:30")
                const [datePart, timePart] = str.split(' ');
                const [day, month, year] = datePart.split('/');
                
                // Creamos fecha en formato ISO para que JS no confunda mes/día
                const isoStr = `${year}-${month}-${day}${timePart ? 'T' + timePart : ''}`;
                const slashDate = new Date(isoStr);
                if (!isNaN(slashDate.getTime())) return slashDate;
            }

            // CASO 3: Formato Textual Español (ej: "16 nov 2025, 17:00:05")
            // Limpiamos comas
            const cleanStr = str.toLowerCase().replace(/,/g, ''); 
            const parts = cleanStr.split(' '); // ["16", "nov", "2025", "17:00:05"]

            const months = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };

            // Buscamos partes numéricas y de texto
            let day, year, monthVal;
            
            // Iteramos partes para encontrar mes textual
            parts.forEach(part => {
                if (months[part.substring(0, 3)] !== undefined) {
                    monthVal = months[part.substring(0, 3)];
                } else if (!isNaN(part) && part.length === 4) {
                    year = parseInt(part);
                } else if (!isNaN(part) && part.length <= 2) {
                    // Asumimos que el primer numero corto es el dia si aun no lo tenemos
                    if (!day) day = parseInt(part);
                }
            });

            if (day && year && monthVal !== undefined) {
                const resultDate = new Date(year, monthVal, day);
                // Intentar agregar hora si existe una parte con ":"
                const timePart = parts.find(p => p.includes(':'));
                if (timePart) {
                    const [h, m, s] = timePart.split(':');
                    resultDate.setHours(h || 0, m || 0, s || 0);
                }
                return resultDate;
            }

            console.warn("⚠️ No se pudo parsear fecha:", str);
            return null;
        } catch (e) {
            console.error("Error crítico parseando fecha:", str, e);
            return null;
        }
    },

    // --- 3. CARGA Y FILTRADO ---
    async loadData() {
        const rawLogs = await HistorialGlobalService.getLogs();

        this.allLogs = rawLogs.filter(log => {
            const action = (log.action || '').toUpperCase();
            if (action.includes('ORDEN_COMPRA')) return true; 
            if (action.includes('COTIZACION') || action.includes('OT_') || action.includes('DISENO') || (action.includes('ORDEN') && !action.includes('COMPRA'))) {
                return false;
            }
            return true;
        });

        this.applyFilters();
    },

    applyFilters() {
        const searchTerm = this.filters.search.toLowerCase();
        const serviceFilter = this.filters.service;

        this.filteredLogs = this.allLogs.filter(log => {
            // A. Filtro Texto
            const textMatch = 
                (log.user && log.user.toLowerCase().includes(searchTerm)) ||
                (log.action && log.action.toLowerCase().includes(searchTerm)) ||
                (log.details && log.details.toLowerCase().includes(searchTerm));

            // B. Filtro Servicio
            let serviceCategory = 'Sistema'; 
            const action = (log.action || '').toUpperCase();
            
            if (action.includes('USUARIO') || action.includes('LOGIN') || action.includes('PROVEEDOR')) {
                serviceCategory = 'Admin';
            } else if (action.includes('PRODUCTO') || action.includes('STOCK') || action.includes('COMPRA') || action.includes('RECEPCION')) {
                serviceCategory = 'Inventario';
            }
            const serviceMatch = serviceFilter ? serviceCategory === serviceFilter : true;

            // C. Filtro Fechas
            let dateMatch = true;
            if (this.filters.startDate && this.filters.endDate) {
                const logDateObj = this.parseLogDate(log.timestamp);
                
                if (logDateObj) {
                    const t = logDateObj.getTime();
                    const start = this.filters.startDate.getTime();
                    const end = this.filters.endDate.getTime();
                    
                    dateMatch = t >= start && t <= end;
                    
                    // DEBUG: Descomenta esto si sigue fallando para ver por qué
                    // if (!dateMatch) console.log(`Fechas fuera de rango: Log(${logDateObj.toLocaleString()}) vs Filtro(${this.filters.startDate.toLocaleDateString()} - ${this.filters.endDate.toLocaleDateString()})`);
                } else {
                    // Si la fecha es inválida, no la mostramos si hay filtro de fecha activo
                    console.log("Fecha inválida en log:", log);
                    dateMatch = false; 
                }
            }

            return textMatch && serviceMatch && dateMatch;
        });

        const totalPages = Math.ceil(this.filteredLogs.length / this.itemsPerPage);
        if (this.currentPage > totalPages) this.currentPage = 1;
        if (this.currentPage < 1) this.currentPage = 1;

        this.renderView();
    },

    // --- 4. RENDERIZADO (Sin cambios lógicos, solo visual) ---
    renderView() {
        const totalItems = this.filteredLogs.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredLogs.slice(startIndex, endIndex);

        this.renderTable(pageItems);
        this.renderPagination(totalItems, startIndex + 1, Math.min(endIndex, totalItems), totalPages);
    },

    renderTable(logs) {
        const tbody = document.getElementById('log-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-500 italic bg-gray-50">No se encontraron registros.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const action = log.action.toUpperCase();
            let label = 'Sistema';
            let badgeClass = 'bg-gray-100 text-gray-600 border-gray-200';
            
           if (action.includes('USUARIO') || action.includes('LOGIN') || action.includes('PROVEEDOR')) {
                label = 'Admin';
                badgeClass = 'bg-purple-100 text-purple-700 border-purple-200';
            } else if (action.includes('PRODUCTO') || action.includes('STOCK') || action.includes('COMPRA')) {
                label = 'Inventario';
                badgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
            } else if (action.includes('CLIENTE') || action.includes('COTIZACION') || action.includes('PEDIDO')) {
                // Esta es la condición para el CRM (Clientes y también Cotizaciones si deseas)
                label = 'CRM';
                badgeClass = 'bg-blue-100 text-blue-800 border-blue-200'; 
            }

            const row = `
                <tr class="hover:bg-gray-50 group transition-colors duration-150">
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 mr-3">
                                <i data-lucide="user" class="w-4 h-4"></i>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-900">${log.user || 'Sistema'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">
                        ${log.timestamp}
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}">
                            ${label}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">
                        <span class="font-bold text-gray-800 block mb-0.5">${log.action}</span>
                        <span class="text-gray-500 text-xs">${log.details || ''}</span>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
        if(window.lucide) window.lucide.createIcons();
    },

    renderPagination(totalItems, startItem, endItem, totalPages) {
        const container = document.getElementById('pagination-controls');
        if (!container) return;
        if (totalItems === 0) { container.innerHTML = ''; return; }

        container.innerHTML = `
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-bold text-gray-900">${startItem}</span> a <span class="font-bold text-gray-900">${endItem}</span> de <span class="font-bold text-gray-900">${totalItems}</span> registros
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
            if (this.currentPage > 1) { this.currentPage--; this.renderView(); }
        });
        document.getElementById('btn-next-page')?.addEventListener('click', () => {
            if (this.currentPage < totalPages) { this.currentPage++; this.renderView(); }
        });
        if(window.lucide) window.lucide.createIcons();
    },

    setupDropdownHelpers: function() {
        window.toggleDropdown = (menuId, chevronId) => {
            const menu = document.getElementById(menuId);
            const chevron = document.getElementById(chevronId);
            if (!menu) return;
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

        window.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.flatpickr-calendar')) {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('[id$="-chevron"]').forEach(el => el.style.transform = 'rotate(0deg)');
            }
        });
    },

    setupEvents() {
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
        });
        document.getElementById('filter-service')?.addEventListener('change', (e) => {
            this.filters.service = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
        });
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            this.filters.search = '';
            this.filters.service = '';
            this.filters.startDate = null;
            this.filters.endDate = null;
            document.getElementById('search-input').value = '';
            document.getElementById('selected-service-text').innerText = 'Todos los Servicios';
            document.getElementById('filter-service').value = '';
            const fp = document.getElementById('filter-date-range')._flatpickr;
            if(fp) fp.clear();
            this.currentPage = 1;
            this.applyFilters();
        });
    }
};