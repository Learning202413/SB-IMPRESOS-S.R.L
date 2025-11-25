import { UI } from './views/inventario.ui.js';
import { Router } from './inventario.router.js';
import { renderSidebar } from './views/inventario.sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Inventario Application initializing...");
    
    UI.initGlobalEvents();

    UI.setSidebarVisible();

    // --- CAMBIO: Obtener usuario de la sesión ---
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    const userName = user ? user.name : 'Almacenero (Sin Sesión)';
    // --------------------------------------------

    // 2. Renderizar sidebar con el nombre
    renderSidebar('dashboard', userName);

    Router.init();
});