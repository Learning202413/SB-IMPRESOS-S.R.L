import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const productionDB = {
    // Obtener lista de OTs para la tabla de producción
    async getOTs() {
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
            .neq('estado', 'Nueva') // Ignorar cotizaciones que no son OTs aún
            .neq('estado', 'En Negociación')
            .order('fecha_creacion', { ascending: false });

        if (error) {
            console.error("Error cargando OTs:", error);
            return [];
        }

        // Helper para extraer datos de relaciones
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

            // Determinar quién tiene la tarea actualmente para mostrar en la tabla
            let currentAssignee = 'Sin Asignar';
            if (ot.estado.includes('Post') || ot.estado.includes('Acabado')) currentAssignee = post.name;
            else if (ot.estado.includes('Prensa') || ot.estado.includes('Imprimiendo')) currentAssignee = prensa.name;
            else if (ot.estado.includes('Diseño') || ot.estado.includes('Pre')) currentAssignee = pre.name;

            return {
                ...ot,
                cliente_nombre: ot.clientes?.razon_social || 'Sin Cliente',
                items: ot.orden_items || [],
                
                asignado_preprensa: pre.id,
                asignado_prensa: prensa.id,
                asignado_postprensa: post.id,

                asignado_nombre_preprensa: pre.name,
                asignado_nombre_prensa: prensa.name,
                asignado_nombre_postprensa: post.name,
                
                assigneeDisplay: currentAssignee || 'Sin Asignar'
            };
        });
    },

    // Asignar OT a un operario
    async assignOT(otId, userId, userName, newStatus) {
        const now = new Date().toISOString();
        
        // Actualización global
        let globalUpdates = { estado: newStatus, updated_at: now };
        let targetTable = null;
        let phaseData = { 
            orden_id: otId, 
            asignado_id: userId, 
            fecha_asignacion: now,
            estado_fase: newStatus 
        };

        // Determinar tabla destino según el estado
        if (newStatus.includes('Diseño') || newStatus === 'Diseño Pendiente') {
            targetTable = 'produccion_preprensa';
            phaseData.checklist = { "1": false, "2": false, "3": false, "4": false };
        } 
        else if (newStatus.includes('Prensa') || newStatus === 'Asignada a Prensa') {
             targetTable = 'produccion_prensa';
             phaseData.maquina_asignada = 'Offset-A'; // Default
        }
        else if (newStatus.includes('Post') || newStatus.includes('Acabados') || newStatus === 'Pendiente') {
             targetTable = 'produccion_postprensa';
             phaseData.estado_fase = 'Pendiente';
             phaseData.checklist = { paso1: false, paso2: false, paso3: false };
             // Si viene como "Pendiente" genérico para Post-Prensa, ajustamos el estado global visual
             if(newStatus === 'Pendiente') globalUpdates.estado = 'En Post-Prensa';
        }

        try {
            // 1. Actualizar estado global
            const { error: globalError } = await supabase.from('ordenes').update(globalUpdates).eq('id', otId);
            if (globalError) throw globalError;

            // 2. Actualizar tabla específica (UPSERT)
            if (targetTable) {
                if (userId) {
                    // Asignar
                    const { error: phaseError } = await supabase
                        .from(targetTable)
                        .upsert(phaseData, { onConflict: 'orden_id' });
                    if (phaseError) throw phaseError;
                } else {
                    // Desasignar (userId es null)
                    await supabase
                        .from(targetTable)
                        .update({ asignado_id: null, estado_fase: 'Pendiente' })
                        .eq('orden_id', otId);
                }
            }

            log('OT_ASIGNADA', `Orden ${otId} gestionada por Admin para ${userName || 'Nadie'} (${newStatus})`);
            return { success: true };

        } catch (error) {
            console.error("Error al asignar OT:", error);
            return { success: false, message: error.message };
        }
    },

    // Estadísticas rápidas para las tarjetas del Dashboard
    async getDashboardStats() {
        // Total histórico
        const { count: total } = await supabase.from('ordenes').select('*', { count: 'exact', head: true });
        
        // Pendientes (Todo lo que está en producción activa)
        const { count: pending } = await supabase
            .from('ordenes')
            .select('*', { count: 'exact', head: true })
            .not('estado', 'in', '("Nueva","En Negociación","Completado","Cancelada","Rechazada")');
            
        return { totalOTs: total || 0, pendingOTs: pending || 0 };
    },

    // Gráfico de Tendencias (Datos Reales)
    async getProductionTrend() {
        // Calcular fecha de hace 4 meses
        const today = new Date();
        const fourMonthsAgo = new Date();
        fourMonthsAgo.setMonth(today.getMonth() - 3);
        fourMonthsAgo.setDate(1); // Desde el primer día de ese mes

        // Consultar solo fechas
        const { data, error } = await supabase
            .from('ordenes')
            .select('fecha_creacion')
            .gte('fecha_creacion', fourMonthsAgo.toISOString())
            .order('fecha_creacion', { ascending: true });

        if (error) return [];

        // Inicializar acumuladores para los últimos 4 meses
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const stats = {};
        
        // Crear claves para los meses (asegura que aparezcan aunque tengan 0 ventas)
        for (let i = 3; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = monthNames[d.getMonth()];
            stats[key] = 0;
        }

        // Contar registros
        data.forEach(o => {
            const d = new Date(o.fecha_creacion);
            const key = monthNames[d.getMonth()];
            if (stats[key] !== undefined) stats[key]++;
        });

        // Formatear para el gráfico
        return Object.keys(stats).map(key => ({
            label: key,
            count: stats[key]
        }));
    }
};