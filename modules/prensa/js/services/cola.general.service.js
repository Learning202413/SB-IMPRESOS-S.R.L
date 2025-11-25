/**
 * js/services/cola.general.service.js (Prensa)
 * CORREGIDO: Manejo de Objeto/Array y eliminación de columnas fantasma.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const ColaGeneralService = {
    async getIncomingTasks() {
        // 1. Traemos OTs que están en estado 'En prensa' o 'Asignada a Prensa' pero sin responsable
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id, ot_id, codigo, estado,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_prensa ( asignado_id )
            `)
            .eq('estado', 'En prensa');

        if (error) {
            console.error("Error cola general prensa:", error);
            return [];
        }

        // 2. Filtro robusto para detectar tareas sin asignar
        const incoming = data.filter(o => {
            const fase = o.produccion_prensa;
            
            // Si no existe registro de fase, está libre (aunque debería existir por la transición anterior)
            if (!fase) return true; 

            // Si es Array (caso legacy o 1:N)
            if (Array.isArray(fase)) {
                if (fase.length === 0) return true;
                return fase[0].asignado_id === null;
            }

            // Si es Objeto (caso actual 1:1)
            return fase.asignado_id === null;
        });

        return incoming.map(o => ({
            id: o.id,
            ot_id: (o.ot_id && o.ot_id !== 'PENDIENTE') ? o.ot_id : o.codigo,
            cliente: o.clientes?.razon_social || 'General',
            maquina: 'Por asignar',
            producto: (o.orden_items && o.orden_items[0]) ? o.orden_items[0].producto : 'Varios',
            estado: 'Listo para Impresión'
        }));
    },

    async assignTaskToMe(ordenId) {
        const user = getCurrentUser();
        if (!user.id) return false;
        const now = new Date().toISOString();

        // 1. Verificar si existe el registro en la fase
        const { data: existing } = await supabase
            .from('produccion_prensa')
            .select('id')
            .eq('orden_id', ordenId)
            .maybeSingle();

        let errorOps;

        // 2. Actualizar o Crear en tabla hija (produccion_prensa)
        if (existing) {
            const { error } = await supabase.from('produccion_prensa')
                .update({ 
                    asignado_id: user.id,
                    estado_fase: 'Asignada a Prensa',
                    fecha_asignacion: now
                })
                .eq('orden_id', ordenId);
            errorOps = error;
        } else {
            const { error } = await supabase.from('produccion_prensa')
                .insert({
                    orden_id: ordenId,
                    asignado_id: user.id,
                    estado_fase: 'Asignada a Prensa',
                    fecha_asignacion: now,
                    maquina_asignada: 'Offset-A'
                });
            errorOps = error;
        }

        if (!errorOps) {
            // 3. Actualizar Global (SOLO ESTADO)
            // Eliminamos 'asignado_prensa' porque esa columna no existe en tu tabla 'ordenes'
            await supabase.from('ordenes')
                .update({ estado: 'Asignada a Prensa' })
                .eq('id', ordenId);
            
            log('TAREA_TOMADA_PRENSA', `Operador ${user.name} tomó la orden ${ordenId}`);
            return true;
        }
        return false;
    }
};