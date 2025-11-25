/**
 * js/services/cola.service.js (Prensa)
 * Gestiona las tareas asignadas al maquinista actual.
 */
import supabase from '../../../../core/http/supabase.client.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : null;
};

export const ColaService = {
    async getMyTasks() {
        const user = getCurrentUser();
        if (!user) return [];

        // Consultamos la tabla de producción de prensa vinculada a las órdenes
        const { data, error } = await supabase
            .from('produccion_prensa')
            .select(`
                id,
                estado_fase,
                maquina_asignada,
                fecha_asignacion,
                ordenes!inner (
                    id,
                    ot_id,
                    codigo,
                    cliente_id,
                    clientes ( razon_social ),
                    orden_items ( producto )
                )
            `)
            .eq('asignado_id', user.id)
            .neq('estado_fase', 'Completado') // Ocultar terminadas
            .order('fecha_asignacion', { ascending: false });

        if (error) {
            console.error("Error cargando cola de prensa:", error);
            return [];
        }

        return data.map(row => {
            const ot = row.ordenes;
            const displayId = (ot.ot_id && ot.ot_id !== 'PENDIENTE') ? ot.ot_id : ot.codigo;

            return {
                id: ot.id, // UUID para navegación
                ot_id: displayId,
                cliente: ot.clientes?.razon_social || 'Sin Cliente',
                maquina: row.maquina_asignada || 'Offset-A',
                producto: (ot.orden_items && ot.orden_items[0]) ? ot.orden_items[0].producto : 'Varios',
                fecha: new Date(row.fecha_asignacion).toLocaleDateString(),
                estado: row.estado_fase,
                badgeColor: this.getBadgeColor(row.estado_fase)
            };
        });
    },

    async updateStatus(ordenId, newStatus) {
        const now = new Date().toISOString();
        
        const updates = { estado_fase: newStatus };
        if (newStatus === 'En proceso' || newStatus === 'En Preparación') {
            updates.fecha_inicio_prep = now;
        }

        // 1. Actualizar fase
        const { error } = await supabase
            .from('produccion_prensa')
            .update(updates)
            .eq('orden_id', ordenId);

        // 2. Actualizar global
        if (!error) {
            await supabase.from('ordenes').update({ estado: newStatus }).eq('id', ordenId);
        }

        return { success: !error };
    },

    getBadgeColor(estado) {
        if (estado === 'En proceso') return 'bg-indigo-100 text-indigo-800';
        if (estado === 'En Preparación') return 'bg-yellow-100 text-yellow-800';
        if (estado === 'Imprimiendo') return 'bg-blue-600 text-white animate-pulse';
        return 'bg-blue-100 text-blue-800'; 
    }
};