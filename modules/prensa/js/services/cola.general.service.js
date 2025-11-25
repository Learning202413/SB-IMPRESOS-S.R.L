
/**
 * js/services/cola.general.service.js (Prensa)
 * Lógica replicada de Pre-Prensa para asignación robusta.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null, name: 'Anónimo' };
};

export const ColaGeneralService = {
    async getIncomingTasks() {
        // 1. Buscar órdenes listas para prensa (Estado Global: 'En prensa')
        // y verificar que NO tengan asignado_id en la tabla hija.
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
            console.error("Error cargando cola general prensa:", error);
            return [];
        }

        // 2. Filtrar en JS: Solo las que NO tienen operario asignado
        const incoming = data.filter(o => {
            const fase = o.produccion_prensa;
            
            // Si no existe el registro, está libre.
            if (!fase) return true; 
            
            // Si es array vacio o asignado_id es null
            if (Array.isArray(fase)) {
                return fase.length === 0 || fase[0].asignado_id === null;
            }
            // Si es objeto
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
        // Si ya existe el registro (creado por Pre-Prensa al finalizar), lo actualizamos.
        // Si no existe, lo creamos.
        const { error } = await supabase
            .from('produccion_prensa')
            .upsert({
                orden_id: ordenId,
                asignado_id: user.id,
                estado_fase: 'Asignada a Prensa',
                fecha_asignacion: now,
                maquina_asignada: 'Offset-A' // Default inicial
            }, { onConflict: 'orden_id' });

        if (!error) {
            // Actualizar estado global para reflejar asignación
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
