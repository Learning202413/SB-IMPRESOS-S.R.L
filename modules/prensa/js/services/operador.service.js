/**
 * js/services/operador.service.js (Prensa)
 * Lógica del terminal: Tiempos, Incidencias y Finalización.
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

        // Formatear horas para la vista
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
        const now = new Date().toISOString();
        await supabase.from('produccion_prensa').update({ 
            estado_fase: 'En Preparación', fecha_inicio_prep: now 
        }).eq('orden_id', ordenId);
        
        await supabase.from('ordenes').update({ estado: 'En Preparación' }).eq('id', ordenId);
    },

    async startPrinting(ordenId) {
        const now = new Date().toISOString();
        await supabase.from('produccion_prensa').update({ 
            estado_fase: 'Imprimiendo', fecha_inicio_impresion: now 
        }).eq('orden_id', ordenId);

        await supabase.from('ordenes').update({ estado: 'Imprimiendo' }).eq('id', ordenId);
    },

    async reportIncident(ordenId, details, type) {
        const user = getCurrentUser();
        await supabase.from('incidencias').insert({
            orden_id: ordenId,
            tipo: type,
            detalle: details,
            reportado_por: user.id,
            fecha_reporte: new Date().toISOString()
        });
        log('INCIDENCIA_PRENSA', `${type}: ${details}`);
    },

    async finishJob(ordenId, consumo, desperdicio) {
        const now = new Date().toISOString();
        
        // 1. Guardar métricas en Fase Prensa y marcar completado
        await supabase
            .from('produccion_prensa')
            .update({ 
                estado_fase: 'Completado',
                fecha_fin_prensa: now,
                consumo_papel: parseInt(consumo),
                desperdicio_papel: parseInt(desperdicio)
            })
            .eq('orden_id', ordenId);

        // 2. Mover la orden global a la siguiente cola: 'En Post-Prensa'
        // Se quita la asignación de prensa y post-prensa para que entre a la cola general de acabados
        await supabase
            .from('ordenes')
            .update({ 
                estado: 'En Post-Prensa',
                asignado_postprensa: null 
            })
            .eq('id', ordenId);

        log('FIN_IMPRESION', `Orden ${ordenId} enviada a Post-Prensa.`);
    }
};