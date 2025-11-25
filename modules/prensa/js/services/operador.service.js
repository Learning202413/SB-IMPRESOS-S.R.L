
/**
 * js/services/operador.service.js (Prensa)
 * ACTUALIZADO: Usa UPSERT para todas las acciones para garantizar el guardado.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

const getCurrentUser = () => {
    const session = localStorage.getItem('erp_session');
    return session ? JSON.parse(session) : { id: null };
};

export const OperadorService = {
    async getTaskById(ordenId) {
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                orden_items ( producto, especificaciones ),
                produccion_prensa ( * )
            `)
            .eq('id', ordenId)
            .single();

        if (error || !data) return null;

        const fase = (data.produccion_prensa && data.produccion_prensa[0]) 
            ? data.produccion_prensa[0] 
            : { estado_fase: 'Desconocido' };

        const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-PE') : null;

        return {
            id: data.id,
            ot_id: data.ot_id || data.codigo,
            cliente: data.clientes?.razon_social,
            producto: (data.orden_items && data.orden_items[0]) ? data.orden_items[0].producto : 'Varios',
            paper: (data.orden_items && data.orden_items[0]) ? data.orden_items[0].especificaciones : 'N/A',
            estado_prensa: data.estado,
            tiempos: {
                prep: fmtTime(fase.fecha_inicio_prep),
                print: fmtTime(fase.fecha_inicio_impresion)
            }
        };
    },

    async startPreparation(ordenId) {
        const user = getCurrentUser();
        const now = new Date().toISOString();
        
        // USAMOS UPSERT: Si la fila no existe (asignación fallida), la crea ahora.
        const { error } = await supabase.from('produccion_prensa')
            .upsert({ 
                orden_id: ordenId,
                asignado_id: user.id, // Aseguramos la asignación
                estado_fase: 'En Preparación', 
                fecha_inicio_prep: now,
                fecha_asignacion: now // Por si es registro nuevo
            }, { onConflict: 'orden_id' });
        
        if (error) return { success: false, message: error.message };

        // Sincronizamos estado global
        await supabase.from('ordenes').update({ estado: 'En Preparación' }).eq('id', ordenId);
        
        return { success: true };
    },

    async startPrinting(ordenId) {
        const user = getCurrentUser();
        const now = new Date().toISOString();

        // USAMOS UPSERT
        const { error } = await supabase.from('produccion_prensa')
            .upsert({ 
                orden_id: ordenId,
                asignado_id: user.id,
                estado_fase: 'Imprimiendo', 
                fecha_inicio_impresion: now 
            }, { onConflict: 'orden_id' });

        if (error) return { success: false, message: error.message };

        await supabase.from('ordenes').update({ estado: 'Imprimiendo' }).eq('id', ordenId);
        
        return { success: true };
    },

    async reportIncident(ordenId, details, type) {
        const user = getCurrentUser();
        const { error } = await supabase.from('incidencias').insert({
            orden_id: ordenId,
            tipo: type,
            detalle: details,
            reportado_por: user.id,
            fecha_reporte: new Date().toISOString()
        });
        
        if (!error) log('INCIDENCIA_PRENSA', `${type}: ${details}`);
        return { success: !error };
    },

    async finishJob(ordenId, consumo, desperdicio) {
        const now = new Date().toISOString();
        const user = getCurrentUser();
        
        // 1. CERRAR PRENSA (Upsert por seguridad)
        const { error: errPrensa } = await supabase
            .from('produccion_prensa')
            .upsert({ 
                orden_id: ordenId,
                asignado_id: user.id,
                estado_fase: 'Completado',
                fecha_fin_prensa: now,
                consumo_papel: parseInt(consumo),
                desperdicio_papel: parseInt(desperdicio)
            }, { onConflict: 'orden_id' });

        if (errPrensa) return { success: false, message: "Error DB Prensa: " + errPrensa.message };

        // 2. INICIALIZAR POST-PRENSA
        const { error: errPost } = await supabase
            .from('produccion_postprensa')
            .upsert({ 
                orden_id: ordenId,
                estado_fase: 'Pendiente', 
                checklist: { paso1: false, paso2: false, paso3: false },
                asignado_id: null,
                fecha_asignacion: now
            }, { onConflict: 'orden_id' });

        if (errPost) return { success: false, message: "Error iniciando Acabados" };

        // 3. ACTUALIZAR GLOBAL
        await supabase.from('ordenes').update({ estado: 'En Post-Prensa' }).eq('id', ordenId);

        log('FIN_IMPRESION', `Orden ${ordenId} finalizada en prensa.`);
        return { success: true };
    }
};
