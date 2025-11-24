import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const productionDB = {
    async getOTs() {
        // 1. Hacemos la consulta incluyendo el perfil para ver el nombre
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *, 
                clientes (razon_social), 
                orden_items (producto),
                produccion_preprensa ( asignado_id, profiles(full_name) ),
                produccion_prensa ( asignado_id, profiles(full_name) ),
                produccion_postprensa ( asignado_id, profiles(full_name) )
            `)
            .neq('estado', 'Nueva')
            .order('fecha_creacion', { ascending: false });

        if (error) return [];

        // Función auxiliar para extraer datos de Objeto o Array
        const extractData = (relationData) => {
            // Si es nulo/undefined
            if (!relationData) return { id: null, name: null };
            
            // Si es un Array (Caso 1:N)
            if (Array.isArray(relationData)) {
                if (relationData.length === 0) return { id: null, name: null };
                return {
                    id: relationData[0].asignado_id,
                    name: relationData[0].profiles?.full_name
                };
            }
            
            // Si es un Objeto (Caso 1:1 - TU CASO ACTUAL)
            return {
                id: relationData.asignado_id,
                name: relationData.profiles?.full_name
            };
        };

        return data.map(ot => {
            // Extraemos datos usando la función inteligente
            const pre = extractData(ot.produccion_preprensa);
            const prensa = extractData(ot.produccion_prensa);
            const post = extractData(ot.produccion_postprensa);

            return {
                ...ot,
                cliente_nombre: ot.clientes?.razon_social || 'Sin Cliente',
                items: ot.orden_items || [],
                
                // MAPEO CORREGIDO:
                asignado_preprensa: pre.id,
                asignado_prensa: prensa.id,
                asignado_postprensa: post.id,

                // Nombres visuales
                asignado_nombre_preprensa: pre.name || (pre.id ? 'Asignado' : null), 
                asignado_nombre_prensa: prensa.name || (prensa.id ? 'Asignado' : null),
                asignado_nombre_postprensa: post.name || (post.id ? 'Asignado' : null)
            };
        });
    },

    async assignOT(otId, userId, userName, newStatus) {
        const now = new Date().toISOString();
        
        let globalUpdates = { estado: newStatus, updated_at: now };
        let targetTable = null;
        let phaseData = { 
            orden_id: otId, 
            asignado_id: userId, 
            fecha_asignacion: now,
            estado_fase: newStatus 
        };

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
            // 1. Actualizar Global
            const { error: globalError } = await supabase.from('ordenes').update(globalUpdates).eq('id', otId);
            if (globalError) throw globalError;

            // 2. Actualizar Fase (Upsert)
            if (targetTable && userId) {
                const { error: phaseError } = await supabase
                    .from(targetTable)
                    .upsert(phaseData, { onConflict: 'orden_id' });
                 if (phaseError) throw phaseError;
            } 
            else if (targetTable && !userId) { // Desasignar
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