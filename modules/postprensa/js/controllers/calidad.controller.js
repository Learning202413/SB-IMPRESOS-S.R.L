import { LocalDB } from '../services/local.db.js';
import { CalidadService } from '../services/calidad.service.js';

const getTimestamp = () => new Date().toLocaleString('es-PE', { 
    hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', 
    day: '2-digit', month: '2-digit', year: 'numeric'
});

export const CalidadController = {
    currentTaskId: null,
    taskData: null,

    init: async function(params) {
        this.currentTaskId = params[0];
        console.log(`CalidadController: ID ${this.currentTaskId}`);
        if (this.currentTaskId) {
            // Usa el servicio para obtener los datos
            this.taskData = await CalidadService.getTaskData(this.currentTaskId); 
            await this.renderView();
            this.setupEvents();
        }
    },

    async renderView() {
        const task = this.taskData;
        if (!task) return;

        document.getElementById('ot-header').textContent = `Control de Calidad: ${task.ot_id}`;
        document.getElementById('client-name').textContent = task.cliente_nombre;
        if(task.items && task.items.length > 0) {
             document.getElementById('product-name').textContent = task.items[0].producto;
             document.getElementById('product-specs').textContent = task.items[0].specs || 'N/A';
        }

        if (!task.avance_postprensa) {
            task.avance_postprensa = { paso1: false, paso2: false, paso3: false };
        }
        
        this.restoreStepButton('btn-step-1', 1, task.avance_postprensa.paso1);
        this.restoreStepButton('btn-step-2', 2, task.avance_postprensa.paso2);
        this.restoreStepButton('btn-step-3', 3, task.avance_postprensa.paso3);

        if (task.avance_postprensa.paso1) document.getElementById('btn-step-2')?.removeAttribute('disabled');
        if (task.avance_postprensa.paso2) document.getElementById('btn-step-3')?.removeAttribute('disabled');

        this.checkQCVisibility();
    },

    restoreStepButton(btnId, stepNum, isDone) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (isDone) {
            btn.disabled = true;
            btn.textContent = 'Terminado';
            btn.className = 'mt-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md cursor-not-allowed';
            
            const iconEl = document.getElementById(`icon-step-${stepNum}`);
            if(iconEl) {
                iconEl.className = 'absolute flex items-center justify-center w-8 h-8 bg-green-200 rounded-full -left-4 ring-8 ring-white';
                iconEl.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-700"></i>';
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
            document.getElementById('qc-waiting-msg')?.classList.add('hidden');
        }
        if(window.lucide) window.lucide.createIcons();
    },

    async saveStep(stepKey) {
        // Usa el servicio para actualizar el estado y obtener la tarea fresca
        const updatedTask = await CalidadService.updateStep(this.currentTaskId, stepKey, this.taskData.avance_postprensa);
        
        if (updatedTask) {
            this.taskData = updatedTask; // Actualiza la data del controlador
            this.checkQCVisibility();
            return true;
        }
        return false;
    },

    setupEvents() {
        document.getElementById('btn-step-1')?.addEventListener('click', async () => {
             await this.saveStep('paso1');
             this.renderView(); 
             if(window.UI) window.UI.showNotification('Avance', 'Corte completado.');
        });

        document.getElementById('btn-step-2')?.addEventListener('click', async () => {
             await this.saveStep('paso2');
             this.renderView();
             if(window.UI) window.UI.showNotification('Avance', 'Encolado completado.');
        });

        document.getElementById('btn-step-3')?.addEventListener('click', async () => {
             const success = await this.saveStep('paso3');
             if(success) {
                 this.renderView();
                 if(window.UI) window.UI.showNotification('Fase Productiva Terminada', 'Habilitando Control de Calidad...');
             }
        });

        document.getElementById('btn-approve-qc')?.addEventListener('click', () => {
            document.getElementById('decision-buttons').classList.add('hidden');
            const btnComplete = document.getElementById('btn-complete-order');
            btnComplete.classList.remove('hidden');
            if(window.UI) window.UI.showNotification('Calidad Aprobada', 'Se ha habilitado el botón para completar la orden.');
        });

        document.getElementById('btn-reject-qc')?.addEventListener('click', () => {
            if(window.UI) window.UI.showNotification('Calidad Rechazada', 'Se ha notificado la incidencia.');
        });

        document.getElementById('btn-complete-order')?.addEventListener('click', async () => {
             // Usa el servicio para la lógica de finalización
             const success = await CalidadService.completeOrder(this.currentTaskId);
             
             if (success) {
                 if(window.UI) window.UI.showNotification('Éxito', 'Orden finalizada y lista para despacho.');
                 setTimeout(() => window.location.hash = '#/cola', 1500);
             } else {
                 if(window.UI) window.UI.showNotification('Error', 'No se pudo finalizar la orden.');
             }
        });
    }
};