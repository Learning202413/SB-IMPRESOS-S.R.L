import { UI } from './views/preprensa.ui.js';
import { Router } from './preprensa.router.js';
import { renderSidebar } from './views/preprensa.sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Pre-Prensa Application initializing...");
    
    UI.initGlobalEvents();

    UI.setSidebarVisible();

    // --- CAMBIO: Obtener usuario de la sesión ---
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    const userName = user ? user.name : 'Diseñador (Sin Sesión)';
    // --------------------------------------------

    // 3. Renderizar sidebar con el nombre
    renderSidebar('cola', userName);

    Router.init();
});