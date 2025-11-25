import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const PostPrensaColaGeneralService = {
    async getIncomingTasks() {
        // 1. Buscar órdenes listas para acabados (Estado global puesto por Prensa)
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id, ot_id, codigo, estado,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_postprensa ( asignado_id )
            `)
            .eq('estado', 'En Post-Prensa'); // Filtro exacto

        if (error) return [];

        // 2. Filtrar tareas sin asignar
        const incoming = data.filter(o => {
            const fase = o.produccion_postprensa;
            // Si no existe registro o asignado_id es null, está libre
            if (!fase || fase.length === 0) return true;
            if (Array.isArray(fase)) return fase[0].asignado_id === null;
            return fase.asignado_id === null;
        });

        return incoming.map(o => ({
            id: o.id, 
            ot_id: (o.ot_id && o.ot_id !== 'PENDIENTE') ? o.ot_id : o.codigo,
            cliente: o.clientes?.razon_social,
            producto: o.orden_items[0]?.producto || 'Varios',
            estacion: 'Acabados Generales',
            estado: 'Listo para Acabados'
        }));
    },

    async assignTaskToMe(ordenId) {
        const user = getCurrentUser();
        if (!user.id) return false;
        const now = new Date().toISOString();

        // Lógica idéntica a Pre-Prensa: UPSERT
        const { error } = await supabase
            .from('produccion_postprensa')
            .upsert({
                orden_id: ordenId,
                asignado_id: user.id,
                estado_fase: 'En Acabados', // Estado inicial personal
                fecha_asignacion: now,
                // Inicializamos checklist para que el controlador de detalle no falle
                checklist: { paso1: false, paso2: false, paso3: false } 
            }, { onConflict: 'orden_id' });

        if (!error) {
            // Actualizar estado global
            await supabase.from('ordenes')
                .update({ estado: 'En Acabados' }) 
                .eq('id', ordenId);
                
            log('TAREA_TOMADA_POST', `Post-Prensa asignada a ${user.name}`);
            return true;
        }
        
        console.error("Error asignando tarea post-prensa:", error);
        return false;
    }
};