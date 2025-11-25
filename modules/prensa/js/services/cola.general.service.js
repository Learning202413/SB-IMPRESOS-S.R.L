import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const ColaGeneralService = {
    async getIncomingTasks() {
        // 1. Buscar órdenes que Pre-Prensa dejó listas (Estado global: 'En prensa')
        // Traemos la relación produccion_prensa para ver si ya tiene dueño
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                id, ot_id, codigo, estado,
                clientes ( razon_social ),
                orden_items ( producto ),
                produccion_prensa ( asignado_id )
            `)
            .eq('estado', 'En prensa'); // Este estado lo puso Pre-Prensa al finalizar

        if (error) {
            console.error("Error cargando cola general prensa:", error);
            return [];
        }

        // 2. Filtrar: Solo las que NO tienen operario asignado en la tabla hija
        const incoming = data.filter(o => {
            const fase = o.produccion_prensa;
            
            // Si no existe registro en tabla hija, está libre.
            if (!fase || fase.length === 0) return true; 
            
            // Si existe registro (creado por el sistema al finalizar la fase anterior)
            // verificamos si asignado_id es null
            if (Array.isArray(fase)) {
                return fase[0].asignado_id === null;
            }
            return fase.asignado_id === null;
        });

        return incoming.map(o => ({
            id: o.id,
            ot_id: (o.ot_id && o.ot_id !== 'PENDIENTE') ? o.ot_id : o.codigo,
            cliente: o.clientes?.razon_social || 'General',
            maquina: 'Offset-A (Sugerida)',
            producto: (o.orden_items && o.orden_items[0]) ? o.orden_items[0].producto : 'Varios',
            estado: 'Listo para Impresión'
        }));
    },

    async assignTaskToMe(ordenId) {
        const user = getCurrentUser();
        if (!user.id) return false;
        const now = new Date().toISOString();

        // Lógica idéntica a Pre-Prensa: UPSERT
        // Si el registro ya existe (creado por Pre-Prensa como placeholder), lo actualizamos con el ID del usuario.
        // Si no existe, lo creamos.
        const { error } = await supabase
            .from('produccion_prensa')
            .upsert({
                orden_id: ordenId,
                asignado_id: user.id,
                estado_fase: 'Asignada a Prensa', // Estado inicial personal
                fecha_asignacion: now,
                maquina_asignada: 'Offset-A' // Default
            }, { onConflict: 'orden_id' });

        if (!error) {
            // Actualizar estado global para reflejar que ya no está "disponible" en la bolsa general
            await supabase.from('ordenes')
                .update({ estado: 'Asignada a Prensa' })
                .eq('id', ordenId);
            
            log('TAREA_TOMADA_PRENSA', `Operador ${user.name} tomó la orden ${ordenId}`);
            return true;
        }
        
        console.error("Error asignando tarea prensa:", error);
        return false;
    }
};