/**
 * js/views/preprensa.ui.js
 * Lógica global de la interfaz de usuario (modales, sidebar toggle, etc.) para Pre-Prensa.
 */

const UI = (function() {
    
    function setSidebarState(isVisible) {
        const sidebarEl = document.getElementById('sidebar-menu');
        const mainContentEl = document.getElementById('main-content');
        const toggleIconEl = document.querySelector('#sidebar-toggle i');
        if (!mainContentEl || !sidebarEl) return;

        if (isVisible) {
            sidebarEl.classList.remove('-translate-x-full');
        } else {
            sidebarEl.classList.add('-translate-x-full');
        }
        
        if (isVisible) {
            mainContentEl.classList.add('ml-64');
            mainContentEl.classList.remove('ml-0');
        } else {
            mainContentEl.classList.remove('ml-64');
            mainContentEl.classList.add('ml-0');
        }
        
        if (toggleIconEl) {
            toggleIconEl.setAttribute('data-lucide', isVisible ? 'menu' : 'chevrons-right'); 
            if (window.lucide) window.lucide.createIcons(); 
        }
    }

    function toggleSidebar() {
        const sidebarEl = document.getElementById('sidebar-menu');
        if (!sidebarEl) return;
        const isCurrentlyVisible = !sidebarEl.classList.contains('-translate-x-full');
        setSidebarState(!isCurrentlyVisible);
    }

    // Modal de notificación simple (copiado de la lógica del HTML original)
    function showModal(title, body) {
         const container = document.getElementById('modal-container');
         if (!container) return;
         
         container.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-xl bg-white">
                <h3 id="modal-title" class="text-xl font-bold mb-4 text-gray-800">${title}</h3>
                <p id="modal-body" class="text-gray-600 mb-6">${body}</p>
                <div class="flex justify-end">
                    <button onclick="window.UI.hideModal('modal-container')" class="px-4 py-2 color-primary-red text-white text-base font-medium rounded-lg shadow-sm hover:bg-red-700">Cerrar</button>
                </div>
            </div>
         `;
         if (window.lucide) window.lucide.createIcons();
         container.classList.remove('hidden');
    }

    // Oculta un modal
    function hideModal(modalId) {
        const container = document.getElementById(modalId);
        if (container) {
            container.classList.add('hidden');
             // Limpiar contenido para que no persista
             container.innerHTML = '';
        }
    }
    
    function setSidebarVisible() {
        setSidebarState(true);
    }
    
    function setSidebarHidden() {
        setSidebarState(false);
    }


    function initGlobalEvents() {
        if (window.lucide) {
             window.lucide.createIcons();
        }
       
        const toggleButton = document.getElementById('sidebar-toggle');
        
        toggleButton?.removeEventListener('click', toggleSidebar); 

        if (toggleButton) {
            // Exponer UI al scope global
            window.UI = UI; 
            
            // Exponer funciones de modal para los 'onclick'
            window.showModal = showModal;
            window.hideModal = () => hideModal('modal-container'); // Función específica para el botón 'Cerrar'

            toggleButton.addEventListener('click', toggleSidebar);
        }
    }

    return {
        toggleSidebar,
        showModal,
        hideModal,
        initGlobalEvents,
        setSidebarVisible,
        setSidebarHidden,
    };
})();

export { UI };