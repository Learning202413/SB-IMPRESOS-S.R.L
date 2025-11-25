/**
 * js/controllers/detalle.controller.js
 * Controlador con logs de diagnóstico y manejo seguro de UI.
 */
import { DetalleService } from '../services/detalle.service.js';

export const DetalleController = {
    currentTaskId: null,

    init: async function(params) {
        this.currentTaskId = params[0];
        console.log("--> Init Detalle para ID:", this.currentTaskId);
        
        if (this.currentTaskId) {
            await this.loadData();
            this.setupEvents();
        }
    },

    async loadData() {
        const task = await DetalleService.getTaskById(this.currentTaskId);
        
        if (!task) {
            console.error("No se pudo cargar la tarea.");
            return;
        }

        console.log("--> Datos recibidos en loadData:", task);
        console.log("--> Pasos actuales:", task.pasos);

        // Render Textos
        const header = document.getElementById('ot-header');
        if(header) header.textContent = `Taller de Diseño: ${task.ot_id}`;
        
        if(document.getElementById('client-name')) document.getElementById('client-name').textContent = task.cliente || '-';
        if(document.getElementById('product-name')) document.getElementById('product-name').textContent = task.producto || '-';
        if(document.getElementById('product-specs')) document.getElementById('product-specs').textContent = task.specs || '-';

        this.renderProgress(task.pasos, task.estado_global);
    },

    renderProgress(pasos, estadoGlobal) {
        console.log("--> Ejecutando renderProgress con:", pasos);

        // Helper para pintar botón verde
        const setCompleted = (step) => {
            const btn = document.getElementById(`btn-step-${step}`);
            const icon = document.getElementById(`icon-step-${step}`);
            
            if (btn) {
                // Clonar para eliminar listeners viejos si es necesario, o simplemente actualizar
                btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 inline mr-2"></i> Listo';
                btn.disabled = true;
                btn.className = "mt-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-sm opacity-80 cursor-not-allowed";
            }
            if (icon) {
                icon.className = "absolute flex items-center justify-center w-8 h-8 bg-green-200 rounded-full -left-4 ring-8 ring-white";
                icon.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-700"></i>';
            }
        };

        // Helper para habilitar botón azul
        const setActive = (step, text = "Marcar Terminado") => {
            const btn = document.getElementById(`btn-step-${step}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 inline mr-2"></i> ${text}`;
                btn.className = "mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition";
            }
        };

        // 1. Ajuste
        if (pasos["1"]) {
            setCompleted(1);
            // Habilitar 2 si no está listo
            if (!pasos["2"]) setActive(2);
        } else {
            setActive(1);
            document.getElementById('btn-step-2').disabled = true;
            document.getElementById('btn-step-3').disabled = true;
            document.getElementById('btn-step-4').disabled = true;
        }

        // 2. Reserva
        if (pasos["2"]) {
            setCompleted(2);
            const stockEl = document.getElementById('stock-status');
            if(stockEl) {
                stockEl.textContent = '¡RESERVADO!';
                stockEl.className = 'ml-4 text-sm font-bold text-green-600';
            }
            if (!pasos["3"]) setActive(3, "Solicitar Aprobación");
        }

        // 3. Aprobación
        if (pasos["3"]) {
            setCompleted(3);
            if (!pasos["4"] && estadoGlobal === 'Diseño Aprobado') {
                setActive(4, "Generar Placas");
            }
        }

        // 4. Placas
        if (pasos["4"]) {
            setCompleted(4);
            document.getElementById('btn-ready-for-press').disabled = false;
            document.getElementById('btn-ready-for-press').classList.remove('opacity-50', 'cursor-not-allowed');
        }

        if (window.lucide) window.lucide.createIcons();
    },

    setupEvents() {
        const id = this.currentTaskId;

        const handleSave = async (step, btnId) => {
            const btn = document.getElementById(btnId);
            const originalContent = btn.innerHTML;
            
            console.log(`--> Click en paso ${step}`);
            
            // Loading UI
            btn.disabled = true;
            btn.innerHTML = 'Guardando...';

            const result = await DetalleService.updateStepStatus(id, step, true);
            
            console.log(`--> Resultado Guardado Paso ${step}:`, result);

            if (result.success) {
                // Recargar datos para asegurar consistencia visual
                await this.loadData(); 
            } else {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                alert("Error al guardar: " + result.message);
            }
        };

        document.getElementById('btn-step-1')?.addEventListener('click', () => handleSave(1, 'btn-step-1'));
        document.getElementById('btn-step-2')?.addEventListener('click', () => handleSave(2, 'btn-step-2'));
        
        // Paso 3 con simulación
        document.getElementById('btn-step-3')?.addEventListener('click', async () => {
            await handleSave(3, 'btn-step-3');
            
            setTimeout(async () => {
                const aprobado = confirm("SIMULACIÓN: ¿Cliente Aprueba?\nOK = Sí\nCancel = No");
                if(aprobado) {
                    await DetalleService.setApprovalStatus(id, 'aprobado');
                    alert("¡Aprobado! El paso 4 (Placas) debería habilitarse al recargar.");
                } else {
                    await DetalleService.setApprovalStatus(id, 'rechazado');
                }
                await this.loadData();
            }, 500);
        });

        document.getElementById('btn-step-4')?.addEventListener('click', () => handleSave(4, 'btn-step-4'));

        document.getElementById('btn-ready-for-press')?.addEventListener('click', async () => {
            if(confirm("¿Enviar a Prensa?")) {
                const res = await DetalleService.completeTask(id);
                if(res.success) window.location.hash = '#/cola';
            }
        });
    }
};