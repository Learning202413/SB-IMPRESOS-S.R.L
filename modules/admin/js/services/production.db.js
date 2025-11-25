import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const productionDB = {
    async getOTs() {
        // Consulta incluyendo perfiles para ver nombres de asignados
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

        // Helper para extraer datos de relaciones 1:1 (Supabase a veces devuelve array o objeto)
        const extractData = (relationData) => {
            if (!relationData) return { id: null, name: null };
            if (Array.isArray(relationData)) {
                if (relationData.length === 0) return { id: null, name: null };
                return { id: relationData[0].asignado_id, name: relationData[0].profiles?.full_name };
            }
            return { id: relationData.asignado_id, name: relationData.profiles?.full_name };
        };

        return data.map(ot => {
            const pre = extractData(ot.produccion_preprensa);
            const prensa = extractData(ot.produccion_prensa);
            const post = extractData(ot.produccion_postprensa);

            return {
                ...ot,
                cliente_nombre: ot.clientes?.razon_social || 'Sin Cliente',
                items: ot.orden_items || [],
                
                asignado_preprensa: pre.id,
                asignado_prensa: prensa.id,
                asignado_postprensa: post.id,

                asignado_nombre_preprensa: pre.name || (pre.id ? 'Asignado' : null), 
                asignado_nombre_prensa: prensa.name || (prensa.id ? 'Asignado' : null),
                asignado_nombre_postprensa: post.name || (post.id ? 'Asignado' : null)
            };
        });
    },

    // --- LÓGICA CORREGIDA Y ESTANDARIZADA ---
    async assignOT(otId, userId, userName, newStatus) {
        const now = new Date().toISOString();
        
        // 1. Preparar actualización global
        let globalUpdates = { estado: newStatus, updated_at: now };
        
        // 2. Determinar tabla objetivo y datos específicos de la fase
        let targetTable = null;
        let phaseData = { 
            orden_id: otId, 
            asignado_id: userId, 
            fecha_asignacion: now,
            estado_fase: newStatus // Estado inicial de la fase
        };

        // Lógica condicional basada en el rol/estado
        // A. PRE-PRENSA (Diseño)
        if (newStatus.includes('Diseño') || newStatus === 'Diseño Pendiente') {
            targetTable = 'produccion_preprensa';
            phaseData.checklist = { "1": false, "2": false, "3": false, "4": false }; // Inicializar checklist
        } 
        // B. PRENSA (Impresión)
        else if (newStatus.includes('Prensa') || newStatus === 'Asignada a Prensa') {
             targetTable = 'produccion_prensa';
             // Prensa no tiene checklist JSONB complejo, pero sí máquina
             phaseData.maquina_asignada = 'Offset-A'; // Default o seleccionar en UI futura
        }
        // C. POST-PRENSA (Acabados)
        else if (newStatus.includes('Post') || newStatus.includes('Acabados') || newStatus === 'Pendiente') {
             targetTable = 'produccion_postprensa';
             phaseData.estado_fase = 'Pendiente'; // Forzar estado inicial
             phaseData.checklist = { paso1: false, paso2: false, paso3: false }; // Inicializar checklist
             
             // Ajuste visual para el estado global si viene como 'Pendiente' genérico
             if(newStatus === 'Pendiente') globalUpdates.estado = 'En Post-Prensa';
        }

        try {
            // 1. Actualizar Estado Global en 'ordenes'
            const { error: globalError } = await supabase.from('ordenes').update(globalUpdates).eq('id', otId);
            if (globalError) throw globalError;

            // 2. Actualizar o Crear Registro en la Tabla de la Fase (UPSERT)
            if (targetTable && userId) {
                // onConflict: 'orden_id' asegura que si ya existe, se actualice; si no, se inserta.
                const { error: phaseError } = await supabase
                    .from(targetTable)
                    .upsert(phaseData, { onConflict: 'orden_id' });
                 
                 if (phaseError) throw phaseError;
            } 
            // 3. Caso Desasignar (Eliminar asignación)
            else if (targetTable && !userId) { 
                 await supabase.from(targetTable)
                    .update({ asignado_id: null, estado_fase: 'Pendiente' })
                    .eq('orden_id', otId);
            }

            log('OT_ASIGNADA', `Orden ${otId} gestionada por Admin para ${userName || 'Nadie'} (${newStatus})`);
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
        // Mock data para gráfico
        return [{ label: 'Ago', count: 80 }, { label: 'Sep', count: 100 }, { label: 'Oct', count: 95 }, { label: 'Nov', count: 120 }];
    }
};
