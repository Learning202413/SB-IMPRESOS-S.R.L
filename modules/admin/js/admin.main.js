import { UI } from './views/admin.ui.js';
import { Router } from './admin.router.js';
import { renderSidebar } from './views/admin.sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Application initializing...");
    
    UI.initGlobalEvents();
    UI.setSidebarVisible();

    // --- Obtener usuario de la sesión ---
    const session = localStorage.getItem('erp_session');
    const user = session ? JSON.parse(session) : null;
    // Si hay usuario, usamos su nombre. Si no, un fallback simple.
    const userName = user ? user.name : 'Usuario';
    // ------------------------------------

    // Renderizar sidebar pasando SOLO el nombre
    renderSidebar('dashboard', userName);

    Router.init();
});