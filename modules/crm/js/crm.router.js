/**
 * js/crm.router.js
 * Sistema de enrutamiento basado en Hash (#) para el módulo CRM.
 */
import { UI } from './views/crm.ui.js';
import { renderSidebar } from './views/crm.sidebar.js';

// Importa todos los controladores del CRM
import { DashboardController } from './controllers/dashboard.controller.js';
import { ClientesController } from './controllers/clientes.controller.js';
import { ClienteDetalleController } from './controllers/cliente.detalle.controller.js';
import { OrdenesController } from './controllers/ordenes.controller.js';
import { OrdenDetalleController } from './controllers/orden.detalle.controller.js';
import { FacturacionController } from './controllers/facturacion.controller.js';

// Mapeo de rutas a archivos HTML y Controladores
const ROUTES = {
    'dashboard': {
        html: 'js/views/dashboard.html',
        controller: DashboardController
    },
    'clientes': {
        html: 'js/views/clientes.html',
        controller: ClientesController
    },
    'cliente-detalle': { // Para crear nuevo
        html: 'js/views/cliente-detalle.html',
        controller: ClienteDetalleController
    },
    'cliente-detalle/:id': { // Para editar existente (simulado)
        html: 'js/views/cliente-detalle.html',
        controller: ClienteDetalleController
    },
    'ordenes': {
        html: 'js/views/ordenes.html',
        controller: OrdenesController
    },
    'orden-detalle': { // Para crear nueva cotización
        html: 'js/views/orden-detalle.html',
        controller: OrdenDetalleController
    },
    'orden-detalle/:id': { // Para ver/editar cotización existente
        html: 'js/views/orden-detalle.html',
        controller: OrdenDetalleController
    },
    'facturacion': {
        html: 'js/views/facturacion.html',
        controller: FacturacionController
    },
};

const Router = (function() {

    let lastKnownSidebarState = true; // Asumimos visible al inicio

    async function loadView(viewId, params) {
        const mainContent = document.getElementById('main-content');
        const sidebarEl = document.getElementById('sidebar-menu');
        
        // Buscar la ruta, incluyendo manejo de parámetros (ej. cliente-detalle/:id)
        let routeKey = ROUTES[viewId] ? viewId : null;
        if (!routeKey) {
             // Manejar rutas con parámetros
            if (viewId.startsWith('cliente-detalle/')) routeKey = 'cliente-detalle/:id';
            if (viewId.startsWith('orden-detalle/')) routeKey = 'orden-detalle/:id';
        }

        const route = ROUTES[routeKey];
        
        if (!route || !mainContent) {
            mainContent.innerHTML = '<h2 class="text-3xl text-red-500">404 - Vista no encontrada</h2>';
            return;
        }
        
        // Guardar estado de la sidebar
        if (sidebarEl) lastKnownSidebarState = !sidebarEl.classList.contains('-translate-x-full');

        try {
            // Cargar el contenido HTML de la vista
            const response = await fetch(route.html);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const htmlContent = await response.text();
            mainContent.innerHTML = htmlContent;

            // Actualizar la barra lateral (estado 'active')
            // Determina la vista activa (ej. 'cliente-detalle/123' debe activar 'clientes')
            let activePageId = viewId.split('/')[0]; // 'cliente-detalle'
            if(activePageId === 'cliente-detalle') activePageId = 'clientes';
            if(activePageId === 'orden-detalle') activePageId = 'ordenes';
            
            renderSidebar(activePageId, 'Vendedor');

            // Reiniciar el Lucide Icons y el toggle button listener
            UI.initGlobalEvents();
            
            // RESTAURAR el estado de la sidebar
            if (lastKnownSidebarState) {
                UI.setSidebarVisible();
            } else {
                UI.setSidebarHidden();
            }
            
            // Ejecutar el controlador específico de la vista
            route.controller.init(params); // Pasar parámetros al controlador
            
        } catch (error) {
            console.error('Error al cargar la vista:', error);
            mainContent.innerHTML = `<h2 class="text-3xl text-red-500">Error al cargar ${viewId}</h2>`;
        }
    }

    function hashChangeHandler() {
        // Obtener la ruta del hash (ej. #/cliente-detalle/123)
        let path = window.location.hash.slice(2); 
        if (!path) {
            path = 'dashboard'; // Ruta predeterminada
        }

        const parts = path.split('/');
        const viewId = parts[0];
        const params = parts.slice(1); // Parámetros como ['123']

        // Reconstruir viewId para manejo de parámetros
        const dynamicViewId = parts.length > 1 ? `${viewId}/${params.join('/')}` : viewId;

        loadView(dynamicViewId, params);
    }

    function init() {
        // Escuchar cambios en el hash
        window.addEventListener('hashchange', hashChangeHandler);
        
        // Cargar la vista inicial
        hashChangeHandler(); 
    }
    
    return { init };
})();

export { Router };