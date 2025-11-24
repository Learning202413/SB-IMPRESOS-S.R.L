/**
 * js/services/detalle.service.js
 * Servicio de Detalle Pre-Prensa (Supabase).
 * Maneja el checklist JSONB y los cambios de estado.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const DetalleService = {
    
    async getTaskById(ordenId) {
        // Traemos datos de la Orden y de la Fase de Pre-Prensa
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                orden_items ( producto, especificaciones ),
                produccion_preprensa ( * )
            `)
            .eq('id', ordenId)
            .single();

        if (error || !data) return null;

        const fase = (data.produccion_preprensa && data.produccion_preprensa[0]) 
            ? data.produccion_preprensa[0] 
            : { checklist: {}, estado_fase: 'Desconocido' };

        return {
            id: data.id,
            ot_id: (data.ot_id && data.ot_id !== 'PENDIENTE') ? data.ot_id : data.codigo,
            cliente: data.clientes?.razon_social,
            producto: (data.orden_items && data.orden_items[0]) ? data.orden_items[0].producto : 'Varios',
            specs: (data.orden_items && data.orden_items[0]) ? data.orden_items[0].especificaciones : 'Ver orden completa',
            // Mapeo del JSONB de Supabase al objeto que espera la UI
            pasos: fase.checklist || { 1: false, 2: false, 3: false, 4: false },
            estado_global: data.estado, // Usamos estado global para sincronización
            comentarios: [] // (Implementar tabla de comentarios si se desea)
        };
    },

    async updateStepStatus(ordenId, stepNumber, isCompleted) {
        // 1. Obtener el checklist actual
        const { data } = await supabase
            .from('produccion_preprensa')
            .select('checklist')
            .eq('orden_id', ordenId)
            .single();

        const currentChecklist = data?.checklist || { 1: false, 2: false, 3: false, 4: false };
        
        // 2. Actualizar el paso específico
        const newChecklist = { ...currentChecklist, [stepNumber]: isCompleted };
        
        const updates = { checklist: newChecklist };
        let globalStatus = null;

        // Lógica de negocio: Cambio de estado automático
        if (stepNumber === 3 && isCompleted) {
            updates.estado_fase = 'En Aprobación de Cliente';
            updates.fecha_envio_aprobacion = new Date().toISOString();
            globalStatus = 'En Aprobación de Cliente';
        }

        // 3. Guardar en Fase
        await supabase
            .from('produccion_preprensa')
            .update(updates)
            .eq('orden_id', ordenId);

        // 4. Guardar en Global si hubo cambio de estado
        if (globalStatus) {
            await supabase
                .from('ordenes')
                .update({ estado: globalStatus })
                .eq('id', ordenId);
        }

        return true;
    },

    async setApprovalStatus(ordenId, tipo) {
        const nuevoEstado = (tipo === 'aprobado') ? 'Diseño Aprobado' : 'Cambios Solicitados';
        
        // Actualizar ambas tablas para consistencia
        await supabase
            .from('produccion_preprensa')
            .update({ estado_fase: nuevoEstado })
            .eq('orden_id', ordenId);

        await supabase
            .from('ordenes')
            .update({ estado: nuevoEstado })
            .eq('id', ordenId);

        log('APROBACION_DISENO', `Estado: ${nuevoEstado} (Orden: ${ordenId})`);
        return true;
    },

    async completeTask(ordenId) {
        const now = new Date().toISOString();
        
        // Finalizar fase Pre-Prensa
        await supabase
            .from('produccion_preprensa')
            .update({ 
                estado_fase: 'Completado', 
                fecha_pase_prensa: now 
            })
            .eq('orden_id', ordenId);

        // Mover estado Global a Siguiente Etapa (Prensa)
        await supabase
            .from('ordenes')
            .update({ 
                estado: 'En prensa',
                // Opcional: Limpiar asignación de prensa para que entre a la cola general de allá
                asignado_prensa: null 
            })
            .eq('id', ordenId);

        log('PASE_A_PRENSA', `Orden ${ordenId} enviada a producción.`);
        return { success: true };
    }
};