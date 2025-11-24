/**
 * js/services/stock.service.js
 * Servicio de Inventario conectado a Supabase.
 * INCLUYE: Adaptador de nombres de columna para compatibilidad con UI.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from '../../../admin/js/services/local.db.js';
import { providersDB } from '../../../admin/js/services/providers.db.js';

export const StockService = {
    /**
     * Obtiene todos los productos del inventario.
     */
    async getProducts() {
        const { data, error } = await supabase
            .from('inventario')
            .select(`
                *,
                proveedores ( id, name )
            `)
            .order('nombre');

        if (error) {
            console.error("Error al cargar inventario:", error);
            return [];
        }

        // Adaptador DB (snake_case) -> UI (camelCase/legacy)
        return data.map(p => ({
            sku: p.sku,
            nombre: p.nombre,
            descripcion: p.descripcion,
            categoria: p.categoria,
            abc: p.clase_abc,
            precio: p.precio_unitario,
            stock: p.stock_actual, // Mapeo clave
            min: p.stock_minimo,   // Mapeo clave
            // Estructura para mostrar proveedor principal
            proveedor_id: p.proveedor_principal_id,
            proveedor_nombre: p.proveedores?.name || '',
            // Simulamos array de proveedores para compatibilidad visual
            proveedores: p.proveedores ? [{ id: p.proveedores.id, nombre: p.proveedores.name }] : []
        }));
    },

    async getProductBySku(sku) {
        const products = await this.getProducts();
        return products.find(p => p.sku === sku);
    },

    /**
     * Agrega un nuevo producto.
     */
    async addProduct(product) {
        // Generar SKU si no viene o es automático
        let finalSku = product.sku;
        if (!finalSku || finalSku === '[Auto]' || finalSku.includes('Generado')) {
            const catCode = product.categoria ? product.categoria.substring(0, 3).toUpperCase() : 'GEN';
            const rnd = Math.floor(Math.random() * 10000);
            finalSku = `${catCode}-${rnd}`;
        }

        const dbProduct = {
            sku: finalSku,
            nombre: product.nombre,
            descripcion: product.descripcion,
            categoria: product.categoria,
            clase_abc: product.abc,
            stock_actual: parseInt(product.stock) || 0,
            stock_minimo: parseInt(product.min) || 0,
            precio_unitario: parseFloat(product.precio) || 0,
            proveedor_principal_id: product.proveedor_id // ID del primer proveedor seleccionado
        };

        const { error } = await supabase.from('inventario').insert(dbProduct);

        if (error) {
            console.error("Error al crear producto:", error);
            return { success: false, message: error.message };
        }

        log('PRODUCTO_CREADO', `Insumo creado: ${product.nombre} (SKU: ${finalSku})`);
        return { success: true };
    },

    /**
     * Actualiza un producto existente.
     */
    async updateProduct(originalSku, updates) {
        const dbUpdates = {};
        
        // Mapeo inverso UI -> DB
        if (updates.nombre) dbUpdates.nombre = updates.nombre;
        if (updates.descripcion) dbUpdates.descripcion = updates.descripcion;
        if (updates.categoria) dbUpdates.categoria = updates.categoria;
        if (updates.abc) dbUpdates.clase_abc = updates.abc;
        if (updates.stock !== undefined) dbUpdates.stock_actual = parseInt(updates.stock);
        if (updates.min !== undefined) dbUpdates.stock_minimo = parseInt(updates.min);
        if (updates.precio !== undefined) dbUpdates.precio_unitario = parseFloat(updates.precio);
        if (updates.proveedor_id) dbUpdates.proveedor_principal_id = updates.proveedor_id;

        const { error } = await supabase
            .from('inventario')
            .update(dbUpdates)
            .eq('sku', originalSku);

        if (error) {
            console.error("Error al actualizar producto:", error);
            return { success: false, message: error.message };
        }

        log('PRODUCTO_EDITADO', `Actualizado SKU: ${originalSku}`);
        return { success: true };
    },

    async deleteProduct(sku) {
        const { error } = await supabase
            .from('inventario')
            .delete()
            .eq('sku', sku);

        if (error) return { success: false };
        
        log('PRODUCTO_ELIMINADO', `Eliminado SKU: ${sku}`);
        return { success: true };
    },

    // --- MÉTODOS AUXILIARES (Proveedores y OCs) ---

    async searchProviders(query) {
        // Reutilizamos el servicio de providers.db que ya está en Supabase
        const providers = await providersDB.getProviders();
        if (!query) return providers;
        const lowerQ = query.toLowerCase();
        return providers.filter(p => 
            p.name.toLowerCase().includes(lowerQ) || 
            p.taxId.includes(lowerQ)
        );
    },

    async getProductsForProvider(providerId, query) {
        // Filtra productos vinculados a un proveedor específico
        let products = await this.getProducts();
        let filtered = products.filter(p => p.proveedor_id === providerId);

        if (query) {
            const lowerQ = query.toLowerCase();
            filtered = filtered.filter(p => 
                p.nombre.toLowerCase().includes(lowerQ) || 
                p.sku.toLowerCase().includes(lowerQ)
            );
        }
        return filtered;
    },

    /**
     * Crea una Orden de Compra (OC) y sus ítems.
     */
    async createOC(ocData) {
        const codigo = `OC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // 1. Crear Cabecera
        const { data: oc, error: ocError } = await supabase
            .from('compras_ordenes')
            .insert({
                codigo: codigo,
                proveedor_id: ocData.proveedor_id,
                total: ocData.total,
                notas: ocData.notas,
                estado: 'Enviada',
                fecha_emision: new Date().toISOString()
            })
            .select()
            .single();

        if (ocError || !oc) {
            console.error("Error al crear OC cabecera:", ocError);
            return { success: false };
        }

        // 2. Crear Ítems
        const itemsToInsert = ocData.items.map(item => ({
            compra_id: oc.id,
            producto_nombre: item.producto, // Guardamos nombre como respaldo
            // Intentamos buscar el SKU basado en el nombre (si es posible)
            // Nota: Idealmente el UI debería pasar el SKU, pero si pasa nombre, lo guardamos.
            cantidad: parseInt(item.cantidad),
            precio_pactado: parseFloat(item.precio)
        }));

        const { error: itemsError } = await supabase
            .from('compras_items')
            .insert(itemsToInsert);

        if (itemsError) console.warn("Error guardando items de OC:", itemsError);

        log('ORDEN_COMPRA_CREADA', `Generada ${codigo} para ${ocData.proveedor_nombre}`);
        return { success: true, code: codigo };
    }
};