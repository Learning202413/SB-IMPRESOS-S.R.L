// Importamos los servicios de Supabase
// IMPORTANTE: Si los archivos de ./core/... no existen, el script se detendrá aquí.
import { authService } from './core/auth/auth.service.js';
import supabase from './core/http/supabase.client.js';

// --- Elementos del DOM ---
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const messageBox = document.getElementById('messageBox');

// --- Configuración ---
const MODULES_PATH = './modules';
const SESSION_KEY = 'erp_session';

/**
 * Muestra mensajes de estado en la interfaz
 */
function showMessage(message, type) {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `p-3 text-sm rounded-lg font-medium text-center mt-3 ${
        type === 'error' ? 'bg-red-100 text-red-700' : 
        type === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
    }`;
    messageBox.classList.remove('hidden');
}

/**
 * Controla el estado de carga del botón
 */
function toggleLoading(isLoading) {
    if (!loginButton) return;
    loginButton.disabled = isLoading;
    loginButton.textContent = isLoading ? 'Cargando...' : 'Iniciar Sesión';
    if (emailInput) emailInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;
}

/**
 * Lógica del OJO (Mostrar/Ocultar contraseña)
 * Se mantiene intacta para preservar la funcionalidad visual.
 */
function initializePasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const eyeOpen = document.getElementById('eye-open');
    const eyeClosed = document.getElementById('eye-closed');
    const pwdInput = document.getElementById('password'); 
    
    if (togglePassword && pwdInput) {
        togglePassword.addEventListener('click', (e) => {
            // Evitar que el botón dispare el submit del form
            e.preventDefault(); 
            e.stopPropagation();

            const currentType = pwdInput.getAttribute('type');
            const newType = currentType === 'password' ? 'text' : 'password';
            pwdInput.setAttribute('type', newType);
            
            if(eyeOpen) eyeOpen.classList.toggle('hidden');
            if(eyeClosed) eyeClosed.classList.toggle('hidden');
        });
    }
}

/**
 * Redirección basada en Rol
 */
function redirectUserByRole(rol) {
    const routes = {
        'Admin (Gerente)': 'admin',
        'Vendedor (CRM)': 'crm',
        'Diseñador (Pre-Prensa)': 'preprensa',
        'Operador (Prensa)': 'prensa',
        'Operador (Post-Prensa)': 'postprensa',
        'Almacén (Inventario)': 'inventario'
    };
    
    const module = routes[rol];
    if (module) {
        window.location.href = `${MODULES_PATH}/${module}/index.html`;
    } else {
        showMessage('Rol no configurado en el sistema.', 'error');
        toggleLoading(false);
    }
}

// --- Manejo del Submit (Login) ---
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoading(true);

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('Por favor completa todos los campos.', 'error');
        toggleLoading(false);
        return;
    }

    try {
        // 1. Autenticación contra Supabase
        const { user, error } = await authService.login(email, password);

        if (error) {
            console.error("Error Login:", error);
            showMessage('Credenciales incorrectas o error de conexión.', 'error');
            toggleLoading(false);
            return;
        }

        if (user) {
            // 2. Buscar datos del perfil (Rol y Nombre) en tabla 'profiles'
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                console.error("Error Perfil:", profileError);
                showMessage('Usuario sin perfil asignado.', 'warning');
                toggleLoading(false);
                return;
            }

            // 3. Guardar sesión local para compatibilidad
            const sessionData = {
                id: user.id,
                email: user.email,
                name: profile.full_name || 'Usuario',
                role: profile.role || 'Sin Rol',
                token: (await supabase.auth.getSession()).data.session?.access_token
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

            showMessage(`¡Bienvenido, ${sessionData.name}!`, 'success');
            
            setTimeout(() => {
                redirectUserByRole(sessionData.role);
            }, 1000);
        }
    } catch (err) {
        console.error("Error crítico:", err);
        showMessage('Error inesperado del sistema.', 'error');
        toggleLoading(false);
    }
});

// --- Inicialización al cargar la página ---
document.addEventListener('DOMContentLoaded', () => {
    initializePasswordToggle();
    // Limpiamos sesión previa al cargar el login
    localStorage.removeItem(SESSION_KEY);
});