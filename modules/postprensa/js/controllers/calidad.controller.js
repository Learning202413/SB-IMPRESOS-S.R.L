import { CalidadService } from '../services/calidad.service.js';

export const CalidadController = {
    currentTaskId: null,
    taskData: null,

    init: async function(params) {
        this.currentTaskId = params[0];
        console.log(`CalidadController: ID ${this.currentTaskId}`);
        if (this.currentTaskId) {
            this.taskData = await CalidadService.getTaskData(this.currentTaskId); 
            await this.renderView();
            this.setupEvents();
        }
    },

    async renderView() {
        const task = this.taskData;
        if (!task) return;

        document.getElementById('ot-header').textContent = `Control de Calidad: ${task.ot_id}`;
        document.getElementById('client-name').textContent = task.cliente_nombre || '-';
        if(task.items && task.items.length > 0) {
             document.getElementById('product-name').textContent = task.items[0].producto;
             document.getElementById('product-specs').textContent = task.items[0].specs || 'N/A';
        }

        // Asegurar estructura
        if (!task.avance_postprensa) {
            task.avance_postprensa = { paso1: false, paso2: false, paso3: false };
        }
        
        // Renderizar botones
        this.updateStepButton('btn-step-1', 1, task.avance_postprensa.paso1);
        this.updateStepButton('btn-step-2', 2, task.avance_postprensa.paso2);
        this.updateStepButton('btn-step-3', 3, task.avance_postprensa.paso3);

        // Habilitar secuencia lógica (Desbloquear siguiente si anterior terminó)
        if (task.avance_postprensa.paso1 && !task.avance_postprensa.paso2) {
            const btn2 = document.getElementById('btn-step-2');
            if (btn2) btn2.removeAttribute('disabled');
        }
        if (task.avance_postprensa.paso2 && !task.avance_postprensa.paso3) {
            const btn3 = document.getElementById('btn-step-3');
            if (btn3) btn3.removeAttribute('disabled');
        }

        this.checkQCVisibility();
    },

    updateStepButton(btnId, stepNum, isDone) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const iconEl = document.getElementById(`icon-step-${stepNum}`);

        if (isDone) {
            // Estado Completado
            btn.disabled = true;
            btn.textContent = 'Terminado';
            btn.className = 'mt-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md cursor-not-allowed';
            
            if(iconEl) {
                iconEl.className = 'absolute flex items-center justify-center w-8 h-8 bg-green-200 rounded-full -left-4 ring-8 ring-white';
                iconEl.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-700"></i>';
            }
        } else {
            // Estado Pendiente (Evitar resetear si ya estaba disabled por lógica de negocio)
            // Solo tocamos si NO está disabled o si queremos forzar el estado inicial
            if (btn.textContent === 'Terminado') {
                 // Si venía de terminado y ahora es false (raro), restauramos
                 btn.textContent = 'Marcar Terminado';
                 btn.className = 'mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition';
            }
        }
    },

    checkQCVisibility() {
        const avance = this.taskData.avance_postprensa;
        if (avance && avance.paso1 && avance.paso2 && avance.paso3) {
            document.getElementById('qc-section')?.classList.remove('hidden');
            document.getElementById('qc-waiting-msg')?.classList.add('hidden');
        } else {
            document.getElementById('qc-section')?.classList.add('hidden');
            document.getElementById('qc-waiting-msg')?.classList.remove('hidden');
        }
        if(window.lucide) window.lucide.createIcons();
    },

    async handleStepClick(stepKey, btnId) {
        const btn = document.getElementById(btnId);
        const originalHtml = btn.innerHTML;
        
        // 1. Feedback Visual Inmediato (Loading)
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i> Guardando...';
        if(window.lucide) window.lucide.createIcons();

        // 2. Llamada al Servicio
        const updatedTask = await CalidadService.updateStep(this.currentTaskId, stepKey, this.taskData.avance_postprensa);
        
        if (updatedTask) {
            // 3. Actualización Optimista (Forzamos el estado local a TRUE)
            // Esto evita que una respuesta lenta de la BD resetee el botón
            this.taskData = updatedTask;
            if (!this.taskData.avance_postprensa) this.taskData.avance_postprensa = {};
            this.taskData.avance_postprensa[stepKey] = true; 

            // 4. Renderizar con el estado forzado
            this.renderView();
            
            if(stepKey === 'paso1') if(window.UI) window.UI.showNotification('Avance', 'Corte completado.');
            if(stepKey === 'paso2') if(window.UI) window.UI.showNotification('Avance', 'Encolado completado.');
            if(stepKey === 'paso3') if(window.UI) window.UI.showNotification('Fase Productiva Terminada', 'Habilitando Control de Calidad...');
        
        } else {
            // Error: Restaurar botón
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if(window.UI) window.UI.showNotification('Error', 'No se pudo guardar el avance.');
        }
    },

    setupEvents() {
        // Usamos la función helper para manejar la lógica repetitiva
        document.getElementById('btn-step-1')?.addEventListener('click', () => this.handleStepClick('paso1', 'btn-step-1'));
        document.getElementById('btn-step-2')?.addEventListener('click', () => this.handleStepClick('paso2', 'btn-step-2'));
        document.getElementById('btn-step-3')?.addEventListener('click', () => this.handleStepClick('paso3', 'btn-step-3'));

        // Botones de Calidad (Aprobación / Rechazo)
        document.getElementById('btn-approve-qc')?.addEventListener('click', () => {
            document.getElementById('decision-buttons').classList.add('hidden');
            document.getElementById('btn-complete-order').classList.remove('hidden');
            if(window.UI) window.UI.showNotification('Calidad Aprobada', 'Se ha habilitado el botón para completar la orden.');
        });

        document.getElementById('btn-reject-qc')?.addEventListener('click', () => {
            if(window.UI) window.UI.showNotification('Calidad Rechazada', 'Se ha notificado la incidencia al supervisor.');
        });

        // Botón Finalizar Orden
        document.getElementById('btn-complete-order')?.addEventListener('click', async () => {
             const btn = document.getElementById('btn-complete-order');
             const originalHtml = btn.innerHTML;
             btn.disabled = true;
             btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i> Finalizando...';
             if(window.lucide) window.lucide.createIcons();

             const success = await CalidadService.completeOrder(this.currentTaskId);
             
             if (success) {
                 if(window.UI) window.UI.showNotification('Éxito', 'Orden finalizada y lista para despacho.');
                 setTimeout(() => window.location.hash = '#/cola', 1500);
             } else {
                 btn.disabled = false;
                 btn.innerHTML = originalHtml;
                 if(window.UI) window.UI.showNotification('Error', 'No se pudo finalizar la orden.');
             }
        });
    }
};