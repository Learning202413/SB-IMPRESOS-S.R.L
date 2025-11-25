import supabase from '../../../../core/http/supabase.client.js';

export const HistorialOrdenService = {

    async getTraceabilityData(query) {
        // 1. Construir consulta inteligente
        let queryBuilder = supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social, ruc_dni ), 
                produccion_preprensa ( asignado_id ),
                produccion_prensa ( asignado_id ),
                produccion_postprensa ( asignado_id )
            `);

        // Detectar si el input es un UUID válido (formato interno de base de datos)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

        if (isUUID) {
            queryBuilder = queryBuilder.eq('id', query);
        } else {
            // Si no es UUID, buscar por OT_ID o Código visual
            queryBuilder = queryBuilder.or(`ot_id.eq.${query},codigo.eq.${query}`);
        }

        const { data: ot, error } = await queryBuilder.maybeSingle();

        if (error || !ot) return null;

        // 2. Buscar Logs relacionados (por texto en 'details')
        // Usamos el código visual (OT-XXXX) como clave de búsqueda en los logs de texto
        const searchKey = ot.ot_id || ot.codigo;
        
        const { data: logs } = await supabase
            .from('audit_logs')
            .select('*')
            .ilike('details', `%${searchKey}%`)
            .order('created_at', { ascending: true });

        // 3. Construir línea de tiempo visual
        const events = this.buildTimelineEvents(ot, logs || []);
        
        // Preparar objeto para la vista
        const otView = {
            ...ot,
            cliente_nombre: ot.clientes?.razon_social,
            cliente_doc: ot.clientes?.ruc_dni, // Dato crítico para la UI
            ot_id: ot.ot_id || ot.codigo
        };

        return { ot: otView, events };
    },

    buildTimelineEvents(ot, logs) {
        const events = [];

        const addEvent = (title, user, dateIso, icon, color, details = null) => {
            if (dateIso) {
                events.push({
                    title,
                    user: user || 'Sistema',
                    time: new Date(dateIso).toLocaleString('es-PE'),
                    rawTime: new Date(dateIso),
                    icon,
                    color,
                    details
                });
            }
        };

        // --- Eventos de Fechas Registradas en la Orden ---
        addEvent('ORDEN CREADA (CRM)', 'Ventas', ot.fecha_creacion, 'file-plus', 'blue');

        // Pre-Prensa
        addEvent('EN DISEÑO', 'Diseñador', ot.fecha_inicio_diseno, 'monitor', 'indigo');
        addEvent('ENVIADO A APROBACIÓN', 'Diseñador', ot.fecha_envio_aprobacion, 'send', 'yellow');
        addEvent('PASE A PRENSA', 'Pre-Prensa', ot.fecha_pase_prensa, 'check-circle-2', 'green');

        // Prensa
        addEvent('PREPARACIÓN MÁQUINA', 'Maquinista', ot.fecha_inicio_prep, 'settings-2', 'purple');
        addEvent('IMPRESIÓN INICIADA', 'Maquinista', ot.fecha_inicio_impresion, 'loader-2', 'purple');
        addEvent('FIN IMPRESIÓN', 'Maquinista', ot.fecha_fin_prensa, 'layers', 'purple', 
            (ot.consumo_papel ? `Consumo: ${ot.consumo_papel} pliegos` : null));

        // Post-Prensa
        addEvent('EN ACABADOS', 'Operador', ot.fecha_inicio_acabados, 'hammer', 'orange');
        addEvent('CONTROL DE CALIDAD', 'Control Calidad', ot.fecha_inicio_calidad, 'shield-check', 'teal');
        addEvent('PROCESO COMPLETADO', 'Planta', ot.fecha_fin_proceso, 'package-check', 'green');

        // --- Eventos de Logs de Auditoría ---
        logs.forEach(l => {
            if (l.action === 'OT_ASIGNADA') {
                addEvent('TAREA ASIGNADA', l.user_email, l.created_at, 'user-plus', 'gray', l.details);
            }
            if (l.action.includes('TOMADA')) {
                addEvent('TAREA TOMADA', l.user_email, l.created_at, 'hand', 'gray', l.details);
            }
            if (l.action === 'FACTURA_GENERADA') {
                addEvent('FACTURACIÓN', l.user_email, l.created_at, 'receipt', 'gray', l.details);
            }
            if (l.action.includes('INCIDENCIA')) {
                addEvent('INCIDENCIA REPORTADA', l.user_email, l.created_at, 'alert-triangle', 'red', l.details);
            }
        });

        return events.sort((a, b) => a.rawTime - b.rawTime);
    }
};