/**
 * js/services/detalle.service.js
 * Servicio Ajustado para manejar Archivos y Comentarios (Feedback Cliente)
 */
import supabase from '../../../../core/http/supabase.client.js';

export const DetalleService = {
    
    // Obtener la tarea y datos generales
    async getTaskById(ordenId) {
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

        // Obtener datos de la Fase (Pre-Prensa)
        const { data: fase, error: errorFase } = await supabase
            .from('produccion_preprensa')
            .select('*')
            .eq('orden_id', ordenId)
            .maybeSingle();

        // Combinar datos
        return {
            ...orden,
            cliente: orden.clientes?.razon_social,
            producto: orden.orden_items?.[0]?.producto,
            specs: orden.orden_items?.[0]?.especificaciones,
            fase_id: fase?.id,
            checklist: fase?.checklist || {},
            estado_fase: fase?.estado_fase
        };
    },

    // NUEVO: Obtener archivos (Tanto del Cliente como del Diseñador)
    async getArchivos(ordenId) {
        const { data, error } = await supabase
            .from('orden_archivos')
            .select('*')
            .eq('orden_id', ordenId)
            .order('created_at', { ascending: false });
            
        if (error) console.error("Error cargando archivos:", error);
        return data || [];
    },

    // NUEVO: Obtener historial de chat (Comentarios del Cliente)
    async getHistorialChat(ordenId) {
        const { data, error } = await supabase
            .from('orden_comentarios')
            .select('*')
            .eq('orden_id', ordenId)
            .order('created_at', { ascending: true });

        if (error) console.error("Error cargando chat:", error);
        return data || [];
    },

    // NUEVO: Subir Prueba de Diseño y Solicitar Aprobación
    async subirPruebaYEnvar(ordenId, file) {
        try {
            // 1. Subir PDF al Storage
            const fileName = `${ordenId}/PRUEBA_${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('ordenes-files')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('ordenes-files')
                .getPublicUrl(fileName);

            // 2. Registrar en Base de Datos (orden_archivos)
            const { error: dbError } = await supabase
                .from('orden_archivos')
                .insert({
                    orden_id: ordenId,
                    tipo_emisor: 'DISENADOR', // Importante para que el cliente sepa que es la prueba
                    nombre_archivo: file.name,
                    url_archivo: urlData.publicUrl,
                    version: 1 // Podrías calcular la versión si quisieras
                });

            if (dbError) throw dbError;

            // 3. Actualizar Estado Global para avisar al cliente
            await supabase
                .from('ordenes')
                .update({ estado: 'En Aprobación de Cliente' })
                .eq('id', ordenId);

            // 4. Marcar en el checklist interno que ya se envió
            // (Asumimos que el paso 3 es "Aprobación")
            await this.updateChecklist(ordenId, 3, true);

            return { success: true };

        } catch (error) {
            console.error("Error subiendo prueba:", error);
            return { success: false, message: error.message };
        }
    },

    // Actualizar checklist (Pasos 1, 2, 4)
    async updateChecklist(ordenId, stepIndex, isChecked) {
        // Primero obtenemos el checklist actual
        const { data: fase } = await supabase
            .from('produccion_preprensa')
            .select('checklist')
            .eq('orden_id', ordenId)
            .single();

        const newChecklist = fase?.checklist || {};
        newChecklist[`step_${stepIndex}`] = isChecked;

        const { error } = await supabase
            .from('produccion_preprensa')
            .update({ checklist: newChecklist })
            .eq('orden_id', ordenId);

        return { success: !error, error };
    },

    // Finalizar fase y pasar a Prensa
    async completeTask(ordenId) {
        const now = new Date().toISOString();
        
        // 1. Cerrar Pre-Prensa
        await supabase
            .from('produccion_preprensa')
            .update({ estado_fase: 'Completado', fecha_pase_prensa: now })
            .eq('orden_id', ordenId);

        // 2. Crear registro en Prensa
        await supabase
            .from('produccion_prensa')
            .upsert({ 
                orden_id: ordenId,
                estado_fase: 'Pendiente',
                asignado_id: null,
                fecha_asignacion: now
            }, { onConflict: 'orden_id' });

        // 3. Actualizar Orden
        await supabase
            .from('ordenes')
            .update({ estado: 'En prensa' }) 
            .eq('id', ordenId);

        return { success: true };
    }
};