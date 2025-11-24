/**
 * js/services/historial.orden.service.js
 * Servicio para la trazabilidad de OT (Supabase).
 * Reconstruye la historia uniendo datos de la Orden y de Audit Logs.
 */
import supabase from '../../../../core/http/supabase.client.js';

export const HistorialOrdenService = {

    async getTraceabilityData(query) {
        // 1. Buscar la Orden (por UUID o por OT_ID/Código)
        const { data: ot, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                produccion_preprensa ( asignado_id ),
                produccion_prensa ( asignado_id ),
                produccion_postprensa ( asignado_id )
            `)
            .or(`id.eq.${query},ot_id.eq.${query},codigo.eq.${query}`)
            .maybeSingle();

        if (error || !ot) return null;

        // 2. Buscar Logs relacionados a esta Orden (usando filtro de texto en 'details')
        // Nota: Buscamos por el ID de la orden o por su código visual
        const searchKey = ot.ot_id || ot.codigo;
        
        const { data: logs } = await supabase
            .from('audit_logs')
            .select('*')
            .ilike('details', `%${searchKey}%`)
            .order('created_at', { ascending: true });

        // 3. Construir la línea de tiempo
        const events = this.buildTimelineEvents(ot, logs || []);
        
        // Adaptar objeto OT para la vista
        const otView = {
            ...ot,
            cliente_nombre: ot.clientes?.razon_social,
            // Si ot_id es null, usamos el codigo
            ot_id: ot.ot_id || ot.codigo
        };

        return { ot: otView, events };
    },

    buildTimelineEvents(ot, logs) {
        const events = [];

        // Helper para agregar eventos
        const addEvent = (title, user, dateIso, icon, color, details = null) => {
            if (dateIso) {
                events.push({
                    title,
                    user: user || 'Sistema',
                    time: new Date(dateIso).toLocaleString('es-PE'),
                    rawTime: new Date(dateIso), // Para ordenar si fuera necesario
                    icon,
                    color,
                    details
                });
            }
        };

        // --- A. Eventos Fijos (Fechas registradas en la Orden) ---
        
        // 1. Creación
        addEvent('ORDEN CREADA (CRM)', 'Ventas', ot.fecha_creacion, 'file-plus', 'blue');

        // 2. Pre-Prensa
        addEvent('EN DISEÑO', 'Diseñador', ot.fecha_inicio_diseno, 'monitor', 'indigo');
        addEvent('ENVIADO A APROBACIÓN', 'Diseñador', ot.fecha_envio_aprobacion, 'send', 'yellow');
        addEvent('PASE A PRENSA', 'Pre-Prensa', ot.fecha_pase_prensa, 'check-circle-2', 'green');

        // 3. Prensa
        addEvent('PREPARACIÓN MÁQUINA', 'Maquinista', ot.fecha_inicio_prep, 'settings-2', 'purple');
        addEvent('IMPRESIÓN INICIADA', 'Maquinista', ot.fecha_inicio_impresion, 'loader-2', 'purple');
        addEvent('FIN IMPRESIÓN', 'Maquinista', ot.fecha_fin_prensa, 'layers', 'purple', 
            (ot.consumo_papel ? `Consumo: ${ot.consumo_papel} pliegos` : null));

        // 4. Post-Prensa
        addEvent('EN ACABADOS', 'Operador', ot.fecha_inicio_acabados, 'hammer', 'orange');
        addEvent('CONTROL DE CALIDAD', 'Control Calidad', ot.fecha_inicio_calidad, 'shield-check', 'teal');
        addEvent('PROCESO COMPLETADO', 'Planta', ot.fecha_fin_proceso, 'package-check', 'green');

        // --- B. Eventos Dinámicos (Desde los Logs) ---
        // Agregamos logs importantes que no tienen fecha en la tabla principal (ej. Asignaciones)
        
        logs.forEach(l => {
            // Evitar duplicados si la fecha es idéntica a una fase principal (opcional)
            // Aquí mapeamos acciones específicas del log a eventos visuales
            
            if (l.action === 'OT_ASIGNADA') {
                addEvent('TAREA ASIGNADA', l.user_email, l.created_at, 'user-plus', 'gray', l.details);
            }
            if (l.action === 'TAREA_TOMADA' || l.action.includes('TOMADA')) {
                addEvent('TAREA TOMADA POR OPERADOR', l.user_email, l.created_at, 'hand', 'gray', l.details);
            }
            if (l.action === 'FACTURA_GENERADA') {
                addEvent('FACTURACIÓN', l.user_email, l.created_at, 'receipt', 'gray', l.details);
            }
            if (l.action.includes('INCIDENCIA')) {
                addEvent('INCIDENCIA REPORTADA', l.user_email, l.created_at, 'alert-triangle', 'red', l.details);
            }
        });

        // Ordenar cronológicamente
        return events.sort((a, b) => a.rawTime - b.rawTime);
    }
};