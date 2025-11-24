import { UI } from './views/crm.ui.js';
import { Router } from './crm.router.js';
import { renderSidebar } from './views/crm.sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("CRM Application initializing...");
    
    UI.initGlobalEvents();

    UI.setSidebarVisible();

    // --- CAMBIO: Obtener usuario de la sesión ---
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    const userName = user ? user.name : 'Vendedor (Sin Sesión)';
    // --------------------------------------------

    // 2. Renderizar sidebar con el nombre
    renderSidebar('dashboard', userName);

    Router.init();
});