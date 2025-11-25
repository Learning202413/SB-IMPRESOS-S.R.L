/**
 * js/services/historial.global.service.js
 * Servicio para gestionar la obtención de logs globales desde Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

export const HistorialGlobalService = {
    async getLogs() {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200); // Límite para rendimiento

        if (error) {
            console.error("Error al obtener logs:", error);
            return [];
        }

        // Mapeo para la vista
        return data.map(log => ({
            ...log,
            // Convertimos created_at (ISO) a formato local legible
            timestamp: new Date(log.created_at).toLocaleString('es-PE'),
            user: log.user_email || 'Sistema'
        }));
    }
};