/**
 * js/controllers/cliente.detalle.controller.js
 * Controlador con Búsqueda DNI/RUC Integrada y Autocompletado Inteligente.
 * ESTILO VISUAL: Adaptado a 'Usuarios'.
 * DEFAULT: Inicia en Persona Natural (NATURAL).
 */
import { ClienteDetalleService } from '../services/cliente.detalle.service.js';

export const ClienteDetalleController = {
    // Almacén temporal para datos fiscales adicionales (Dirección, Ubigeo, etc.)
    fiscalData: {}, 

    init: async function(params) {
        const clientId = params[0];
        const isEditMode = !!clientId;
        
        this.fiscalData = {}; // Resetear datos temporales

        console.log(`ClienteDetalleController inicializado.`);
        this.setupTabs();
        
        const headerEl = document.getElementById('client-header');
        const form = document.getElementById('client-form');
        let currentForm = form;

        if (form) {
            const newForm = form.cloneNode(true); 
            form.parentNode.replaceChild(newForm, form);
            currentForm = newForm;

            // 1. Lógica de UI (Natural vs Jurídica)
            this.setupClientTypeLogic(currentForm);

            // 2. NUEVO: Evento de Búsqueda (Lupa)
            const searchBtn = currentForm.querySelector('#btn-search-doc');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.handleSearch());
            }

            // 3. Listener Submit
            currentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveAndRedirect(currentForm, clientId, false);
            });
        }

        // Configuración Botón "Crear Cotización Directa"
        const linkBtn = document.getElementById('btn-create-quote');
        if (linkBtn) {
            if (isEditMode) {
                linkBtn.href = `#/orden-detalle/new/${clientId}`;
            } else {
                linkBtn.removeAttribute('href'); 
                linkBtn.style.cursor = 'pointer'; 
                linkBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    await this.saveAndRedirect(currentForm, null, true);
                });
            }
        }

        // Carga de Datos (Edición)
        if (isEditMode) {
            headerEl.textContent = 'Cargando datos...';
            const client = await ClienteDetalleService.getClientById(clientId);
            
            if (client) {
                headerEl.textContent = `Editando: ${client.razon_social}`;
                // Guardamos los datos existentes en fiscalData por si no se busca de nuevo
                this.fiscalData = {
                    direccion: client.direccion || '',
                    departamento: client.departamento || '',
                    provincia: client.provincia || '',
                    distrito: client.distrito || '',
                    ubigeo: client.ubigeo || '',
                    condicion: client.condicion || '',
                    estado_sunat: client.estado_sunat || ''
                };
                this.populateForm(client, currentForm);
            } else {
                window.UI.showNotification('Error', 'Cliente no encontrado.');
                setTimeout(() => window.location.hash = '#/clientes', 1500);
            }
        } else {
            // MODO CREACIÓN
            headerEl.textContent = 'Crear Nuevo Cliente';
            currentForm?.reset();
            // CAMBIO: Inicializar UI como NATURAL por defecto
            this.updateFormUI('NATURAL');
        }
        
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Lógica principal de Búsqueda y Autocompletado
     */
    async handleSearch() {
        const inputRuc = document.getElementById('ruc');
        const inputName = document.getElementById('razon_social');
        const iconSearch = document.querySelector('#btn-search-doc i');
        const btnSearch = document.getElementById('btn-search-doc');

        const docNum = inputRuc.value.trim();

        if (!docNum) {
            window.UI.showNotification('Atención', 'Ingrese un número para buscar.');
            return;
        }

        // UI Loading
        const originalIcon = iconSearch ? iconSearch.getAttribute('data-lucide') : 'search';
        if(iconSearch) {
            iconSearch.setAttribute('data-lucide', 'loader-2');
            iconSearch.classList.add('animate-spin');
            if(window.lucide) window.lucide.createIcons();
        }
        btnSearch.disabled = true;

        // Llamada al Servicio
        const result = await ClienteDetalleService.consultarDocumento(docNum);

        // Restaurar UI
        btnSearch.disabled = false;
        if(iconSearch) {
            iconSearch.classList.remove('animate-spin');
            iconSearch.setAttribute('data-lucide', originalIcon); // Restaurar icono original ('search')
            if(window.lucide) window.lucide.createIcons();
        }

        if (result.success) {
            const data = result.data;
            window.UI.showNotification('Éxito', 'Datos encontrados y autocompletados.');

            // Lógica de Mapeo según DNI o RUC
            if (result.tipo === 'dni') {
                // API DNI devuelve: nombres, apellidoPaterno, apellidoMaterno
                const fullName = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.trim();
                inputName.value = fullName;
                
                // DNI usualmente no trae dirección fiscal pública en esta API, limpiamos o mantenemos
                this.fiscalData = { tipo_doc: 'DNI' }; 

            } else {
                // API RUC devuelve: razonSocial, direccion, departamento, provincia, distrito, etc.
                inputName.value = data.razonSocial;
                
                // GUARDAMOS TODOS LOS DATOS EXTRA EN MEMORIA
                this.fiscalData = {
                    tipo_doc: 'RUC',
                    direccion: data.direccion || '',
                    departamento: data.departamento || '',
                    provincia: data.provincia || '',
                    distrito: data.distrito || '',
                    ubigeo: data.ubigeo || '',
                    estado_sunat: data.estado || '',     // Ej: ACTIVO
                    condicion: data.condicion || ''      // Ej: HABIDO
                };

                // Opcional: Si tuviéramos un campo de dirección visible, lo llenaríamos así:
                // const addressInput = document.getElementById('direccion');
                // if(addressInput) addressInput.value = data.direccion;
            }

        } else {
            window.UI.showNotification('Error', result.message);
        }
    },

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Resetear estilos de todos los tabs
                tabButtons.forEach(btn => {
                    btn.classList.remove('tab-active', 'border-red-600', 'text-red-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                tabContents.forEach(content => content.classList.add('hidden'));

                // Activar el tab clickeado
                const tabId = e.currentTarget.dataset.tab;
                e.currentTarget.classList.remove('border-transparent', 'text-gray-500'); 
                e.currentTarget.classList.add('tab-active', 'border-red-600', 'text-red-600'); 
                
                document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
            });
        });
        document.querySelector('[data-tab="details"]')?.click();
    },

    setupClientTypeLogic(form) {
        const radios = form.querySelectorAll('input[name="tipo_persona"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateFormUI(e.target.value);
            });
        });
    },

    updateFormUI(type) {
        const lblDoc = document.getElementById('lbl-doc');
        const inputRuc = document.getElementById('ruc');
        const hintDoc = document.getElementById('hint-doc');
        const lblName = document.getElementById('lbl-name');
        const inputName = document.getElementById('razon_social');
        const lblContact = document.getElementById('lbl-contact');
        const inputContact = document.getElementById('nombre_contacto');
        const hintContact = document.getElementById('hint-contact');
        const inputEmail = document.getElementById('email');
        const inputPhone = document.getElementById('telefono');
        const lblPhone = document.getElementById('lbl-phone');

        if (type === 'NATURAL') {
            lblDoc.innerHTML = 'DNI / Identificación Personal <span class="text-red-500">*</span>';
            inputRuc.placeholder = 'Ej: 12345678';
            inputRuc.setAttribute('maxlength', '8');
            hintDoc.textContent = 'Debe tener 8 dígitos.';
            lblName.innerHTML = 'Nombre Completo <span class="text-red-500">*</span>';
            inputName.placeholder = 'Ej: Juan Pérez Gómez';
            lblContact.innerHTML = 'Contacto Referencia (Opcional)';
            inputContact.placeholder = 'Ej: María López';
            inputContact.required = false;
            if(hintContact) {
                hintContact.textContent = '(Solo si quieres agregar un contacto alterno)';
                hintContact.classList.remove('hidden');
            }
            inputEmail.placeholder = 'Ej: juanperez@gmail.com';
            inputPhone.placeholder = 'Ej: 987654321';
            lblPhone.innerHTML = 'Teléfono <span class="text-red-500">*</span>';
        } else {
            lblDoc.innerHTML = 'RUC / Identificación Fiscal <span class="text-red-500">*</span>';
            inputRuc.placeholder = 'Ej: 20123456789';
            inputRuc.setAttribute('maxlength', '11');
            hintDoc.textContent = 'Debe tener 11 dígitos.';
            lblName.innerHTML = 'Razón Social / Empresa <span class="text-red-500">*</span>';
            inputName.placeholder = 'Ej: Industrias S.A.C.';
            lblContact.innerHTML = 'Contacto Referencia <span class="text-red-500">*</span>';
            inputContact.placeholder = 'Ej: Juan Pérez';
            inputContact.required = true;
            if(hintContact) hintContact.classList.add('hidden');
            inputEmail.placeholder = 'contacto@empresa.com';
            inputPhone.placeholder = '+51 999 999 999';
        }
    },

    populateForm(client, form) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        let tipo = client.tipo_persona;
        if (!tipo) tipo = (client.ruc && client.ruc.length === 8) ? 'NATURAL' : 'JURIDICA';

        const radio = form.querySelector(`input[name="tipo_persona"][value="${tipo}"]`);
        if (radio) {
            radio.checked = true;
            this.updateFormUI(tipo); 
        }

        setVal('ruc', client.ruc);
        setVal('razon_social', client.razon_social);
        setVal('nombre_contacto', client.nombre_contacto);
        setVal('email', client.email);
        setVal('telefono', client.telefono);
    },

    async saveAndRedirect(form, id, goToQuote) {
        const selectedType = form.querySelector('input[name="tipo_persona"]:checked')?.value || 'JURIDICA';
        const rucVal = form.querySelector('#ruc').value;
        const razonVal = form.querySelector('#razon_social').value;
        const contactoVal = form.querySelector('#nombre_contacto').value;
        const emailVal = form.querySelector('#email').value;
        const telVal = form.querySelector('#telefono').value;

        // Validaciones básicas
        if (!rucVal || !razonVal || !emailVal) {
            window.UI.showNotification('Error', 'Complete los campos obligatorios (*).');
            return;
        }
        if (selectedType === 'NATURAL' && rucVal.length !== 8) {
            window.UI.showNotification('Error', 'El DNI debe tener 8 dígitos.');
            return;
        } 
        if (selectedType === 'JURIDICA') {
            if (rucVal.length !== 11) {
                window.UI.showNotification('Error', 'El RUC debe tener 11 dígitos.');
                return;
            }
            if (!contactoVal) {
                window.UI.showNotification('Error', 'Contacto es obligatorio para empresas.');
                return;
            }
        }

        // Construcción del objeto final
        // FUSIONAMOS: Datos del formulario + Datos Fiscales de la API (this.fiscalData)
        const formData = {
            tipo_persona: selectedType,
            ruc: rucVal,
            razon_social: razonVal,
            nombre_contacto: contactoVal,
            email: emailVal,
            telefono: telVal,
            // Aquí se inyectan dirección, ubigeo, condición, etc.
            ...this.fiscalData 
        };

        try {
            let finalId = id;
            if (id) {
                await ClienteDetalleService.updateClient(id, formData);
                window.UI.showNotification('Éxito', 'Cliente actualizado con datos fiscales.');
            } else {
                const res = await ClienteDetalleService.createClient(formData);
                finalId = res.id;
                window.UI.showNotification('Éxito', 'Cliente registrado correctamente.');
            }
            
            if (goToQuote && finalId) {
                setTimeout(() => window.location.hash = `#/orden-detalle/new/${finalId}`, 500);
            } else {
                setTimeout(() => window.location.hash = '#/clientes', 1000);
            }

        } catch (error) {
            console.error(error);
            window.UI.showNotification('Error', 'Ocurrió un error al guardar.');
        }
    }
};