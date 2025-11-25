/**
 * js/services/cola.general.service.js (Prensa)
 * Permite tomar tareas que vienen de Pre-Prensa.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const ColaGeneralService = {
    async getIncomingTasks() {
        // Buscar órdenes que están 'En prensa' pero NO tienen asignado_id en la tabla de producción
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id,
                ot_id,
                codigo,
                estado,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_prensa ( asignado_id )
            `)
            .eq('estado', 'En prensa');

        if (error) return [];

        // Filtramos las que no tienen asignado_id en la subtabla
        const incoming = data.filter(o => {
            const prensaData = o.produccion_prensa;
            // Si no existe registro o asignado_id es null
            if (!prensaData || prensaData.length === 0) return true;
            return prensaData[0].asignado_id === null;
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

        // Upsert: Si ya existe el registro (creado por Admin vacio), lo actualiza. Si no, lo crea.
        // Nota: Verificamos primero si existe para decidir si hacemos update o insert
        const { data: existing } = await supabase
            .from('produccion_prensa')
            .select('id')
            .eq('orden_id', ordenId)
            .maybeSingle();

        let errorOps;
        const now = new Date().toISOString();

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
                    maquina_asignada: 'Offset-A' // Default
                });
            errorOps = error;
        }

        if (!errorOps) {
            await supabase.from('ordenes')
                .update({ 
                    estado: 'Asignada a Prensa',
                    asignado_prensa: user.id
                })
                .eq('id', ordenId);
            
            log('TAREA_TOMADA_PRENSA', `Operador ${user.name} tomó la orden ${ordenId}`);
            return true;
        }
        return false;
    }
};