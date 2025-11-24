/**
 * js/services/cola-general.service.js (Post-Prensa)
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const PostPrensaColaGeneralService = {
    async getIncomingTasks() {
        // Buscar órdenes 'En Post-Prensa' o 'Pendiente' que no tengan asignado en postprensa
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id, ot_id, codigo, estado,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_postprensa ( asignado_id )
            `)
            .or('estado.eq.En Post-Prensa,estado.eq.Pendiente'); // Estados de entrada

        if (error) return [];

        const incoming = data.filter(o => {
            const post = o.produccion_postprensa;
            if (!post || post.length === 0) return true;
            return post[0].asignado_id === null;
        });

        return incoming.map(o => ({
            id: o.id, 
            ot_id: o.ot_id || o.codigo, 
            cliente: o.clientes?.razon_social,
            producto: o.orden_items[0]?.producto || 'Varios',
            estacion: 'Acabados Generales',
            estado: 'Por Asignar'
        }));
    },

    async assignTaskToMe(ordenId) {
        const user = getCurrentUser();
        if (!user.id) return false;
        const now = new Date().toISOString();

        // Upsert en produccion_postprensa
        const { data: existing } = await supabase
            .from('produccion_postprensa')
            .select('id')
            .eq('orden_id', ordenId)
            .maybeSingle();

        let errorOps;
        if (existing) {
            const { error } = await supabase.from('produccion_postprensa')
                .update({ asignado_id: user.id, estado_fase: 'Pendiente', fecha_asignacion: now })
                .eq('orden_id', ordenId);
            errorOps = error;
        } else {
            const { error } = await supabase.from('produccion_postprensa')
                .insert({ orden_id: ordenId, asignado_id: user.id, estado_fase: 'Pendiente', fecha_asignacion: now, checklist: { paso1: false, paso2: false, paso3: false } });
            errorOps = error;
        }

        if (!errorOps) {
            await supabase.from('ordenes')
                .update({ estado: 'Pendiente', asignado_postprensa: user.id })
                .eq('id', ordenId);
            log('TAREA_TOMADA_POST', `Post-Prensa asignada a ${user.name}`);
            return true;
        }
        return false;
    }
};