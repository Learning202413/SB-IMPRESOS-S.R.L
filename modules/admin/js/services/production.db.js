import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const productionDB = {
    async getOTs() {
        // FIX: Hacemos JOIN con las tablas de cada fase para leer quién está asignado realmente
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *, 
                clientes (razon_social), 
                orden_items (producto),
                produccion_preprensa ( asignado_id ),
                produccion_prensa ( asignado_id ),
                produccion_postprensa ( asignado_id )
            `)
            .neq('estado', 'Nueva')
            .order('fecha_creacion', { ascending: false });

        if (error) return [];

        return data.map(ot => {
            // Extraer el ID del asignado desde el array de la relación (si existe)
            const preId = (ot.produccion_preprensa && ot.produccion_preprensa.length > 0) ? ot.produccion_preprensa[0].asignado_id : null;
            const prensaId = (ot.produccion_prensa && ot.produccion_prensa.length > 0) ? ot.produccion_prensa[0].asignado_id : null;
            const postId = (ot.produccion_postprensa && ot.produccion_postprensa.length > 0) ? ot.produccion_postprensa[0].asignado_id : null;

            return {
                ...ot,
                cliente_nombre: ot.clientes?.razon_social || 'Sin Cliente',
                items: ot.orden_items || [],
                
                // --- MAPEO CLAVE ---
                // Creamos estas propiedades virtuales para que el ProductionController
                // pueda verificar "if (!ot.asignado_preprensa)" correctamente.
                asignado_preprensa: preId,
                asignado_prensa: prensaId,
                asignado_postprensa: postId,

                // Textos para mostrar en la tabla de "En Proceso"
                asignado_nombre_preprensa: preId ? 'Asignado' : null, 
                asignado_nombre_prensa: prensaId ? 'Asignado' : null,
                asignado_nombre_postprensa: postId ? 'Asignado' : null
            };
        });
    },

    async assignOT(otId, userId, userName, newStatus) {
        const now = new Date().toISOString();
        
        // 1. Actualización Global (Solo estado y fecha, NO columnas asignado_*)
        let globalUpdates = { 
            estado: newStatus, 
            updated_at: now 
        };

        let targetTable = null;
        let phaseData = { 
            orden_id: otId, 
            asignado_id: userId, 
            fecha_asignacion: now,
            estado_fase: newStatus 
        };

        // Configurar tabla destino y datos según la fase
        if (newStatus.includes('Diseño') || newStatus === 'Diseño Pendiente') {
            targetTable = 'produccion_preprensa';
            phaseData.estado_fase = 'Diseño Pendiente';
            phaseData.checklist = { 1: false, 2: false, 3: false, 4: false };
        } 
        else if (newStatus.includes('Prensa') && !newStatus.includes('Pre') && !newStatus.includes('Post')) {
             targetTable = 'produccion_prensa';
             phaseData.estado_fase = 'Asignada a Prensa';
             phaseData.maquina_asignada = 'Offset-A';
        }
        else if (newStatus.includes('Post') || newStatus.includes('Acabados') || newStatus === 'Pendiente') {
             targetTable = 'produccion_postprensa';
             phaseData.estado_fase = 'Pendiente';
             phaseData.checklist = { paso1: false, paso2: false, paso3: false };
        }

        try {
            // A. Actualizar Estado en Ordenes
            const { error: globalError } = await supabase
                .from('ordenes')
                .update(globalUpdates)
                .eq('id', otId);

            if (globalError) throw globalError;

            // B. Crear o Actualizar en la Tabla de la Fase (Upsert lógico)
            if (targetTable && userId) {
                // Verificamos si ya existe el registro técnico
                const { data: existing } = await supabase
                    .from(targetTable)
                    .select('id')
                    .eq('orden_id', otId)
                    .maybeSingle();

                if (existing) {
                    await supabase.from(targetTable).update({ 
                        asignado_id: userId, 
                        fecha_asignacion: now,
                        estado_fase: phaseData.estado_fase
                    }).eq('id', existing.id);
                } else {
                    await supabase.from(targetTable).insert(phaseData);
                }
            } 
            // Caso especial: Desasignar (userId es null)
            else if (targetTable && !userId) {
                 await supabase.from(targetTable).update({ asignado_id: null, estado_fase: 'Pendiente' }).eq('orden_id', otId);
            }

            log('OT_ASIGNADA', `Orden ${otId} asignada a ${userName} (${newStatus})`);
            return { success: true };

        } catch (error) {
            console.error("Error al asignar OT:", error);
            return { success: false, message: error.message };
        }
    },

    async getDashboardStats() {
        const { count: total } = await supabase.from('ordenes').select('*', { count: 'exact', head: true });
        const { count: pending } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).in('estado', ['Orden creada', 'En proceso', 'Pendiente']);
        return { totalOTs: total || 0, pendingOTs: pending || 0 };
    },

    async getProductionTrend() {
        return [{ label: 'Ago', count: 80 }, { label: 'Sep', count: 100 }, { label: 'Oct', count: 95 }, { label: 'Nov', count: 120 }];
    }
};