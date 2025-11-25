/**
 * js/services/calidad.service.js (Post-Prensa)
 * CORRECCIÓN: Fusión robusta de checklist para evitar reseteos visuales.
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
            : null;

        // --- FIX: Lógica de Fusión de Checklist ---
        const defaultChecklist = { paso1: false, paso2: false, paso3: false };
        
        // Si viene de DB, lo usamos. Si está vacío o es null, usamos {}
        const dbChecklist = (fase && fase.checklist) ? fase.checklist : {};
        
        // Mezclamos: Defaults + Datos DB (Los datos de DB sobrescriben los defaults)
        const finalChecklist = { ...defaultChecklist, ...dbChecklist };

        return {
            id: data.id,
            ot_id: data.ot_id || data.codigo,
            cliente_nombre: data.clientes?.razon_social,
            producto: data.orden_items[0]?.producto,
            items: [{ producto: data.orden_items[0]?.producto, specs: data.orden_items[0]?.especificaciones }],
            estado: data.estado,
            avance_postprensa: finalChecklist // Usamos el objeto seguro
        };
    },

    async updateStep(ordenId, stepKey, currentAvance) {
        // Asegurar que currentAvance tenga base sólida
        const safeAvance = { 
            paso1: false, paso2: false, paso3: false, 
            ...currentAvance 
        };
        
        // Construir nuevo objeto
        const newChecklist = { ...safeAvance, [stepKey]: true };
        const now = new Date().toISOString();
        
        let updates = { checklist: newChecklist };
        let globalStatus = null;

        if (stepKey === 'paso3') {
            updates.estado_fase = 'En Control de Calidad';
            updates.fecha_inicio_calidad = now;
            globalStatus = 'En Control de Calidad';
        }

        // 1. Actualizar checklist
        const { error } = await supabase.from('produccion_postprensa')
            .update(updates)
            .eq('orden_id', ordenId);

        if (error) {
            console.error("Error guardando paso:", error);
            return null;
        }

        // 2. Actualizar global
        if (globalStatus) {
            await supabase.from('ordenes').update({ estado: globalStatus }).eq('id', ordenId);
        }

        // Retornar la estructura exacta que espera el controlador
        return {
            avance_postprensa: newChecklist
        };
    },

    async completeOrder(ordenId) {
        const now = new Date().toISOString();
        
        await supabase.from('produccion_postprensa')
            .update({ estado_fase: 'Completado', fecha_fin_proceso: now })
            .eq('orden_id', ordenId);

        const { error } = await supabase.from('ordenes')
            .update({ estado: 'Completado', fecha_asignacion_global: null }) 
            .eq('id', ordenId);

        if (!error) log('ORDEN_COMPLETADA', `La orden ${ordenId} finalizó el ciclo productivo.`);
        return !error;
    }
};