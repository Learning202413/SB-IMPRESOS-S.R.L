/**
 * js/postprensa.router.js
 * Sistema de enrutamiento basado en Hash (#) para el módulo Post-Prensa.
 */
import { UI } from './views/postprensa.ui.js';
import { renderSidebar } from './views/postprensa.sidebar.js';

// Importa todos los controladores de Post-Prensa
import { ColaController } from './controllers/cola.controller.js';
import { CalidadController } from './controllers/calidad.controller.js';
import { ColaGeneralController } from './controllers/cola-general.controller.js'; // NUEVO

// Mapeo de rutas a archivos HTML y Controladores
const ROUTES = {
    'cola': {
        html: 'js/views/cola.html',
        controller: ColaController
    },
    'cola-general': { // NUEVA RUTA
        html: 'js/views/cola-general.html',
        controller: ColaGeneralController
    },
    'calidad/:id': { // Ruta parametrizada para el detalle de OT
        html: 'js/views/calidad.html',
        controller: CalidadController
    },
};

const Router = (function() {

    let lastKnownSidebarState = true; // Asumimos visible al inicio

    async function loadView(viewId, params) {
        const mainContent = document.getElementById('main-content');
        const sidebarEl = document.getElementById('sidebar-menu');
        
        // Buscar la ruta, incluyendo manejo de parámetros (ej. calidad/:id)
        let routeKey = ROUTES[viewId] ? viewId : null;
        if (!routeKey) {
             if (viewId.startsWith('calidad/')) routeKey = 'calidad/:id';
        }

        const route = ROUTES[routeKey];
        
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

            // Determina la vista activa (ej. 'calidad/123' debe activar 'cola')
            let activePageId = viewId.split('/')[0];
            if(activePageId === 'calidad') activePageId = 'cola';
            
            renderSidebar(activePageId, 'Op. Acabados');

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
        let path = window.location.hash.slice(2); 
        if (!path) {
            path = 'cola'; // Ruta predeterminada
        }

        const parts = path.split('/');
        const viewId = parts[0];
        const params = parts.slice(1); // Parámetros como ['123']

        const dynamicViewId = parts.length > 1 ? `${viewId}/${params.join('/')}` : viewId;

        loadView(dynamicViewId, params);
    }

    function init() {
        window.addEventListener('hashchange', hashChangeHandler);
        hashChangeHandler(); 
    }
    
    return { init };
})();

export { Router };