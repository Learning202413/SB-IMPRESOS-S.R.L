/**
 * js/services/detalle.service.js
 * Servicio corregido: Consultas separadas para asegurar la lectura de datos.
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

        // 2. Obtener datos de la Fase (Pre-Prensa) DIRECTAMENTE
        // Esto evita problemas con los JOINS anidados que a veces vienen vacíos
        const { data: fase, error: errorFase } = await supabase
            .from('produccion_preprensa')
            .select('*')
            .eq('orden_id', ordenId)
            .maybeSingle();

        // Si hay error de conexión en la fase, loguearlo, pero no romper todo
        if (errorFase) console.warn("[Service] Warning cargando fase:", errorFase);

        // Datos por defecto si no existe la fase aún
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
            
            // Aseguramos que checklist sea un objeto válido
            pasos: datosFase.checklist || { "1": false, "2": false, "3": false, "4": false },
            estado_global: orden.estado
        };
    },

    async updateStepStatus(ordenId, stepNumber, isCompleted) {
        try {
            const user = getCurrentUser();
            const stepKey = String(stepNumber); // Asegurar clave string para JSON

            // 1. Buscar registro existente
            const { data: existing } = await supabase
                .from('produccion_preprensa')
                .select('*')
                .eq('orden_id', ordenId)
                .maybeSingle();

            // 2. Calcular nuevo checklist
            const currentChecklist = existing?.checklist || { "1": false, "2": false, "3": false, "4": false };
            const newChecklist = { ...currentChecklist, [stepKey]: isCompleted };
            
            // 3. Definir nuevo estado
            let nuevoEstado = existing?.estado_fase || 'En diseño';
            if (stepKey === "3" && isCompleted) nuevoEstado = 'En Aprobación de Cliente';
            if (stepKey === "4" && isCompleted) nuevoEstado = 'Diseño Aprobado';

            const upsertData = {
                orden_id: ordenId,
                checklist: newChecklist,
                estado_fase: nuevoEstado,
                asignado_id: user.id, // Reafirmar asignación
                fecha_asignacion: existing?.fecha_asignacion || new Date().toISOString()
            };

            // Agregar fecha de inicio si es el primer paso
            if (!existing) {
                upsertData.fecha_inicio_diseno = new Date().toISOString();
            }
            // Agregar fecha de envío si es paso 3
            if (stepKey === "3" && isCompleted) {
                upsertData.fecha_envio_aprobacion = new Date().toISOString();
            }

            // 4. Guardar (UPSERT)
            const { data: savedData, error } = await supabase
                .from('produccion_preprensa')
                .upsert(upsertData, { onConflict: 'orden_id' })
                .select()
                .single();

            if (error) throw error;

            // 5. Sincronizar estado global si cambió
            if (stepKey === "3") {
                await supabase.from('ordenes').update({ estado: 'En Aprobación de Cliente' }).eq('id', ordenId);
            }

            return { success: true, data: savedData };

        } catch (error) {
            console.error("[Service] Error updateStepStatus:", error);
            return { success: false, message: error.message };
        }
    },

    async setApprovalStatus(ordenId, tipo) {
        const nuevoEstado = (tipo === 'aprobado') ? 'Diseño Aprobado' : 'Cambios Solicitados';
        await supabase.from('produccion_preprensa').update({ estado_fase: nuevoEstado }).eq('orden_id', ordenId);
        await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', ordenId);
        return true;
    },

    async completeTask(ordenId) {
        const now = new Date().toISOString();
        await supabase.from('produccion_preprensa').update({ estado_fase: 'Completado', fecha_pase_prensa: now }).eq('orden_id', ordenId);
        await supabase.from('ordenes').update({ estado: 'En prensa', asignado_prensa: null }).eq('id', ordenId);
        return { success: true };
    }
};