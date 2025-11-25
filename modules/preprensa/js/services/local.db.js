/**
 * js/services/local.db.js (Pre-Prensa)
 * Puente de logs hacia Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

// Helpers legacy (por si queda algo sin migrar)
export const getStorage = (key, seed) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : seed;
};
export const setStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Objeto LocalDB Legacy (para evitar errores en controladores no migrados al 100%)
export const LocalDB = {
    getAll: () => [],
    getById: () => null,
    update: () => false
};

// LOG GLOBAL EN SUPABASE
export const log = async (action, details) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        const userEmail = session?.user?.email || 'Diseñador';

        await supabase.from('audit_logs').insert({
            action: action,
            details: details,
            user_id: userId,
            user_email: userEmail,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn("No se pudo guardar el log:", e);
    }
};