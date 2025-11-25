/**
 * js/services/cola.general.service.js
 * Servicio "Pull" para tomar tareas nuevas (Supabase).
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const ColaGeneralService = {
    async getUnassignedTasks() {
        // Estrategia: Buscar en 'ordenes' las que están "Orden creada"
        // y verificar que no estén ya asignadas en pre-prensa.
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id,
                ot_id,
                codigo,
                estado,
                fecha_creacion,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_preprensa ( asignado_id )
            `)
            .eq('estado', 'Orden creada');

        if (error) {
            console.error("Error cargando cola general:", error);
            return [];
        }

        // Filtramos en JS las que ya tienen registro en pre-prensa con alguien asignado
        const unassigned = data.filter(o => {
            const pre = o.produccion_preprensa;
            // Si no existe registro de fase o el array está vacío, está libre.
            // Si existe pero asignado_id es null, también está libre.
            if (!pre || pre.length === 0) return true;
            return pre[0].asignado_id === null; 
        });

        return unassigned.map(o => ({
            id: o.id, // UUID
            ot_id: (o.ot_id && o.ot_id !== 'PENDIENTE') ? o.ot_id : o.codigo,
            cliente: o.clientes?.razon_social || 'Cliente General',
            producto: (o.orden_items && o.orden_items[0]) ? o.orden_items[0].producto : 'Varios',
            fecha_creacion: new Date(o.fecha_creacion).toLocaleDateString(),
            estado: o.estado
        }));
    },

    async assignTaskToMe(ordenId) {
        const user = getCurrentUser();
        if (!user.id) return false;

        // Transacción lógica:
        // 1. Verificar si existe registro en 'produccion_preprensa'
        const { data: existing } = await supabase
            .from('produccion_preprensa')
            .select('id')
            .eq('orden_id', ordenId)
            .maybeSingle();

        let errorOps;

        if (existing) {
            // Actualizar existente
            const { error } = await supabase
                .from('produccion_preprensa')
                .update({ 
                    asignado_id: user.id,
                    estado_fase: 'Diseño Pendiente',
                    fecha_asignacion: new Date().toISOString()
                })
                .eq('orden_id', ordenId);
            errorOps = error;
        } else {
            // Crear nuevo registro de fase
            const { error } = await supabase
                .from('produccion_preprensa')
                .insert({
                    orden_id: ordenId,
                    asignado_id: user.id,
                    estado_fase: 'Diseño Pendiente',
                    checklist: { 1: false, 2: false, 3: false, 4: false } // Checklist inicial
                });
            errorOps = error;
        }

        if (!errorOps) {
            // Actualizar estado global
            await supabase
                .from('ordenes')
                .update({ 
                    estado: 'Diseño Pendiente',
                    asignado_preprensa: user.id // Espejo en tabla principal para búsquedas rápidas
                })
                .eq('id', ordenId);
                
            log('TAREA_TOMADA', `Diseño tomado por ${user.name} (Orden: ${ordenId})`);
            return true;
        }
        
        console.error("Error al asignar tarea:", errorOps);
        return false;
    }
};