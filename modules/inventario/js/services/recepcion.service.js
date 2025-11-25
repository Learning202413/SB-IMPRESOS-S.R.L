/**
 * js/services/recepcion.service.js
 * Servicio de Recepción de Mercancía (Supabase).
 * CORREGIDO: Detección de UUID vs Código para evitar errores de tipo.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from '../../../admin/js/services/local.db.js';
// Asegúrate de que la ruta a providers.db.js sea correcta según tu estructura
// Si providers.db.js no se usa aquí directamente, puedes omitir su importación si no es necesaria para otra lógica
// import { providersDB } from '../../../admin/js/services/providers.db.js'; 

export const RecepcionService = {
    
    async getPendingOCs() {
        // Obtenemos OCs con sus proveedores
        const { data, error } = await supabase
            .from('compras_ordenes')
            .select(`
                *,
                proveedores ( name )
            `)
            .neq('estado', 'Cancelada')
            .order('fecha_emision', { ascending: false });

        if (error) return [];

        // Mapeo para la vista
        return data.map(oc => ({
            id: oc.codigo, // Usamos el código visible (OC-2025-...) como ID visual
            uuid: oc.id,   // Guardamos el UUID real para operaciones
            proveedor_nombre: oc.proveedores?.name || 'Desconocido',
            fecha: new Date(oc.fecha_emision).toLocaleDateString(),
            estado: oc.estado,
            fecha_recepcion: oc.fecha_recepcion ? new Date(oc.fecha_recepcion).toLocaleDateString() : null
        }));
    },

    async getOCById(codigoOrId) {
        // FIX: Validar si es UUID para evitar error de sintaxis en Postgres
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigoOrId);
        
        let query = supabase
            .from('compras_ordenes')
            .select(`
                *,
                proveedores ( name, tax_id, address, email ),
                compras_items ( producto_nombre, cantidad, precio_pactado )
            `);

        // Aplicar el filtro correcto según el formato
        if (isUuid) {
            query = query.eq('id', codigoOrId);
        } else {
            query = query.eq('codigo', codigoOrId);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
            console.error("Error al obtener OC:", error);
            return null;
        }

        return {
            id: data.codigo,
            uuid: data.id,
            proveedor_nombre: data.proveedores?.name,
            proveedor_id: data.proveedor_id,
            // Datos extra para el PDF
            proveedor_doc: data.proveedores?.tax_id,
            proveedor_direccion: data.proveedores?.address,
            proveedor_email: data.proveedores?.email,
            
            fecha: new Date(data.fecha_emision).toLocaleDateString(),
            total: data.total,
            items: data.compras_items.map(i => ({
                producto: i.producto_nombre,
                cantidad: i.cantidad,
                precio: i.precio_pactado
            }))
        };
    },

    async getOCForPDF(ocId) {
        // Reutilizamos getOCById ya que ahora trae todo lo necesario con los JOINs
        const oc = await this.getOCById(ocId);
        
        if (!oc) return { success: false, message: 'Orden no encontrada' };

        // Cálculos para el PDF
        const total = parseFloat(oc.total) || 0;
        const subtotal = total / 1.18;
        const igv = total - subtotal;

        return {
            success: true,
            data: {
                numero: oc.id, // El código (OC-2025-...)
                fecha_emision: oc.fecha,
                proveedor_nombre: oc.proveedor_nombre,
                proveedor_doc: oc.proveedor_doc || '---',
                proveedor_direccion: oc.proveedor_direccion || '---',
                subtotal: subtotal.toFixed(2),
                igv: igv.toFixed(2),
                total: total.toFixed(2),
                items: oc.items
            }
        };
    },

    /**
     * Procesa la recepción: Actualiza estado de OC y aumenta Stock.
     */
    async receiveOC(ocCodigo, itemsReceived, comentarios) {
        // 1. Obtener la OC real por código para tener su UUID
        const { data: oc } = await supabase
            .from('compras_ordenes')
            .select('id')
            .eq('codigo', ocCodigo)
            .single();
            
        if (!oc) return { success: false, message: "OC no encontrada" };

        // 2. Actualizar Stock (Uno por uno)
        for (const item of itemsReceived) {
            // Buscamos el producto por nombre
            const { data: prod } = await supabase
                .from('inventario')
                .select('sku, stock_actual')
                .ilike('nombre', item.producto.trim())
                .maybeSingle();

            if (prod) {
                const nuevoStock = (prod.stock_actual || 0) + parseInt(item.cantidad);
                await supabase
                    .from('inventario')
                    .update({ stock_actual: nuevoStock })
                    .eq('sku', prod.sku);
            }
        }

        // 3. Actualizar Estado de la OC
        await supabase
            .from('compras_ordenes')
            .update({
                estado: 'Recibida (Completa)',
                fecha_recepcion: new Date().toISOString(),
                comentarios_recepcion: comentarios
            })
            .eq('id', oc.id);

        log('RECEPCION_COMPRA', `OC ${ocCodigo} recibida. Stock actualizado.`);
        return { success: true };
    }
};