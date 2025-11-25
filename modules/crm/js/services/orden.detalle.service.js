/**
 * js/services/orden.detalle.service.js
 * Gestión de creación/edición de Órdenes y Cotizaciones en Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const OrdenDetalleService = {
    
    async getOrderById(id) {
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( id, razon_social, ruc_dni ),
                orden_items ( * )
            `)
            .eq('id', id)
            .single();

        if (error || !data) return null;

        // Adaptador para el controlador
        return {
            ...data,
            cliente_nombre: data.clientes?.razon_social,
            cliente_ruc: data.clientes?.ruc_dni, // Útil si se necesitara
            items: data.orden_items.map(i => ({
                ...i,
                precio: i.precio_unitario, // Adaptador precio_unitario -> precio
                specs: i.especificaciones  // Adaptador especificaciones -> specs
            }))
        };
    },

    async createOrder(orderData) {
        try {
            // 1. Generar Código Único
            const timestampCode = Date.now().toString(36).toUpperCase().slice(-6);
            const newCode = `COT-${timestampCode}`;

            // 2. Insertar Cabecera
            const { data: newOrder, error: orderError } = await supabase
                .from('ordenes')
                .insert({
                    codigo: newCode,
                    ot_id: 'PENDIENTE',
                    cliente_id: orderData.cliente_id,
                    estado: 'En Negociación',
                    total: orderData.total,
                    notas: orderData.notas,
                    fecha_creacion: new Date().toISOString()
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Insertar Ítems
            if (orderData.items && orderData.items.length > 0) {
                const itemsToInsert = orderData.items.map(i => ({
                    orden_id: newOrder.id,
                    producto: i.producto,
                    cantidad: i.cantidad,
                    especificaciones: i.specs,
                    precio_unitario: i.precio,
                    subtotal: i.subtotal
                }));

                const { error: itemsError } = await supabase
                    .from('orden_items')
                    .insert(itemsToInsert);
                
                if (itemsError) console.warn("Error guardando items:", itemsError);
            }

            log('COTIZACION_CREADA', `Código: ${newCode}`);
            return { success: true, id: newOrder.id };

        } catch (error) {
            console.error("Error creando orden:", error);
            return { success: false, message: error.message };
        }
    },

    async updateOrder(id, updates) {
        // 1. Actualizar Cabecera
        const dbUpdates = {
            total: updates.total,
            notas: updates.notas,
            cliente_id: updates.cliente_id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('ordenes')
            .update(dbUpdates)
            .eq('id', id);

        if (error) return { success: false, message: error.message };

        // 2. Actualizar Ítems (Estrategia: Borrar anteriores e insertar nuevos)
        // Esto asegura que si el usuario borró una línea, se refleje.
        if (updates.items) {
            await supabase.from('orden_items').delete().eq('orden_id', id);
            
            const newItems = updates.items.map(i => ({
                orden_id: id,
                producto: i.producto,
                cantidad: i.cantidad,
                especificaciones: i.specs,
                precio_unitario: i.precio,
                subtotal: i.subtotal
            }));
            
            await supabase.from('orden_items').insert(newItems);
        }

        log('ORDEN_ACTUALIZADA', `ID: ${id}`);
        return { success: true };
    },

    async convertToOT(id) {
        const otId = `OT-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const { error } = await supabase
            .from('ordenes')
            .update({
                ot_id: otId,
                estado: 'Orden creada',
                fecha_asignacion_global: new Date().toISOString() // Marca de tiempo de inicio producción
            })
            .eq('id', id);

        if (error) return { success: false };

        log('CONVERSION_OT', `Cotización convertida a ${otId}`);
        return { success: true, otId };
    },

    async rejectQuote(id) {
        const { error } = await supabase
            .from('ordenes')
            .update({ estado: 'Rechazada' })
            .eq('id', id);
            
        return { success: !error };
    }
};