/**
 * js/views/admin.ui.js
 * Lógica global de la interfaz de usuario (modales, sidebar toggle, notificaciones).
 */

const UI = (function() {
    
    // Función que establece el estado de la sidebar de forma determinística
    function setSidebarState(isVisible) {
        const sidebarEl = document.getElementById('sidebar-menu');
        const mainContentEl = document.getElementById('main-content');
        const toggleIconEl = document.querySelector('#sidebar-toggle i');
        if (!mainContentEl || !sidebarEl) return;

        // 1. Sidebar (Visibilidad y animación)
        if (isVisible) {
            sidebarEl.classList.remove('-translate-x-full'); // Mostrar
        } else {
            sidebarEl.classList.add('-translate-x-full'); // Ocultar
        }
        
        // 2. Contenido principal (Margen para hacer espacio)
        if (isVisible) {
            mainContentEl.classList.add('ml-64');
            mainContentEl.classList.remove('ml-0');
        } else {
            mainContentEl.classList.remove('ml-64');
            mainContentEl.classList.add('ml-0');
        }
        
        // 3. Icono del botón
        if (toggleIconEl) {
            toggleIconEl.setAttribute('data-lucide', isVisible ? 'menu' : 'chevrons-right'); 
            window.lucide.createIcons(); 
        }
    }

    // Función central para alternar la visibilidad
    function toggleSidebar() {
        const sidebarEl = document.getElementById('sidebar-menu');
        if (!sidebarEl) return;
        
        // Determinar si actualmente está visible (si NO contiene la clase de ocultar)
        const isCurrentlyVisible = !sidebarEl.classList.contains('-translate-x-full');
        const shouldBeVisible = !isCurrentlyVisible; 
        
        setSidebarState(shouldBeVisible);
    }

    // =========================================================================
    // LÓGICA DE MODALES (INYECCIÓN DE CONTENIDO)
    // =========================================================================

    // Muestra un modal e inyecta su contenido dinámico (si existe)
    function showModal(containerId, contentId = null) {
        const container = document.getElementById(containerId);
        
        if (contentId) {
            const contentSource = document.getElementById(contentId);
            if (contentSource && container) {
                // 1. Inyecta el contenido HTML del modal en el contenedor global
                container.innerHTML = contentSource.innerHTML;
            }
        }
        
        if (container) {
            // 2. Re-renderizar iconos de Lucide (DEBE ocurrir después de innerHTML)
            if (window.lucide) window.lucide.createIcons();
            
            // 3. Mostrar el modal
            container.classList.remove('hidden');
        }
    }

    // Oculta un modal
    function hideModal(modalId) {
        const container = document.getElementById(modalId);
        if (container) {
            container.classList.add('hidden');
        }
        
        // CRUCIAL: Limpiar el contenido del modal después de ocultarlo para evitar la
        // persistencia del estado del formulario (Crear/Editar) y la duplicación de contenido.
        if (container && (
            modalId === 'confirm-modal-container' || 
            modalId === 'user-modal-container' || 
            modalId === 'provider-modal-container' || 
            modalId === 'assign-modal-container'
        )) {
             // Limpiar el contenido completamente para la próxima inyección
             container.innerHTML = ''; 
        }
    }

    // Modal de confirmación reusable (DISEÑO ACTUALIZADO: ESCUDO + CENTRADO)
    function showConfirmModal(title, messageOrHtml, confirmButtonText, callback) {
        const container = document.getElementById('confirm-modal-container');
        if (!container) return;

        container.innerHTML = '';
        container.classList.remove('hidden');

        // Detectamos si el mensaje parece HTML (contiene etiquetas) para ajustar el margin
        const isHtmlContent = /<[a-z][\s\S]*>/i.test(messageOrHtml);
        const messageClass = isHtmlContent ? 'mb-6' : 'mb-8 text-gray-600';

        const modalHtml = `
            <div class="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center transform scale-100 animate-fade-in border border-gray-100">
                
                <!-- 1. Icono Superior (Escudo/Alerta) -->
                <div class="mx-auto flex items-center justify-center mb-5">
                    <div class="p-3 bg-red-50 rounded-full ring-8 ring-red-50/50">
                        <i data-lucide="shield-alert" class="w-10 h-10 text-red-600"></i>
                    </div>
                </div>

                <!-- 2. Título -->
                <h3 class="text-xl font-extrabold text-gray-900 mb-2">
                    ${title}
                </h3>

                <!-- 3. Contenido (Texto o Tarjeta HTML) -->
                <div class="text-sm ${messageClass}">
                    ${messageOrHtml}
                </div>

                <!-- 4. Botones (Distribución lado a lado) -->
                <div class="flex items-center justify-center gap-3">
                    <!-- Botón Cancelar -->
                    <button type="button" onclick="window.UI.hideModal('confirm-modal-container')" class="w-1/2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-semibold text-sm transition-all shadow-sm">
                        Cancelar
                    </button>

                    <!-- Botón Borrar -->
                    <button id="confirm-action-btn" class="w-1/2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all border border-transparent">
                        ${confirmButtonText}
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = modalHtml;
        
        if (window.lucide) window.lucide.createIcons();

        document.getElementById('confirm-action-btn').addEventListener('click', () => {
            callback();
            hideModal('confirm-modal-container');
        });
    }

    // =========================================================================
    // SISTEMA DE NOTIFICACIONES (TOASTS)
    // =========================================================================

    function showNotification(title, message) {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed bottom-4 right-4 z-[60] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }

        const isError = title.toLowerCase().includes('error') || title.toLowerCase().includes('atención');
        const borderColor = isError ? 'border-red-500' : 'border-green-500';
        const iconName = isError ? 'alert-circle' : 'check-circle';
        const iconColor = isError ? 'text-red-500' : 'text-green-500';

        const toast = document.createElement('div');
        toast.className = `pointer-events-auto bg-white border-l-4 ${borderColor} shadow-2xl rounded-lg p-4 w-80 flex items-start transform transition-all duration-500 translate-y-10 opacity-0`;
        
        toast.innerHTML = `
            <div class="flex-shrink-0">
                <i data-lucide="${iconName}" class="w-6 h-6 ${iconColor}"></i>
            </div>
            <div class="ml-3 w-0 flex-1 pt-0.5">
                <p class="text-sm font-bold text-gray-900">${title}</p>
                <p class="mt-1 text-sm text-gray-500">${message}</p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
                <button class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none btn-close-toast">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        const closeToast = () => {
            toast.classList.add('opacity-0', 'translate-x-full'); 
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 500);
        };

        toast.querySelector('.btn-close-toast').addEventListener('click', closeToast);
        setTimeout(closeToast, 4000);
    }
    
    // =========================================================================
    // ESTADO DE SIDEBAR Y GLOBALES
    // =========================================================================

    function setSidebarVisible() { setSidebarState(true); }
    function setSidebarHidden() { setSidebarState(false); }

    function initGlobalEvents() {
        if (window.lucide) window.lucide.createIcons();
       
        const toggleButton = document.getElementById('sidebar-toggle');
        toggleButton?.removeEventListener('click', toggleSidebar); 

        if (toggleButton) {
            window.UI = UI; 
            toggleButton.addEventListener('click', toggleSidebar);
        }
    }

    // Exponer funciones públicas
    return {
        toggleSidebar,
        showModal,
        hideModal,
        showConfirmModal,
        showNotification,
        initGlobalEvents,
        setSidebarVisible,
        setSidebarHidden
    };
})();

export { UI };