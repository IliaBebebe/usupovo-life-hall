const API_BASE = '/api';

let html5QrcodeScanner = null;
let isScannerActive = false;
let isLibraryLoaded = false;

class TicketVerifier {
    constructor() {
        this.initManualInput();
        this.loadScannerLibrary();
    }

    // Загружаем библиотеку сканирования только с локального пути
    loadScannerLibrary() {
        if (typeof Html5Qrcode !== 'undefined') {
            isLibraryLoaded = true;
            console.log('✅ Библиотека сканирования уже загружена');
            this.updateScannerButton();
            return;
        }

        const script = document.createElement('script');
        script.src = '/lib/html5-qrcode.min.js';
        script.onload = () => {
            isLibraryLoaded = true;
            console.log('✅ Библиотека сканирования загружена с локального пути');
            this.updateScannerButton();
        };
        script.onerror = () => {
            console.error('❌ Не удалось загрузить локальную копию библиотеки');
            this.showScannerError('Библиотека сканирования не загружена. Проверьте наличие файла /lib/html5-qrcode.min.js');
        };
        document.head.appendChild(script);
    }

    updateScannerButton() {
        const startButton = document.getElementById('startScanner');
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '📷 Запустить сканер QR-кодов';
            startButton.style.background = '#3498db';
        }
    }

    showScannerError(message) {
        const startButton = document.getElementById('startScanner');
        if (startButton) {
            startButton.disabled = true;
            startButton.innerHTML = '❌ Сканер недоступен';
            startButton.style.background = '#95a5a6';
        }
        
        const errorElement = document.getElementById('cameraError');
        if (errorElement) {
            errorElement.style.display = 'block';
            errorElement.innerHTML = message;
        }
    }

    initManualInput() {
        const input = document.getElementById('manualTicketInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkManualTicket();
                }
            });
        }
    }

    // Запуск сканера QR-кодов
    // Запуск сканера QR-кодов
async startQRScanner() {
    if (!isLibraryLoaded || typeof Html5Qrcode === 'undefined') {
        this.showScannerError('Сканер QR-кодов еще загружается...');
        return;
    }

    const scannerElement = document.getElementById('reader');
    const startButton = document.getElementById('startScanner');
    const stopButton = document.getElementById('stopScanner');
    const errorElement = document.getElementById('cameraError');

    if (!scannerElement) {
        console.error('❌ Элемент сканера не найден');
        return;
    }

    // Очищаем предыдущий сканер
    if (html5QrcodeScanner && isScannerActive) {
        await this.stopQRScanner();
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Очищаем содержимое сканера
    scannerElement.innerHTML = '';
    scannerElement.style.position = 'relative';
    scannerElement.style.overflow = 'hidden';

    if (errorElement) errorElement.style.display = 'none';

    try {
        // Создаем сканер с правильными настройками
        html5QrcodeScanner = new Html5Qrcode("reader");
        
        // Простая конфигурация
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false
        };

        console.log('🔄 Запускаем камеру...');

        // Запускаем камеру с отображением видео
        await html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                console.log('✅ QR-код распознан:', decodedText);
                this.onQRCodeScanned(decodedText);
            },
            (error) => {
                // Игнорируем обычные ошибки сканирования
                if (!error.message?.includes('No QR code found')) {
                    console.log('🔍 Сканирование...');
                }
            }
        );

        // Успешный запуск
        console.log('✅ Сканер QR-кодов запущен, видео должно отображаться');
        
        // Принудительно проверяем отображение видео
        setTimeout(() => {
            this.checkVideoDisplay();
        }, 1000);

        if (startButton) startButton.style.display = 'none';
        if (stopButton) stopButton.style.display = 'block';
        isScannerActive = true;

    } catch (error) {
        console.error('❌ Ошибка запуска сканера:', error);
        this.handleScannerError(error);
    }
}

// Проверяем отображение видео
checkVideoDisplay() {
    const scannerElement = document.getElementById('reader');
    if (!scannerElement) return;

    // Ищем видео элемент внутри сканера
    const videoElement = scannerElement.querySelector('video');
    const canvasElement = scannerElement.querySelector('canvas');
    
    console.log('🎥 Проверка элементов:');
    console.log('Видео элемент:', videoElement);
    console.log('Canvas элемент:', canvasElement);
    
    if (videoElement) {
        console.log('📹 Видео размеры:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        console.log('🎬 Видео готовность:', videoElement.readyState);
        
        // Принудительно применяем стили для видео
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.borderRadius = '10px';
    }
    
    if (canvasElement) {
        canvasElement.style.display = 'none'; // Скрываем canvas если мешает
    }
    
    // Если видео не найдено, показываем инструкцию
    if (!videoElement) {
        console.warn('⚠️ Видео элемент не найден, но сканер может работать');
        this.showScannerStatus('Камера активна (видео может не отображаться)');
    } else {
        this.showScannerStatus('Камера активна - наведите на QR-код');
    }
}

// Показываем статус сканера
showScannerStatus(message) {
    const scannerElement = document.getElementById('reader');
    if (!scannerElement) return;

    // Удаляем предыдущий статус
    const existingStatus = document.getElementById('scannerStatus');
    if (existingStatus) {
        existingStatus.remove();
    }

    const statusElement = document.createElement('div');
    statusElement.id = 'scannerStatus';
    statusElement.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        background: rgba(46, 204, 113, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        text-align: center;
        font-weight: bold;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    statusElement.innerHTML = `🎯 ${message}`;
    
    scannerElement.appendChild(statusElement);
}

    onQRCodeScanned(decodedText) {
    console.log('📷 QR-код распознан:', decodedText);
    
    // Извлекаем номер билета из QR-кода
    const ticketId = this.extractTicketIdFromQR(decodedText);
    
    if (ticketId) {
        console.log('🎫 Извлечен номер билета:', ticketId);
        setTimeout(() => {
            this.stopQRScanner();
            this.verifyTicket(ticketId);
        }, 100);
    } else {
        console.error('❌ Не удалось извлечь номер билета из QR-кода');
        this.showError('Неверный формат QR-кода');
    }
}

// Извлекаем номер билета из различных форматов QR-кода
extractTicketIdFromQR(qrContent) {
    console.log('🔍 Анализируем QR-код:', qrContent);
    
    // Если это URL с параметром ticket
    if (qrContent.includes('ticket=')) {
        const urlParams = new URLSearchParams(new URL(qrContent).search);
        const ticketId = urlParams.get('ticket');
        if (ticketId) {
            return ticketId;
        }
    }
    
    // Если это просто номер билета (начинается с B и цифры)
    if (qrContent.match(/^B\d+$/)) {
        return qrContent;
    }
    
    // Если это URL без параметров, но содержит номер билета
    const ticketMatch = qrContent.match(/B\d+/);
    if (ticketMatch) {
        return ticketMatch[0];
    }
    
    // Если это JSON строка
    try {
        const jsonData = JSON.parse(qrContent);
        if (jsonData.ticket || jsonData.id) {
            return jsonData.ticket || jsonData.id;
        }
    } catch (e) {
        // Не JSON, продолжаем анализ
    }
    
    // Последняя попытка - ищем любой похожий на билет идентификатор
    const possibleTicket = qrContent.split('/').pop().split('?').pop().split('=').pop();
    if (possibleTicket && possibleTicket.match(/^[A-Za-z0-9]+$/)) {
        console.log('🎫 Предполагаемый номер билета:', possibleTicket);
        return possibleTicket;
    }
    
    return null;
}

    handleScannerError(error) {
        const scannerElement = document.getElementById('reader');
        const errorElement = document.getElementById('cameraError');
        
        let errorMessage = 'Не удалось запустить камеру';
        
        if (error.name === 'AbortError' || error.message.includes('AbortError')) {
            console.log('Сканер был прерван - это нормально');
            return;
        } else if (error.message && error.message.includes('Permission')) {
            errorMessage = 'Доступ к камере запрещен. Разрешите доступ к камере в настройках браузера.';
        } else if (error.message && error.message.includes('NotFound')) {
            errorMessage = 'Камера не найдена. Убедитесь, что камера подключена и доступна.';
        } else if (error.message && error.message.includes('NotSupported')) {
            errorMessage = 'Ваш браузер не поддерживает доступ к камере.';
        } else if (error.message && error.message.includes('NotAllowedError')) {
            errorMessage = 'Доступ к камере запрещен. Разрешите доступ к камере в настройках браузера.';
        }
        
        if (scannerElement) {
            scannerElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem;">❌</div>
                        <p>${errorMessage}</p>
                        <button onclick="startQRScanner()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
                            🔄 Попробовать снова
                        </button>
                    </div>
                </div>
            `;
        }
        
        if (errorElement) {
            errorElement.style.display = 'block';
            errorElement.innerHTML = `❌ ${errorMessage}`;
        }
        
        console.error('❌ Ошибка сканера:', error);
        
        this.resetScannerUI();
        isScannerActive = false;
    }

    // Остановка сканера
    async stopQRScanner() {
        if (html5QrcodeScanner && isScannerActive) {
            try {
                await html5QrcodeScanner.stop();
                console.log('⏹️ Сканер остановлен');
            } catch (err) {
                // Игнорируем ошибки остановки, связанные с AbortError
                if (err.name !== 'AbortError' && !err.message.includes('AbortError')) {
                    console.error('Ошибка остановки сканера:', err);
                } else {
                    console.log('Сканер остановлен (AbortError проигнорирована)');
                }
            }
        }
        
        this.resetScannerUI();
        isScannerActive = false;
    }

    resetScannerUI() {
        const startButton = document.getElementById('startScanner');
        const stopButton = document.getElementById('stopScanner');
        const scannerElement = document.getElementById('reader');
        
        if (startButton) startButton.style.display = 'block';
        if (stopButton) stopButton.style.display = 'none';
        if (scannerElement) {
            scannerElement.innerHTML = `
                <button id="startScanner" onclick="startQRScanner()" style="margin-top: 1rem;">
                    📷 Запустить сканер QR-кодов
                </button>
                <button id="stopScanner" onclick="stopQRScanner()" style="display: none; background: #e74c3c; margin-top: 1rem;">
                    ⏹️ Остановить сканер
                </button>
            `;
        }
    }

    async verifyTicket(ticketId) {
    try {
        if (!ticketId) {
            this.showError('Введите номер билета');
            return;
        }

        const cleanTicketId = ticketId.trim().replace(/[^A-Za-z0-9]/g, '');
        
        if (!cleanTicketId) {
            this.showError('Неверный формат номера билета');
            return;
        }

        console.log('🔍 Начинаем проверку билета:', cleanTicketId);
        this.clearResults();

        this.showLoading('Проверка билета...');

        const response = await fetch(`${API_BASE}/ticket/${cleanTicketId}`);
        
        console.log('📊 Ответ при проверке:', {
            status: response.status,
            ok: response.ok,
            url: response.url
        });

        if (!response.ok) {
            if (response.status === 404) {
                this.showError(`Билет "${cleanTicketId}" не найден`);
            } else if (response.status === 400) {
                this.showError('Неверный формат номера билета');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return;
        }
        
        const result = await response.json();
        console.log('📋 Данные билета:', result);

        if (result.valid) {
            console.log('✅ Билет действителен, статус:', result.ticket?.status);
            this.showTicketInfo(result.ticket);
        } else {
            console.log('❌ Билет недействителен:', result.message);
            this.showError(result.message || 'Билет не действителен');
        }
    } catch (error) {
        console.error('❌ Ошибка проверки билета:', error);
        this.showError('Ошибка при проверке билета: ' + error.message);
    }
}

// Метод для отображения загрузки
showLoading(message) {
    const infoElement = document.getElementById('ticketInfo');
    if (!infoElement) return;

    infoElement.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 2rem;">⏳</div>
            <p>${message}</p>
        </div>
    `;
    infoElement.className = 'ticket-info';
    infoElement.style.display = 'block';
}

    showTicketInfo(ticket) {
    const infoElement = document.getElementById('ticketInfo');
    if (!infoElement) return;

    // Убедимся, что статус корректный
    const status = ticket.status || 'active';
    const isUsed = status === 'used';
    
    const buttonHTML = isUsed 
        ? '<button disabled style="background: #95a5a6; width: 100%;">✅ Уже использован</button>'
        : `<button onclick="markAsUsed('${ticket.id}')" style="background: #27ae60; width: 100%;">✅ Отметить как использованный</button>`;

    infoElement.innerHTML = `
        <div style="color: #27ae60; font-weight: bold; margin-bottom: 1rem;">✅ Билет действителен</div>
        <div><strong>Мероприятие:</strong> ${ticket.event || 'Не указано'}</div>
        <div><strong>Дата:</strong> ${ticket.eventDate ? new Date(ticket.eventDate).toLocaleString('ru-RU') : 'Не указана'}</div>
        <div><strong>Гость:</strong> ${ticket.customer || 'Не указан'}</div>
        <div><strong>Места:</strong> ${ticket.seats || 'Не указаны'}</div>
        <div><strong>Номер билета:</strong> ${ticket.id || 'Не указан'}</div>
        <div><strong>Статус:</strong> ${status}</div>
        <div style="margin-top: 1rem;">
            ${buttonHTML}
        </div>
    `;
    infoElement.className = 'ticket-info valid';
    infoElement.style.display = 'block';
    
    console.log('🎫 Информация о билете обновлена, статус:', status);
}

    showError(message) {
        const infoElement = document.getElementById('ticketInfo');
        if (!infoElement) return;

        infoElement.innerHTML = `
            <div style="color: #e74c3c; font-weight: bold; margin-bottom: 0.5rem;">❌ ${message}</div>
            <button onclick="clearResults()" style="background: #3498db; width: 100%; margin-top: 0.5rem;">
                🔄 Попробовать снова
            </button>
        `;
        infoElement.className = 'ticket-info invalid';
        infoElement.style.display = 'block';
    }

    checkManualTicket() {
        const ticketId = document.getElementById('manualTicketInput').value.trim();
        if (ticketId) {
            this.verifyTicket(ticketId);
        } else {
            this.showError('Введите номер билета');
        }
    }

    clearResults() {
        const infoElement = document.getElementById('ticketInfo');
        const inputElement = document.getElementById('manualTicketInput');
        
        if (infoElement) {
            infoElement.style.display = 'none';
            infoElement.innerHTML = '';
        }
        if (inputElement) {
            inputElement.value = '';
            inputElement.focus();
        }
    }
}

// Глобальные функции
function startQRScanner() {
    if (window.ticketVerifier) {
        window.ticketVerifier.startQRScanner();
    }
}

function stopQRScanner() {
    if (window.ticketVerifier) {
        window.ticketVerifier.stopQRScanner();
    }
}

function checkManualTicket() {
    if (window.ticketVerifier) {
        window.ticketVerifier.checkManualTicket();
    }
}

async function markAsUsed(ticketId) {
    try {
        console.log('🔄 Начинаем отметку билета:', ticketId);
        
        // Сохраняем оригинальный ticketId для повторной проверки
        const originalTicketId = ticketId;
        
        // Показываем загрузку
        const infoElement = document.getElementById('ticketInfo');
        if (infoElement) {
            const button = infoElement.querySelector('button');
            if (button) {
                button.disabled = true;
                button.innerHTML = '⏳ Обновление...';
                button.style.background = '#f39c12';
            }
        }

        // 1. Отправляем запрос на отметку как использованный
        console.log('📤 Отправляем POST запрос на:', `${API_BASE}/ticket/${ticketId}/use`);
        
        const response = await fetch(`${API_BASE}/ticket/${ticketId}/use`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('📥 Ответ сервера:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });

        const result = await response.json();
        console.log('📋 Тело ответа:', result);

        if (response.ok) {
            console.log('✅ Сервер подтвердил отметку билета');
            
            // 2. Немедленно обновляем UI на основе ответа сервера
            if (result.ticket && result.ticket.status === 'used') {
                console.log('🎫 Сервер вернул билет со статусом "used"');
                updateTicketStatusInUI(ticketId, 'used', result.ticket);
            } else {
                console.log('⚠️ Сервер не вернул обновленный билет, обновляем локально');
                updateTicketStatusInUI(ticketId, 'used');
            }
            
            // 3. Делаем дополнительную проверку через 2 секунды
            console.log('🔄 Запланирована проверка статуса через 2 секунды...');
            setTimeout(async () => {
                console.log('🔍 Выполняем проверку статуса билета:', originalTicketId);
                try {
                    const checkResponse = await fetch(`${API_BASE}/ticket/${originalTicketId}`);
                    console.log('📊 Результат проверки:', {
                        status: checkResponse.status,
                        ok: checkResponse.ok
                    });
                    
                    if (checkResponse.ok) {
                        const checkResult = await checkResponse.json();
                        console.log('📋 Данные проверки:', checkResult);
                        
                        if (checkResult.ticket && checkResult.ticket.status === 'used') {
                            console.log('✅ Проверка подтвердила: билет использован');
                            updateTicketStatusInUI(originalTicketId, 'used', checkResult.ticket);
                        } else {
                            console.warn('⚠️ Проверка показала: билет все еще active', checkResult);
                            alert('⚠️ Внимание: Билет может быть не сохранен как использованный. Проверьте сервер.');
                        }
                    } else {
                        console.error('❌ Ошибка при проверке статуса');
                    }
                } catch (checkError) {
                    console.error('❌ Ошибка проверки:', checkError);
                }
            }, 2000);

        } else {
            console.error('❌ Ошибка сервера при отметке билета');
            throw new Error(result.error || result.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Общая ошибка:', error);
        
        // Восстанавливаем кнопку при ошибке
        const infoElement = document.getElementById('ticketInfo');
        if (infoElement) {
            const button = infoElement.querySelector('button');
            if (button) {
                button.disabled = false;
                button.innerHTML = '✅ Отметить как использованный';
                button.style.background = '#27ae60';
            }
        }
        
        alert(`❌ Ошибка: ${error.message}`);
    }
}

// Обновленная функция обновления UI
function updateTicketStatusInUI(ticketId, newStatus, ticketData = null) {
    const infoElement = document.getElementById('ticketInfo');
    if (!infoElement) {
        console.warn('⚠️ Элемент ticketInfo не найден');
        return;
    }

    console.log('🎨 Обновляем UI, новый статус:', newStatus);
    
    // Обновляем кнопку
    const button = infoElement.querySelector('button');
    if (button) {
        if (newStatus === 'used') {
            button.disabled = true;
            button.innerHTML = '✅ Уже использован';
            button.style.background = '#95a5a6';
            console.log('✅ Кнопка обновлена: заблокирована');
        }
    }
    
    // Обновляем текстовый статус
    const allDivs = infoElement.querySelectorAll('div');
    let statusUpdated = false;
    
    allDivs.forEach(div => {
        if (div.innerHTML.includes('Статус:') || div.innerHTML.includes('Status:')) {
            div.innerHTML = `<strong>Статус:</strong> ${newStatus}`;
            statusUpdated = true;
            console.log('✅ Текстовый статус обновлен');
        }
    });
    
    // Если есть данные билета, полностью перерисовываем
    if (ticketData) {
        console.log('🎫 Полное обновление UI с новыми данными');
        if (window.ticketVerifier) {
            window.ticketVerifier.showTicketInfo(ticketData);
        }
    }
    
    if (!statusUpdated) {
        console.warn('⚠️ Не удалось найти элемент статуса для обновления');
    }
}

function clearResults() {
    if (window.ticketVerifier) {
        window.ticketVerifier.clearResults();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.ticketVerifier = new TicketVerifier();
    
    const inputElement = document.getElementById('manualTicketInput');
    if (inputElement) {
        inputElement.focus();
    }
    
    const startButton = document.getElementById('startScanner');
    if (startButton) {
        startButton.disabled = true;
        startButton.innerHTML = '⏳ Загрузка сканера...';
    }
});

window.addEventListener('beforeunload', () => {
    if (window.ticketVerifier) {
        window.ticketVerifier.stopQRScanner();
    }
});