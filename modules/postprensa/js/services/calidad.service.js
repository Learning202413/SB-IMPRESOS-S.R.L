/**
 * js/services/calidad.service.js (Post-Prensa)
 * Maneja el checklist JSONB y la finalización absoluta.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const CalidadService = {
    
    async getTaskData(ordenId) {
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                orden_items ( producto, especificaciones ),
                produccion_postprensa ( * )
            `)
            .eq('id', ordenId)
            .single();

        if (error || !data) return null;

        const fase = (data.produccion_postprensa && data.produccion_postprensa[0]) 
            ? data.produccion_postprensa[0] 
            : { checklist: {}, estado_fase: 'Desconocido' };

        return {
            id: data.id,
            ot_id: data.ot_id || data.codigo,
            cliente_nombre: data.clientes?.razon_social,
            producto: data.orden_items[0]?.producto,
            items: [{ producto: data.orden_items[0]?.producto, specs: data.orden_items[0]?.especificaciones }],
            estado: data.estado,
            // Mapeo del JSONB a la UI
            avance_postprensa: fase.checklist || { paso1: false, paso2: false, paso3: false }
        };
    },

    async updateStep(ordenId, stepKey, currentAvance) {
        // Construir nuevo objeto JSON
        const newChecklist = { ...currentAvance, [stepKey]: true };
        const now = new Date().toISOString();
        
        let updates = { checklist: newChecklist };
        let globalStatus = null;

        if (stepKey === 'paso3') {
            updates.estado_fase = 'En Control de Calidad';
            updates.fecha_inicio_calidad = now;
            globalStatus = 'En Control de Calidad';
        }

        // 1. Actualizar checklist
        await supabase.from('produccion_postprensa')
            .update(updates)
            .eq('orden_id', ordenId);

        // 2. Actualizar global
        if (globalStatus) {
            await supabase.from('ordenes').update({ estado: globalStatus }).eq('id', ordenId);
        }

        // Retornar data fresca
        return await this.getTaskData(ordenId);
    },

    async completeOrder(ordenId) {
        const now = new Date().toISOString();
        
        // 1. Marcar fase completada
        await supabase.from('produccion_postprensa')
            .update({ estado_fase: 'Completado', fecha_fin_proceso: now })
            .eq('orden_id', ordenId);

        // 2. FINALIZAR ORDEN GLOBALMENTE (Estado 'Completado')
        const { error } = await supabase.from('ordenes')
            .update({ estado: 'Completado', fecha_asignacion_global: null }) // Opcional: limpiar asignaciones
            .eq('id', ordenId);

        if (!error) log('ORDEN_COMPLETADA', `La orden ${ordenId} finalizó el ciclo productivo.`);
        return !error;
    }
};