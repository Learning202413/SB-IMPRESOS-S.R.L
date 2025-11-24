/**
 * js/services/local.db.js (Inventario)
 * Adaptador para logs hacia Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

// Helpers Legacy
export const getStorage = (key, seed) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : seed;
};
export const setStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// LOG GLOBAL EN SUPABASE
export const log = async (action, details) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('audit_logs').insert({
            action, 
            details, 
            user_id: session?.user?.id, 
            user_email: session?.user?.email || 'Almacén',
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn("Error guardando log:", e);
    }
};

export const dbBase = {
    getLogs: async () => [], // No usado en inventario, pero por compatibilidad
    getStorage,
    setStorage,
    log
};