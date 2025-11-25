/**
 * js/services/facturacion.service.js
 * Gestión de documentos fiscales en Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const FacturacionService = {
    
    async getAllDocuments() {
        const { data, error } = await supabase
            .from('facturas')
            .select(`
                *,
                ordenes ( ot_id, codigo )
            `)
            .order('fecha_emision', { ascending: false });

        if (error) return [];

        // Mapeo visual
        return data.map(d => ({
            id: d.id,
            numero: d.numero,
            tipo: d.tipo,
            cliente_nombre: d.cliente_nombre,
            cliente_doc: d.cliente_doc,
            cliente_email: d.cliente_email,
            cliente_direccion: d.cliente_direccion,
            // Mostrar OT si existe, sino el código de cotización
            ot_id: d.ordenes?.ot_id && d.ordenes.ot_id !== 'PENDIENTE' ? d.ordenes.ot_id : (d.ordenes?.codigo || '-'),
            total: d.total,
            subtotal: d.subtotal,
            igv: d.igv,
            fecha_emision: new Date(d.fecha_emision).toLocaleDateString() + ' ' + new Date(d.fecha_emision).toLocaleTimeString()
        }));
    },

    async generateDocumentFromOT(ordenId, tipoDoc) {
        // 1. Obtener datos de la Orden y Cliente
        const { data: orden, error } = await supabase
            .from('ordenes')
            .select(`*, clientes (*)`)
            .eq('id', ordenId)
            .single();

        if (error || !orden) return { success: false, message: 'Orden no encontrada' };

        // 2. Verificar duplicados
        const { count } = await supabase
            .from('facturas')
            .select('*', { count: 'exact', head: true })
            .eq('orden_id', ordenId);

        if (count > 0) return { success: false, message: 'Esta orden ya fue facturada.' };

        // 3. Generar Correlativo
        const { count: existingCount } = await supabase
            .from('facturas')
            .select('*', { count: 'exact', head: true })
            .eq('tipo', tipoDoc);
            
        const prefix = tipoDoc === 'FACTURA' ? 'F001' : 'B001';
        const number = `${prefix}-${String((existingCount || 0) + 1).padStart(6, '0')}`;

        // 4. Preparar Datos del Cliente (Snapshot)
        const cli = orden.clientes;
        const fullAddress = [cli.direccion, cli.distrito, cli.provincia].filter(Boolean).join(' - ').toUpperCase();

        // 5. Cálculos
        const total = parseFloat(orden.total || 0);
        const subtotal = total / 1.18;
        const igv = total - subtotal;

        // 6. Insertar Factura
        const { error: insertError } = await supabase.from('facturas').insert({
            orden_id: ordenId,
            tipo: tipoDoc,
            numero: number,
            cliente_nombre: cli.razon_social,
            cliente_doc: cli.ruc_dni,
            cliente_direccion: fullAddress,
            cliente_email: cli.email,
            subtotal: subtotal,
            igv: igv,
            total: total,
            fecha_emision: new Date().toISOString()
        });

        if (insertError) return { success: false, message: insertError.message };

        // 7. Actualizar estado en Orden
        await supabase.from('ordenes').update({ estado_facturacion: 'Facturado' }).eq('id', ordenId);

        log('FACTURA_GENERADA', `Doc: ${number} para Orden: ${orden.ot_id || orden.codigo}`);
        return { success: true, message: `Documento ${number} generado.` };
    }
};