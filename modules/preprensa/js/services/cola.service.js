/**
 * js/services/cola.service.js
 * Servicio de "Mis Tareas" para Pre-Prensa (Supabase).
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

        // Consultamos la tabla específica de esta fase
        const { data, error } = await supabase
            .from('produccion_preprensa')
            .select(`
                id,
                estado_fase,
                fecha_asignacion,
                ordenes!inner (
                    id,
                    ot_id,
                    codigo,
                    fecha_creacion,
                    clientes ( razon_social ),
                    orden_items ( producto )
                )
            `)
            .eq('asignado_id', user.id)
            .neq('estado_fase', 'Completado') // Ocultar las terminadas si se desea
            .order('fecha_asignacion', { ascending: false });

        if (error) {
            console.error("Error cargando mis tareas:", error);
            return [];
        }

        // Mapeo para la vista (UI)
        return data.map(row => {
            const ot = row.ordenes;
            // Usamos OT_ID si existe, sino el Código de cotización
            const displayId = (ot.ot_id && ot.ot_id !== 'PENDIENTE') ? ot.ot_id : ot.codigo;
            
            return {
                id: ot.id, // ID real (UUID) para navegación
                ot_id: displayId,
                cliente: ot.clientes?.razon_social || 'Sin Cliente',
                producto: (ot.orden_items && ot.orden_items[0]) ? ot.orden_items[0].producto : 'Varios',
                fecha_creacion: new Date(ot.fecha_creacion).toLocaleDateString(),
                estado: row.estado_fase || 'Asignado',
                badgeColor: this.getBadgeColor(row.estado_fase)
            };
        });
    },

    async updateStatus(ordenId, newStatus) {
        // Actualizamos el estado en la tabla de la fase
        const { error } = await supabase
            .from('produccion_preprensa')
            .update({ 
                estado_fase: newStatus,
                fecha_inicio_diseno: newStatus === 'En diseño' ? new Date().toISOString() : undefined
            })
            .eq('orden_id', ordenId);

        // También actualizamos el estado global en 'ordenes' para que el CRM lo vea
        if (!error) {
            await supabase
                .from('ordenes')
                .update({ estado: newStatus })
                .eq('id', ordenId);
        }

        return { success: !error };
    },

    getBadgeColor(estado) {
        if (estado === 'En diseño') return 'bg-indigo-100 text-indigo-800';
        if (estado === 'En Aprobación de Cliente') return 'bg-yellow-100 text-yellow-800';
        if (estado === 'Diseño Aprobado') return 'bg-green-100 text-green-800';
        return 'bg-blue-100 text-blue-800'; 
    }
};