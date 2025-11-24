/**
 * js/services/cola.service.js (Post-Prensa)
 */
import supabase from '../../../../core/http/supabase.client.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : null;
};

export const PostPrensaColaService = {
    async getMyTasks() {
        const user = getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('produccion_postprensa')
            .select(`
                id,
                estado_fase,
                fecha_asignacion,
                ordenes!inner (
                    id,
                    ot_id,
                    codigo,
                    clientes ( razon_social ),
                    orden_items ( producto )
                )
            `)
            .eq('asignado_id', user.id)
            .neq('estado_fase', 'Completado') 
            .order('fecha_asignacion', { ascending: false });

        if (error) return [];

        return data.map(row => {
            const ot = row.ordenes;
            return {
                id: ot.id, 
                ot_id: (ot.ot_id && ot.ot_id !== 'PENDIENTE') ? ot.ot_id : ot.codigo,
                cliente: ot.clientes?.razon_social || 'Sin Cliente',
                producto: (ot.orden_items && ot.orden_items[0]) ? ot.orden_items[0].producto : 'Varios',
                estacion: 'Acabados',
                estado: row.estado_fase, 
                badgeColor: this.getBadgeColor(row.estado_fase)
            };
        });
    },

    async startProcessing(ordenId) {
        const now = new Date().toISOString();
        // Actualizar fase
        await supabase.from('produccion_postprensa')
            .update({ estado_fase: 'En Acabados', fecha_inicio_acabados: now })
            .eq('orden_id', ordenId);
            
        // Actualizar global
        await supabase.from('ordenes')
            .update({ estado: 'En Acabados' })
            .eq('id', ordenId);
            
        return { success: true };
    },

    getBadgeColor(estado) {
        if (estado === 'Pendiente') return 'bg-orange-100 text-orange-800';
        if (estado === 'En Acabados') return 'bg-blue-100 text-blue-800';
        if (estado === 'En Control de Calidad') return 'bg-teal-100 text-teal-800';
        return 'bg-gray-100 text-gray-800';
    }
};