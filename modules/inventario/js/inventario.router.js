/**
 * js/inventario.router.js
 * Sistema de enrutamiento basado en Hash (#) para el módulo Inventario.
 */
import { UI } from './views/inventario.ui.js';
import { renderSidebar } from './views/inventario.sidebar.js';

// Importa todos los controladores del Inventario
import { DashboardController } from './controllers/dashboard.controller.js';
import { StockController } from './controllers/stock.controller.js';
import { RecepcionController } from './controllers/recepcion.controller.js';
import { ReportesController } from './controllers/reportes.controller.js';

// Mapeo de rutas a archivos HTML y Controladores
const ROUTES = {
    'dashboard': {
        html: 'js/views/dashboard.html',
        controller: DashboardController
    },
    'stock': {
        html: 'js/views/stock.html',
        controller: StockController
    },
    'recepcion': {
        html: 'js/views/recepcion.html',
        controller: RecepcionController
    },
    'reportes': {
        html: 'js/views/reportes.html',
        controller: ReportesController
    },
};

const Router = (function() {

    let lastKnownSidebarState = true; // Asumimos visible al inicio

    async function loadView(viewId) {
        const mainContent = document.getElementById('main-content');
        const sidebarEl = document.getElementById('sidebar-menu');
        
        const route = ROUTES[viewId];
        
        if (!route || !mainContent) {
            mainContent.innerHTML = '<h2 class="text-3xl text-red-500">404 - Vista no encontrada</h2>';
            return;
        }
        
        if (sidebarEl) lastKnownSidebarState = !sidebarEl.classList.contains('-translate-x-full');

        try {
            // Cargar el contenido HTML de la vista
            const response = await fetch(route.html);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const htmlContent = await response.text();
            mainContent.innerHTML = htmlContent;

            // Actualizar la barra lateral (estado 'active')
            renderSidebar(viewId, 'Gestor de Almacén');

            // Reiniciar el Lucide Icons y el toggle button listener
            UI.initGlobalEvents();
            
            // RESTAURAR el estado de la sidebar
            if (lastKnownSidebarState) {
                UI.setSidebarVisible();
            } else {
                UI.setSidebarHidden();
            }
            
            // Ejecutar el controlador específico de la vista
            route.controller.init();
            
        } catch (error) {
            console.error('Error al cargar la vista:', error);
            mainContent.innerHTML = `<h2 class="text-3xl text-red-500">Error al cargar ${viewId}</h2>`;
        }
    }

    function hashChangeHandler() {
        let path = window.location.hash.slice(2); 
        if (!path) {
            path = 'dashboard'; // Ruta predeterminada
        }
        loadView(path);
    }

    function init() {
        window.addEventListener('hashchange', hashChangeHandler);
        hashChangeHandler(); 
    }
    
    return { init };
})();

export { Router };