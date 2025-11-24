import { UI } from './views/prensa.ui.js';
import { Router } from './prensa.router.js';
import { renderSidebar } from './views/prensa.sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Prensa Application initializing...");
    
    UI.initGlobalEvents();

    UI.setSidebarVisible();

    // --- CAMBIO: Obtener usuario de la sesión ---
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    const userName = user ? user.name : 'Operador (Sin Sesión)';
    // --------------------------------------------

    // 3. Renderizar sidebar con el nombre
    renderSidebar('cola', userName);

    Router.init();
});