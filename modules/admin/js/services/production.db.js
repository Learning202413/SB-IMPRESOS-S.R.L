import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const productionDB = {
    async getOTs() {
        const { data, error } = await supabase
            .from('ordenes')
            .select(`*, clientes (razon_social), orden_items (producto)`)
            .neq('estado', 'Nueva')
            .order('fecha_creacion', { ascending: false });

        if (error) return [];

        return data.map(ot => ({
            ...ot,
            cliente_nombre: ot.clientes?.razon_social || 'Sin Cliente',
            items: ot.orden_items || [],
            // Placeholders visuales
            asignado_nombre_preprensa: 'Ver Detalle',
            asignado_nombre_prensa: 'Ver Detalle',
            asignado_nombre_postprensa: 'Ver Detalle'
        }));
    },

    async assignOT(otId, userId, userName, newStatus) {
        let updates = { estado: newStatus, updated_at: new Date().toISOString() };
        
        if (newStatus.includes('Diseño')) updates.asignado_preprensa = userId;
        else if (newStatus.includes('Prensa')) updates.asignado_prensa = userId;
        else if (newStatus.includes('Post') || newStatus === 'Pendiente') updates.asignado_postprensa = userId;

        // Intenta actualizar por ID o por OT_ID
        const { error } = await supabase.from('ordenes').update(updates).or(`id.eq.${otId},ot_id.eq.${otId}`);
        
        if (!error) log('OT_ASIGNADA', `Orden ${otId} -> ${newStatus} (${userName})`);
        return { success: !error };
    },

    async getDashboardStats() {
        const { count: total } = await supabase.from('ordenes').select('*', { count: 'exact', head: true });
        const { count: pending } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).in('estado', ['Orden creada', 'En proceso', 'Pendiente']);
        return { totalOTs: total || 0, pendingOTs: pending || 0 };
    },

    async getProductionTrend() {
        // Mock para gráfico por ahora
        return [{ label: 'Ago', count: 80 }, { label: 'Sep', count: 100 }, { label: 'Oct', count: 95 }, { label: 'Nov', count: 120 }];
    }
};