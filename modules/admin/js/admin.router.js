/**
 * js/admin.router.js
 * Sistema de enrutamiento basado en Hash (#). Carga dinámicamente vistas y controladores.
 */
// Rutas de importación corregidas
import { UI } from './views/admin.ui.js';
import { renderSidebar } from './views/admin.sidebar.js';
// Importa todos los controladores para garantizar su disponibilidad
import { DashboardController } from './controllers/dashboard.controller.js';
import { ProductionController } from './controllers/produccion.controller.js';
import { HistorialGlobalController } from './controllers/historial.global.controller.js';

// ¡CORRECCIÓN! La ruta era '../controllers/' pero debe ser './controllers/'
// ya que 'controllers' está en el mismo nivel que 'admin.router.js' (ambos dentro de 'js').
import { HistorialOrdenController } from './controllers/historial.orden.controller.js';

import { UsuariosController } from './controllers/usuarios.controller.js';
import { ProveedoresController } from './controllers/proveedores.controller.js';

// Mapeo de rutas a archivos HTML y Controladores
const ROUTES = {
    'dashboard': {
        html: 'js/views/dashboard.html', // Ruta corregida
        controller: DashboardController
    },
    'produccion': {
        html: 'js/views/produccion.html', // Ruta corregida
        controller: ProductionController
    },
    'historial-global': {
        html: 'js/views/historial-global.html', // Ruta corregida
        controller: HistorialGlobalController
    },
    'historial-orden': {
        html: 'js/views/historial-orden.html', // Ruta corregida
        controller: HistorialOrdenController
    },
    'usuarios': {
        html: 'js/views/usuarios.html', // Ruta corregida
        controller: UsuariosController
    },
    'proveedores': {
        html: 'js/views/proveedores.html', // Ruta corregida
        controller: ProveedoresController
    },
};

const Router = (function() {

    // Variable para almacenar la última ruta cargada y evitar recargas innecesarias (Optimización)
    let currentPath = null;
    let lastKnownSidebarState = true; // Asumimos visible al inicio

    async function loadView(viewId) {
        const mainContent = document.getElementById('main-content');
        const sidebarEl = document.getElementById('sidebar-menu');
        const route = ROUTES[viewId];
        
        if (!route || !mainContent) {
            mainContent.innerHTML = '<h2 class="text-3xl text-red-500">404 - Vista no encontrada</h2>';
            return;
        }
        
        // 1. **Optimización**: Si es la misma vista, no recargar el HTML.
        // PERO: Si la vista se recarga (ej. por hashchange), la ejecución del controlador es necesaria
        // para reajustar los listeners, lo cual ahora maneja el controlador mismo.

        // 2. Guardar el estado actual de la sidebar antes de que se limpie la vista
        const wasSidebarVisible = !sidebarEl?.classList.contains('-translate-x-full');
        
        // Almacenar el estado para la próxima carga
        if (sidebarEl) lastKnownSidebarState = wasSidebarVisible;


        try {
            // 3. Cargar el contenido HTML de la vista
            const response = await fetch(route.html);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const htmlContent = await response.text();
            mainContent.innerHTML = htmlContent;

            // 4. Actualizar la barra lateral (estado 'active')
            renderSidebar(viewId, 'Gerente General');

            // 5. Reiniciar el Lucide Icons y el toggle button listener
            // Esto es crucial porque el HTML de la cabecera acaba de ser inyectado.
            UI.initGlobalEvents();
            
            // 6. RESTAURAR el estado de la sidebar
            if (lastKnownSidebarState) {
                UI.setSidebarVisible();
            } else {
                UI.setSidebarHidden();
            }
            
            // 7. Ejecutar el controlador específico de la vista
            // El controlador es responsable de limpiar sus propios listeners antes de adjuntar nuevos.
            route.controller.init();
            
            currentPath = viewId;

        } catch (error) {
            console.error('Error al cargar la vista:', error);
            mainContent.innerHTML = `<h2 class="text-3xl text-red-500">Error al cargar ${viewId}</h2>`;
        }
    }

    function hashChangeHandler() {
        // Obtener la ruta del hash (ej. #/dashboard -> dashboard)
        let path = window.location.hash.slice(2); 
        if (!path) {
            path = 'dashboard'; // Ruta predeterminada
        }
        loadView(path);
    }

    function init() {
        // Escuchar cambios en el hash
        window.addEventListener('hashchange', hashChangeHandler);
        
        // Cargar la vista inicial (por defecto o la especificada en el hash)
        hashChangeHandler(); 
    }
    
    return { init };
})();

export { Router };