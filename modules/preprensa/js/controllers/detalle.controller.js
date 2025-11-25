/**
 * js/controllers/detalle.controller.js
 * Gestiona la UI de Pre-Prensa: Archivos, Chat y Pasos
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
        // 1. Cargar Tarea
        const task = await DetalleService.getTaskById(this.currentTaskId);
        if (!task) return console.error("No se pudo cargar la tarea.");

        // 2. Cargar Archivos y Chat
        const archivos = await DetalleService.getArchivos(this.currentTaskId);
        const chat = await DetalleService.getHistorialChat(this.currentTaskId);

        // Renderizar Información Básica
        this.renderHeader(task);
        
        // Renderizar Módulos Dinámicos
        this.renderFiles(archivos);
        this.renderChat(chat);
        this.renderSteps(task.checklist, task.estado);
    },

    renderHeader(task) {
        document.getElementById('ot-header').textContent = `OT: ${task.codigo || task.ot_id || '---'}`;
        document.getElementById('client-name').textContent = task.cliente || '-';
        document.getElementById('product-name').textContent = task.producto || '-';
        document.getElementById('product-specs').textContent = task.specs || 'Sin especificaciones';
        
        // Badge de Estado Global
        const badge = document.getElementById('status-badge');
        badge.textContent = task.estado;
        badge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            task.estado === 'Cambios Solicitados' ? 'bg-red-100 text-red-800' :
            task.estado === 'Diseño Aprobado' ? 'bg-green-100 text-green-800' : 
            'bg-blue-100 text-blue-800'
        }`;
    },

    renderFiles(files) {
        const listContainer = document.getElementById('client-files-list');
        listContainer.innerHTML = '';

        // Separar archivos
        const clientFiles = files.filter(f => f.tipo_emisor === 'CLIENTE');
        
        if (clientFiles.length === 0) {
            listContainer.innerHTML = '<p class="text-sm text-gray-400 italic py-2">El cliente no ha subido archivos aún.</p>';
        } else {
            clientFiles.forEach(file => {
                const li = document.createElement('li');
                li.className = "py-3 flex items-center justify-between border-b last:border-0";
                li.innerHTML = `
                    <div class="flex items-center">
                        <i data-lucide="file-input" class="w-5 h-5 text-blue-600 mr-3"></i>
                        <div>
                            <p class="text-sm font-bold text-gray-800">${file.nombre_archivo}</p>
                            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Original Cliente</span>
                        </div>
                    </div>
                    <a href="${file.url_archivo}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                        <i data-lucide="download" class="w-4 h-4 mr-1"></i> Ver
                    </a>
                `;
                listContainer.appendChild(li);
            });
        }
        
        if(window.lucide) window.lucide.createIcons();
    },

    renderChat(chatMessages) {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '';

        if (chatMessages.length === 0) {
            chatContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No hay comentarios registrados.</p>';
            return;
        }

        chatMessages.forEach(msg => {
            const isMe = msg.autor === 'PREPRENSA';
            const div = document.createElement('div');
            div.className = "text-sm mb-3";
            div.innerHTML = `
                <div class="flex justify-between items-baseline mb-1">
                    <span class="font-bold ${isMe ? 'text-blue-600' : 'text-red-600'}">
                        ${isMe ? 'Diseñador (Yo)' : 'Cliente'}
                    </span>
                    <span class="text-xs text-gray-400">${new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div class="p-3 rounded-lg ${isMe ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-900 border border-red-100'}">
                    ${msg.mensaje}
                </div>
            `;
            chatContainer.appendChild(div);
        });
    },

    renderSteps(checklist, estadoGlobal) {
        // Actualizar visualmente los checks
        if(checklist.step_1) this.markStepDone(1);
        if(checklist.step_2) this.markStepDone(2);
        if(checklist.step_3) this.markStepDone(3);
        if(checklist.step_4) this.markStepDone(4);

        // Bloquear/Desbloquear según estado
        const btnPlacas = document.getElementById('btn-step-4');
        if (estadoGlobal === 'Diseño Aprobado') {
            btnPlacas.disabled = false;
            btnPlacas.classList.remove('opacity-50', 'cursor-not-allowed');
            btnPlacas.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 mr-2"></i> Generar Placas (Autorizado)`;
        } else {
            btnPlacas.disabled = true;
            btnPlacas.classList.add('opacity-50', 'cursor-not-allowed');
            btnPlacas.title = "Esperando aprobación del cliente";
        }
    },

    markStepDone(stepNum) {
        const btn = document.getElementById(`btn-step-${stepNum}`);
        if(btn) {
            btn.classList.add('bg-green-600', 'hover:bg-green-700');
            btn.classList.remove('bg-gray-600'); // o el color base que tuviera
            btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-2"></i> Completado`;
        }
    },

    setupEvents() {
        // Paso 1: Ajuste
        document.getElementById('btn-step-1')?.addEventListener('click', async () => {
            await DetalleService.updateChecklist(this.currentTaskId, 1, true);
            this.loadData();
        });

        // Paso 2: Corrección
        document.getElementById('btn-step-2')?.addEventListener('click', async () => {
            await DetalleService.updateChecklist(this.currentTaskId, 2, true);
            this.loadData();
        });

        // Paso 3: Subir Prueba (Evento especial)
        const fileInput = document.getElementById('designer-upload-input');
        
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (confirm(`¿Subir "${file.name}" y enviarlo al cliente para aprobación?`)) {
                // Mostrar estado de carga (simple)
                const label = document.getElementById('designer-upload-label');
                label.textContent = "Subiendo...";
                
                const result = await DetalleService.subirPruebaYEnvar(this.currentTaskId, file);
                
                if (result.success) {
                    alert("Prueba enviada. El estado ha cambiado a 'En Aprobación'.");
                    this.loadData();
                } else {
                    alert("Error subiendo prueba: " + result.message);
                }
                label.textContent = "Subir Nueva Prueba (PDF/JPG)";
            }
        });

        // Paso 4: Placas
        document.getElementById('btn-step-4')?.addEventListener('click', async () => {
            await DetalleService.updateChecklist(this.currentTaskId, 4, true);
            this.loadData();
        });

        // Botón Final: Enviar a Prensa
        document.getElementById('btn-ready-for-press')?.addEventListener('click', async () => {
            if(confirm("¿Confirmar que todo está listo para imprimir?")) {
                const res = await DetalleService.completeTask(this.currentTaskId);
                if(res.success) {
                    alert("Orden enviada a cola de impresión.");
                    window.location.hash = '#/preprensa';
                }
            }
        });
    }
};