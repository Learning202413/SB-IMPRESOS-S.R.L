/**
 * js/services/detalle.service.js
 * Servicio Ajustado al Esquema SQL de Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null };
};

export const DetalleService = {
    
    async getTaskById(ordenId) {
        // 1. Obtener datos de la Orden (Cabecera)
        const { data: orden, error: errorOrden } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                orden_items ( producto, especificaciones )
            `)
            .eq('id', ordenId)
            .single();

        if (errorOrden || !orden) {
            console.error("[Service] Error cargando orden:", errorOrden);
            return null;
        }

        // 2. Obtener datos de la Fase (Pre-Prensa)
        const { data: fase, error: errorFase } = await supabase
            .from('produccion_preprensa')
            .select('*')
            .eq('orden_id', ordenId)
            .maybeSingle();

        if (errorFase) console.warn("[Service] Warning cargando fase:", errorFase);

        // Si no existe fase, usamos defaults
        const datosFase = fase || { 
            checklist: { "1": false, "2": false, "3": false, "4": false }, 
            estado_fase: 'Pendiente' 
        };

        return {
            id: orden.id,
            ot_id: (orden.ot_id && orden.ot_id !== 'PENDIENTE') ? orden.ot_id : orden.codigo,
            cliente: orden.clientes?.razon_social,
            producto: (orden.orden_items && orden.orden_items[0]) ? orden.orden_items[0].producto : 'Varios',
            specs: (orden.orden_items && orden.orden_items[0]) ? orden.orden_items[0].especificaciones : 'Ver orden completa',
            pasos: datosFase.checklist || { "1": false, "2": false, "3": false, "4": false },
            estado_global: orden.estado
        };
    },

    async updateStepStatus(ordenId, stepNumber, isCompleted) {
        try {
            const user = getCurrentUser();
            const stepKey = String(stepNumber);

            // 1. Buscar registro existente
            const { data: existing } = await supabase
                .from('produccion_preprensa')
                .select('*')
                .eq('orden_id', ordenId)
                .maybeSingle();

            // 2. Calcular nuevo checklist
            const currentChecklist = existing?.checklist || { "1": false, "2": false, "3": false, "4": false };
            const newChecklist = { ...currentChecklist, [stepKey]: isCompleted };
            
            // 3. Definir nuevo estado de la fase
            let nuevoEstado = existing?.estado_fase || 'En diseño';
            if (stepKey === "3" && isCompleted) nuevoEstado = 'En Aprobación de Cliente';
            if (stepKey === "4" && isCompleted) nuevoEstado = 'Diseño Aprobado';

            const upsertData = {
                orden_id: ordenId,
                checklist: newChecklist,
                estado_fase: nuevoEstado,
                asignado_id: user.id,
                fecha_asignacion: existing?.fecha_asignacion || new Date().toISOString()
            };

            if (!existing) upsertData.fecha_inicio_diseno = new Date().toISOString();
            if (stepKey === "3" && isCompleted) upsertData.fecha_envio_aprobacion = new Date().toISOString();

            // 4. Guardar (UPSERT)
            const { data: savedData, error } = await supabase
                .from('produccion_preprensa')
                .upsert(upsertData, { onConflict: 'orden_id' })
                .select()
                .single();

            if (error) throw error;

            // 5. Sincronizar estado global en 'ordenes'
            // Solo actualizamos si es relevante para el flujo global
            if (stepKey === "3") {
                await supabase.from('ordenes').update({ estado: 'En Aprobación de Cliente' }).eq('id', ordenId);
            } else if (stepKey === "4") {
                await supabase.from('ordenes').update({ estado: 'Diseño Aprobado' }).eq('id', ordenId);
            }

            return { success: true, data: savedData };

        } catch (error) {
            console.error("[Service] Error updateStepStatus:", error);
            return { success: false, message: error.message };
        }
    },

    async setApprovalStatus(ordenId, tipo) {
        const nuevoEstado = (tipo === 'aprobado') ? 'Diseño Aprobado' : 'Cambios Solicitados';
        
        // Actualizamos ambas tablas para mantener consistencia
        await supabase.from('produccion_preprensa').update({ estado_fase: nuevoEstado }).eq('orden_id', ordenId);
        await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', ordenId);
        
        return true;
    },

    /**
     * TRANSICIÓN FINAL A PRENSA (CORREGIDO SEGÚN SQL)
     */
    async completeTask(ordenId) {
        const now = new Date().toISOString();
        
        // 1. Cerrar Pre-Prensa
        // Marcamos esta fase como completada.
        const { error: errPre } = await supabase
            .from('produccion_preprensa')
            .update({ estado_fase: 'Completado', fecha_pase_prensa: now })
            .eq('orden_id', ordenId);

        if (errPre) return { success: false, message: "Error cerrando diseño: " + errPre.message };

        // 2. Inicializar Prensa (COLA GENERAL)
        // Hacemos un UPSERT en 'produccion_prensa'. 
        // IMPORTANTE: 'asignado_id' va como NULL explícitamente.
        // Esto es lo que tus controladores de Admin y Cola General buscan.
        const { error: errPrensa } = await supabase
            .from('produccion_prensa')
            .upsert({ 
                orden_id: ordenId,
                estado_fase: 'Pendiente', // Estado inicial para prensa
                asignado_id: null,        // NULL = Sin Asignar (Cola General)
                maquina_asignada: null,
                fecha_asignacion: now
            }, { onConflict: 'orden_id' }); // Tu SQL define orden_id como UNIQUE en esta tabla

        if (errPrensa) return { success: false, message: "Error iniciando prensa: " + errPrensa.message };

        // 3. Actualizar Orden Global
        // Solo actualizamos el estado. NO tocamos asignado_prensa porque esa columna no existe.
        const { error: errOrden } = await supabase
            .from('ordenes')
            .update({ estado: 'En prensa' }) 
            .eq('id', ordenId);

        if (errOrden) return { success: false, message: "Error estado global: " + errOrden.message };

        return { success: true };
    }
};