/**
 * js/controllers/detalle.controller.js
 */
import { DetalleService } from '../services/detalle.service.js';

export const DetalleController = {
    currentTaskId: null,

    init: async function(params) {
        this.currentTaskId = params[0];
        if (this.currentTaskId) {
            await this.loadData();
            this.setupEvents();
        }
    },

    async loadData() {
        const task = await DetalleService.getTaskById(this.currentTaskId);
        if (!task) return;

        // Header Info
        document.getElementById('ot-header').textContent = `Taller de Diseño: ${task.ot_id}`;
        if(document.getElementById('client-name')) document.getElementById('client-name').textContent = task.cliente;
        if(document.getElementById('product-name')) document.getElementById('product-name').textContent = task.producto;
        if(document.getElementById('product-specs')) document.getElementById('product-specs').textContent = task.specs;

        this.renderProgress(task.pasos, task.estado_global);
    },

    renderProgress(pasos, estadoGlobal) {
        const markStepDone = (stepNum) => {
            const lis = document.querySelectorAll('ol > li');
            if (lis[stepNum - 1]) {
                const iconSpan = lis[stepNum - 1].querySelector('span.absolute');
                if (iconSpan) {
                    iconSpan.classList.remove('bg-gray-200', 'bg-blue-200');
                    iconSpan.classList.add('bg-green-200');
                    iconSpan.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-700"></i>';
                }
            }
            const btn = document.getElementById(`btn-step-${stepNum}`);
            if (btn) {
                btn.textContent = 'Terminado';
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        };

        // Cascada de Pasos
        if (pasos[1]) {
            markStepDone(1);
            document.getElementById('btn-step-2')?.removeAttribute('disabled');
        }
        if (pasos[2]) {
            markStepDone(2);
            document.getElementById('stock-status').textContent = '¡RESERVADO!';
            document.getElementById('stock-status').className = 'ml-4 text-sm font-bold text-green-600';
            document.getElementById('btn-step-3')?.removeAttribute('disabled');
        }
        if (pasos[3]) {
            markStepDone(3);
            // Si ya está aprobado, habilitamos el paso 4
            if (estadoGlobal === 'Diseño Aprobado') {
                 document.getElementById('btn-step-4')?.removeAttribute('disabled');
            }
        }
        if (pasos[4]) {
            markStepDone(4);
            document.getElementById('btn-ready-for-press')?.removeAttribute('disabled');
        }
        
        if (window.lucide) window.lucide.createIcons();
    },

    setupEvents() {
        const id = this.currentTaskId;

        // Paso 1: Ajuste
        document.getElementById('btn-step-1')?.addEventListener('click', async () => {
            await DetalleService.updateStepStatus(id, 1, true);
            this.loadData();
        });

        // Paso 2: Reserva
        document.getElementById('btn-step-2')?.addEventListener('click', async () => {
            await DetalleService.updateStepStatus(id, 2, true);
            this.loadData();
        });

        // Paso 3: Aprobación (CON SIMULACIÓN)
        document.getElementById('btn-step-3')?.addEventListener('click', async () => {
            // 1. Guardamos estado 'En Aprobación...' (Amarillo)
            await DetalleService.updateStepStatus(id, 3, true);
            this.loadData();

            // 2. Simulamos espera y respuesta del cliente
            setTimeout(async () => {
                const aprobado = confirm("SIMULACIÓN DE CLIENTE:\n\n¿El cliente aprobó el diseño?\n[Aceptar] = SÍ (Pasa a Verde)\n[Cancelar] = NO (Pide cambios)");
                
                if (aprobado) {
                    await DetalleService.setApprovalStatus(id, 'aprobado');
                    alert("Diseño Aprobado. Puedes generar las placas.");
                } else {
                    await DetalleService.setApprovalStatus(id, 'rechazado');
                    alert("Se marcó como 'Cambios Solicitados'.");
                }
                this.loadData(); // Recarga para ver nuevo estado y desbloqueo
            }, 500);
        });

        // Paso 4: Placas
        document.getElementById('btn-step-4')?.addEventListener('click', async () => {
            await DetalleService.updateStepStatus(id, 4, true);
            this.loadData();
        });

        // Final
        document.getElementById('btn-ready-for-press')?.addEventListener('click', async () => {
            if(confirm("¿Confirmar envío a Producción?")) {
                await DetalleService.completeTask(id);
                window.location.hash = '#/cola';
            }
        });
    }
};