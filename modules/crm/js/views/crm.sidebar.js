/* js/views/crm.sidebar.js */

const NAV_LINKS = [
    { id: 'dashboard', name: 'Dashboard / Pipeline', icon: 'layout-dashboard', href: 'dashboard' },
    { id: 'clientes', name: 'Clientes', icon: 'users', href: 'clientes' },
    { id: 'ordenes', name: 'Órdenes de Trabajo', icon: 'clipboard-check', href: 'ordenes' },
    { id: 'facturacion', name: 'Documentos Fiscales', icon: 'file-text', href: 'facturacion' },
];

export function renderSidebar(currentPageId, userName = 'Usuario') {
    const menuContainer = document.getElementById('sidebar-menu');
    if (!menuContainer) return;

    let linksHtml = '';
    NAV_LINKS.forEach(link => {
        const isActive = currentPageId === link.id;
        linksHtml += `
            <a href="#/${link.href}" class="nav-link flex items-center px-4 py-3 rounded-lg text-sm font-medium ${isActive ? 'active' : 'text-gray-200'}">
                <i data-lucide="${link.icon}" class="w-5 h-5 mr-3"></i>
                ${link.name}
            </a>
        `;
    });

    menuContainer.innerHTML = `
        <div class="flex flex-col h-full w-64">
            <div class="py-6 px-4 flex items-center justify-center nav-sidebar-bg/90 shadow-lg">
                <img src="../../../../shared/images/logosf.png" alt="Logo Impresos S.R.L." class="h-20 w-auto scale-150">
            </div>
            <div class="px-4 py-6 text-center text-gray-200 border-b border-t border-gray-700/50">
                <h2 class="font-semibold text-lg text-white">Bienvenido,</h2>
                <p class="text-sm text-yellow-400 truncate" id="user-display-name">${userName}</p>
            </div>
            <nav class="mt-4 px-4 space-y-2 flex-grow">
                ${linksHtml}
            </nav>
            <div class="mt-auto p-4 border-t border-gray-700">
                <button id="logout-button" class="nav-link flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-200 hover:bg-red-800 hover:text-white cursor-pointer">
                    <i data-lucide="log-out" class="w-5 h-5 mr-3"></i>
                    Cerrar Sesión
                </button>
            </div>
        </div>
    `;
    
    // --- NUEVO: Lógica de Cerrar Sesión ---
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('erp_session');
            window.location.href = '../../index.html';
        });
    }

    if (window.lucide) window.lucide.createIcons();
}