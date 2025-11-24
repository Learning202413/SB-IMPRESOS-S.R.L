/**
 * js/services/local.db.js (CRM)
 * Puente de persistencia. Redirige a Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

// Helpers legacy para partes de UI no migradas (si las hubiera)
export const getStorage = (key, seed) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : seed;
};
export const setStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// Objeto LocalDB (Compatibilidad con controladores antiguos que lo importan como objeto)
export const LocalDB = {
    getAll: () => [], // Deprecado por servicios directos
    getById: () => null,
    update: () => false,
    getAllInvoices: () => [],
    saveInvoice: () => {}
};

// LOG GLOBAL EN SUPABASE
export const log = async (action, details) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        const userEmail = session?.user?.email || 'Sistema';

        await supabase.from('audit_logs').insert({
            action: action,
            details: details,
            user_id: userId,
            user_email: userEmail,
            created_at: new Date().toISOString()
        });
        
        console.log(`[AUDIT] ${action}: ${details}`);
    } catch (e) {
        console.warn("No se pudo guardar el log en Supabase", e);
    }
};