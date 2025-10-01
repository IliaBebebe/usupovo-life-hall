const API_BASE = '/api';
// Основной объект для хранения данных приложения
const App = {
     lastBookingData: null,
     paymentButtonClicked: false,
    // Инициализация приложения
    init() {
        console.log('Usupovo Life Hall инициализирован');
        this.setupEventListeners();
        this.loadEventsFromAPI();
    },

    // Настройка обработчиков событий
    setupEventListeners() {
        // Закрытие модального окна
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Закрытие модального окна при клике вне его
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('bookingModal');
            if (event.target === modal) {
                this.closeModal();
            }
        });
    },
    
        // Загрузка мероприятий с сервера
    async loadEventsFromAPI() {
        try {
            console.log('🔄 Загружаем мероприятия с сервера...');
            
            const response = await fetch(`${API_BASE}/events`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const events = await response.json();
            console.log('✅ Мероприятия загружены:', events);
            
            this.displayEvents(events);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки мероприятий:', error);
            // Fallback - используем локальные данные если сервер недоступен
            console.log('📋 Показываем тестовые мероприятия');
            const sampleEvents = [
                {
                    id: 1,
                    name: "Джазовый вечер с Ансамблем 'Ностальжи'",
                    date: "2024-12-15T19:00:00",
                    description: "Незабываемый вечер классического джаза",
                    image_url: "jazz.jpg"
                },
                {
                    id: 2, 
                    name: "Стендап шоу 'Смех до слёз'",
                    date: "2024-12-20T20:00:00",
                    description: "Топовые комики страны в одном шоу",
                    image_url: "comedy.jpg"
                }
            ];
            this.displayEvents(sampleEvents);
        }
    },
    
    // Отображение мероприятий на странице
    displayEvents(events) {
        const container = document.getElementById('eventsContainer');
        window.allEvents = events;
        if (!events || events.length === 0) {
            container.innerHTML = `
                <div class="loading">
                    <p>🎭 Мероприятий пока нет</p>
                    <p><small>Скоро появится что-то интересное!</small></p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = events.map(event => `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-image">
                    ${event.image_url ? 
                        `<img src="images/${event.image_url}" alt="${event.name}" 
                              style="width:100%;height:100%;object-fit:cover;" 
                              onerror="this.style.display='none'">` : 
                        '<div style="display:flex;align-items:center;justify-content:center;height:100%;">🎭</div>'
                    }
                </div>
                <div class="event-info">
                    <h3>${event.name}</h3>
                    <div class="event-date">${this.formatDate(event.date)}</div>
                    <p>${event.description || 'Описание скоро появится...'}</p>
                    <button class="book-button" onclick="App.showEventDetails(${event.id})">
                        ℹ️ Подробнее о мероприятии
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    // Упрощенная генерация звезд рейтинга
    generateRatingStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<span class="star">★</span>';
            } else {
                stars += '<span class="star empty">★</span>';
            }
        }
        return stars;
    },
    
    // Компактный формат даты (БЕЗ года и дня недели)
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit', 
            minute: '2-digit'
        });
    },
    
    // Открытие бронирования с загрузкой мест с сервера
    async openBookingModal(eventId) {
        console.log('🚀 Открываем бронирование для мероприятия:', eventId);
        
        this.currentEventId = eventId;
        if (!this.currentEventName) {
            try {
                const events = await fetch(`${API_BASE}/events`).then(r => r.json());
                const event = events.find(e => e.id === eventId);
                if (event) {
                    this.currentEventName = event.name;
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки названия мероприятия:', error);
            }
        }
        this.selectedSeats = new Map();
        
        const modal = document.getElementById('bookingModal');
        const modalBody = document.getElementById('modalBody');
        
        // Показываем загрузку
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem;">⏳</div>
                <p>Загружаем схему зала...</p>
            </div>
        `;
        
        modal.style.display = 'block';
        
        try {
            // Загружаем места с сервера
            const response = await fetch(`${API_BASE}/seats/event/${eventId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const seats = await response.json();
            console.log('✅ Места загружены:', seats);
            
            // Загружаем данные мероприятия для названия
            const events = await fetch(`${API_BASE}/events`).then(r => r.json());
            const event = events.find(e => e.id === eventId);
            
            // Сохраняем название
            if (event) {
                this.currentEventName = event.name;
            }
            
            // Показываем форму бронирования
            this.showBookingForm(event, seats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки мест:', error);
            this.showBookingError('Не удалось загрузить схему зала. Попробуйте позже.');
        }
    },
    // Показ формы бронирования с реальными данными
    showBookingForm(event, seats) {
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <div style="max-height: 70vh; overflow-y: auto;">
                <h3 style="margin-bottom: 1rem;">🎭 ${event.name}</h3>
                
                <!-- Компактная схема зала -->
                <div class="seat-map">
                    <div class="stage">🎪 СЦЕНА</div>
                    <div class="seats-grid" id="seatMapContainer">
                        ${this.generateSeatMapFromAPI(seats)}
                    </div>
                    <div class="seat-legend">
                        <div class="legend-item"><div class="legend-color seat-free"></div><span>Свободно</span></div>
                        <div class="legend-item"><div class="legend-color seat-selected"></div><span>Выбрано</span></div>
                        <div class="legend-item"><div class="legend-color seat-vip"></div><span>VIP</span></div>
                        <div class="legend-item"><div class="legend-color seat-occupied"></div><span>Занято</span></div>
                    </div>
                </div>
                
                <!-- Информация о выборе -->
                <div class="selection-info">
                    <div id="selectedSeatsInfo">
                        <p>👆 Выберите места на схеме выше</p>
                    </div>
                </div>
            </div>
            
            <!-- Кнопки -->
            <div class="form-actions">
                <button onclick="App.closeModal()" class="btn-secondary">
                    ❌ Отмена
                </button>
                <button onclick="App.goToCustomerForm()" class="btn-primary" id="nextToStep2" disabled>
                    ✅ Далее ›
                </button>
            </div>
        `;
    },
    // Генерация схемы зала из данных API
    generateSeatMapFromAPI(seats) {
        // Группируем места по рядам
        const rows = {};
        seats.forEach(seat => {
            const row = seat.seat_label.charAt(0);
            if (!rows[row]) {
                rows[row] = [];
            }
            rows[row].push(seat);
        });
        
        // Сортируем ряды
        const sortedRows = Object.keys(rows).sort();
        
        let html = '';
        sortedRows.forEach(row => {
            html += `<div class="seat-row">`;
            html += `<div class="row-label">${row}</div>`;
            
            // Сортируем места в ряду
            rows[row].sort((a, b) => a.seat_number - b.seat_number);
            
            rows[row].forEach(seat => {
                const status = seat.status === 'occupied' ? 'seat-occupied' : 'seat-free';
                const vipClass = seat.category === 'vip' ? 'seat-vip' : '';
                const isOccupied = seat.status === 'occupied';
                
                html += `
                    <button class="seat ${status} ${vipClass}" 
                            onclick="App.selectSeatFromAPI('${seat.seat_label}', ${seat.id}, ${seat.price}, '${seat.category}')"
                            ${isOccupied ? 'disabled' : ''}
                            title="Место ${seat.seat_label} - ${seat.category === 'vip' ? 'VIP' : 'Стандарт'} - ${seat.price} ₽">
                        ${seat.seat_label || seat.label}
                    </button>
                `;
            });
            
            html += `</div>`;
        });
        
        return html;
    },
    // Выбор места (API версия)
    selectSeatFromAPI(seatLabel, seatId, price, category) {
        console.log('Выбираем место:', seatLabel, seatId, price, category);
        
        const seatElement = document.querySelector(`.seat[onclick*="${seatLabel}"]`);
        if (!seatElement) return;
        
        const seatData = {
            id: seatId,
            label: seatLabel,
            price: price,
            category: category,
            type: category === 'vip' ? 'VIP' : 'Standard'
        };
        
        if (seatElement.classList.contains('seat-selected')) {
            // Отмена выбора
            seatElement.classList.remove('seat-selected');
            seatElement.classList.add('seat-free');
            if (category === 'vip') {
                seatElement.classList.add('seat-vip');
            }
            this.selectedSeats.delete(seatLabel);
        } else {
            // Выбор места
            seatElement.classList.remove('seat-free', 'seat-vip');
            seatElement.classList.add('seat-selected');
            this.selectedSeats.set(seatLabel, seatData);
        }
        
        this.updateSelectionInfo();
    },
// Добавьте этот метод после метода selectSeatFromAPI
updateSelectionInfo() {
    const infoElement = document.getElementById('selectedSeatsInfo');
    const nextButton = document.getElementById('nextToStep2');
    
    if (!this.selectedSeats || this.selectedSeats.size === 0) {
        infoElement.innerHTML = '<p>👆 Выберите места на схеме выше</p>';
        if (nextButton) nextButton.disabled = true;
        return;
    }
    
    let total = 0;
    const seatsList = Array.from(this.selectedSeats.values()).map(seat => {
        total += seat.price;
        return `<div>📍 ${seat.label} (${seat.type}) - ${seat.price} ₽</div>`;
    }).join('');
    
    infoElement.innerHTML = `
        <h4>✅ Выбрано мест: ${this.selectedSeats.size}</h4>
        ${seatsList}
        <div style="margin-top: 1rem; font-weight: bold; border-top: 1px solid #ddd; padding-top: 0.5rem;">
            💰 Итого: ${total} ₽
        </div>
    `;
    
    if (nextButton) {
        nextButton.disabled = false;
    }
},
// Генерация компактной схемы зала
generateCompactSeatMap() {
    const container = document.getElementById('seatMapContainer');
    const rows = ['A', 'B', 'C', 'D']; // Меньше рядов
    
    let html = '';
    
    rows.forEach(row => {
        html += `<div class="seat-row">`;
        html += `<div class="row-label">${row}</div>`;
        
        // 6 мест в ряду вместо 8
        for (let i = 1; i <= 6; i++) {
            const seatId = `${row}${i}`;
            const isVip = row === 'A' || row === 'B';
            
            html += `
                <button class="seat seat-free ${isVip ? 'seat-vip' : ''}" 
                        onclick="App.selectSeat('${seatId}')"
                        title="Место ${seatId} - ${isVip ? 'VIP' : 'Стандарт'}">
                    ${i}
                </button>
            `;
        }
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
},

// Создание схемы зала (ИСПРАВЛЕННАЯ ВЕРСИЯ)
createHallLayout() {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const layout = [];
    
    rows.forEach((row, rowIndex) => {
        const seatsInRow = row === 'A' ? 6 : 8;
        const rowSeats = [];
        
        for (let i = 1; i <= seatsInRow; i++) {
            const seatId = `${row}${i}`;
            const isVip = row === 'A' || row === 'B';
            // УБИРАЕМ случайную занятость - все места свободны
            const isOccupied = false; // Все места изначально свободны
            
            rowSeats.push({
                id: seatId,
                number: i,
                row: row,
                type: isVip ? 'seat-vip' : '',
                status: isOccupied ? 'seat-occupied' : 'seat-free',
                price: isVip ? 2500 : 1500,
                category: isVip ? 'vip' : 'standard'
            });
        }
        
        layout.push({
            row: row,
            seats: rowSeats
        });
    });
    
    return layout;
},

// Простой выбор места
selectSeat(seatId) {
    console.log('Выбираем место:', seatId);
    
    const seatElement = document.querySelector(`.seat[onclick="App.selectSeat('${seatId}')"]`);
    if (!seatElement) return;
    
    const isVip = seatId.startsWith('A') || seatId.startsWith('B');
    const seatData = {
        id: seatId,
        price: isVip ? 2500 : 1500,
        type: isVip ? 'VIP' : 'Standard'
    };
    
    if (seatElement.classList.contains('seat-selected')) {
        // Отмена выбора
        seatElement.classList.remove('seat-selected');
        seatElement.classList.add('seat-free');
        this.selectedSeats.delete(seatId);
    } else {
        // Выбор места
        seatElement.classList.remove('seat-free');
        seatElement.classList.add('seat-selected');
        this.selectedSeats.set(seatId, seatData);
    }
    
    this.updateCompactSelectionInfo();
},

// Обновление информации о выборе - ПРОСТАЯ ВЕРСИЯ
updateCompactSelectionInfo() {
    const infoElement = document.getElementById('selectedSeatsInfo');
    const nextButton = document.getElementById('nextToStep2');
    
    if (!this.selectedSeats || this.selectedSeats.size === 0) {
        infoElement.innerHTML = '<p>👆 Выберите места на схеме выше</p>';
        if (nextButton) nextButton.disabled = true;
        return;
    }
    
    let total = 0;
    const seatsList = Array.from(this.selectedSeats.values()).map(seat => {
        total += seat.price;
        return `<div>📍 ${seat.id} (${seat.type}) - ${seat.price} ₽</div>`;
    }).join('');
    
    infoElement.innerHTML = `
        <h4>✅ Выбрано мест: ${this.selectedSeats.size}</h4>
        ${seatsList}
        <div style="margin-top: 1rem; font-weight: bold; border-top: 1px solid #ddd; padding-top: 0.5rem;">
            💰 Итого: ${total} ₽
        </div>
    `;
    
    if (nextButton) {
        nextButton.disabled = false;
        console.log('✅ Кнопка "Далее" активирована!');
    }
},

// Добавление места в выбранные (ОБНОВЛЕННАЯ)
addSeatToSelection(seatId, seatData) {
    if (!this.selectedSeats) {
        this.selectedSeats = new Map();
    }
    
    this.selectedSeats.set(seatId, seatData);
    console.log('Выбранные места:', Array.from(this.selectedSeats.keys()));
},

// Удаление места из выбранных
removeSeatFromSelection(seatId) {
    if (this.selectedSeats) {
        this.selectedSeats.delete(seatId);
    }
},

// Получение данных о месте
getSeatData(seatId) {
    // Временная функция - позже заменим на данные с сервера
    const isVip = seatId.startsWith('A') || seatId.startsWith('B');
    return {
        id: seatId,
        number: seatId,
        type: isVip ? 'VIP' : 'Standard',
        price: isVip ? 2500 : 1500
    };
},

// Улучшенная функция для склонения слов
getRussianPlural(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) {
        return five;
    }
    n %= 10;
    if (n === 1) {
        return one;
    }
    if (n >= 2 && n <= 4) {
        return two;
    }
    return five;
},

// Навигация по шагам
goToStep(stepNumber) {
    console.log('Переход к шагу:', stepNumber);
    
    // Скрываем все шаги
    document.querySelectorAll('.booking-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Убираем активность со всех шагов в навигации
    document.querySelectorAll('.booking-steps .step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Показываем выбранный шаг
    const stepElement = document.getElementById(`step${stepNumber}`);
    const stepNavElement = document.querySelector(`.step[data-step="${stepNumber}"]`);
    
    if (stepElement && stepNavElement) {
        stepElement.classList.add('active');
        stepNavElement.classList.add('active');
    }
    
    // Если переходим к шагу 3, заполняем детали подтверждения
    if (stepNumber === 3) {
        this.prepareConfirmation();
    }
},

// Подготовка данных для подтверждения
prepareConfirmation() {
    const confirmationElement = document.getElementById('confirmationDetails');
    
    if (!this.selectedSeats || this.selectedSeats.size === 0) {
        confirmationElement.innerHTML = '<p>Ошибка: не выбраны места</p>';
        return;
    }
    
    // Собираем данные формы
    const formData = {
        name: document.getElementById('customerName').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value
    };
    
    // Проверяем заполненность формы
    if (!formData.name || !formData.email || !formData.phone) {
        confirmationElement.innerHTML = `
            <p style="color: #e74c3c;">Пожалуйста, заполните все обязательные поля на предыдущем шаге</p>
        `;
        return;
    }
    
    // Рассчитываем итого
    let total = 0;
    const seatsDetails = Array.from(this.selectedSeats.values()).map(seat => {
        total += seat.price;
        return `<li>Место ${seat.id} (${seat.type}) - ${seat.price} ₽</li>`;
    }).join('');
    
    confirmationElement.innerHTML = `
        <div class="confirmation-section">
            <h6>Ваши данные:</h6>
            <p><strong>Имя:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Телефон:</strong> ${formData.phone}</p>
        </div>
        
        <div class="confirmation-section">
            <h6>Выбранные места:</h6>
            <ul>
                ${seatsDetails}
            </ul>
        </div>
        
        <div class="confirmation-total">
            <h6>Общая стоимость: ${total} ₽</h6>
        </div>
        
        <div class="confirmation-notice">
            <p><small>После подтверждения на ваш email будет отправлен билет с QR-кодом.</small></p>
        </div>
    `;
},

// Финальное подтверждение бронирования
finalizeBooking(eventId) {
    console.log('Финальное подтверждение бронирования для мероприятия:', eventId);
    
    if (!this.selectedSeats || this.selectedSeats.size === 0) {
        alert('Пожалуйста, выберите места');
        return;
    }
    
    const formData = {
        name: document.getElementById('customerName').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value
    };
    
    // Простая валидация
    if (!formData.name || !formData.email || !formData.phone) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    // Собираем полные данные бронирования
    const bookingData = {
        eventId: eventId,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        seats: Array.from(this.selectedSeats.values()),
        totalAmount: Array.from(this.selectedSeats.values()).reduce((sum, seat) => sum + seat.price, 0),
        bookingTime: new Date().toISOString(),
        bookingId: 'B' + Date.now() // Временный ID брони
    };
    
    console.log('Финальные данные бронирования:', bookingData);
    this.showBookingSuccess(bookingData);
},

// Обработка формы бронирования
processBookingForm(eventId) {
    console.log('processBookingForm вызвана для eventId:', eventId);
    
    const form = document.getElementById('bookingForm');
    const formData = new FormData(form);
    
    // Простая валидация
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const ticketCount = document.getElementById('ticketCount').value;
    
    if (!name) {
        alert('Пожалуйста, введите ваше имя');
        return;
    }
    
    if (!email) {
        alert('Пожалуйста, введите email');
        return;
    }
    
    if (!ticketCount) {
        alert('Пожалуйста, выберите количество билетов');
        return;
    }
    
    // Базовая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Пожалуйста, введите корректный email');
        return;
    }
    
    const bookingData = {
        eventId: eventId,
        customerName: name,
        customerEmail: email,
        customerPhone: document.getElementById('customerPhone').value,
        ticketCount: parseInt(ticketCount),
        specialRequests: document.getElementById('specialRequests')?.value || '',
        bookingTime: new Date().toISOString()
    };
    
    console.log('Бронирование успешно:', bookingData);
    this.showBookingSuccess(bookingData);
},
    
    // Настройка валидации формы
    setupFormValidation() {
        const inputs = document.querySelectorAll('#bookingForm input');
        inputs.forEach(input => {
            input.addEventListener('blur', (e) => {
                this.validateField(e.target);
            });
            
            input.addEventListener('input', (e) => {
                this.clearError(e.target);
            });
        });
    },
    
    // Валидация отдельного поля
    validateField(field) {
        const errorElement = document.getElementById(field.name + 'Error');
        
        if (!field.value.trim()) {
            this.showError(field, 'Это поле обязательно для заполнения');
            return false;
        }
        
        if (field.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                this.showError(field, 'Введите корректный email');
                return false;
            }
        }
        
        this.clearError(field);
        return true;
    },
    
    // Показать ошибку
    showError(field, message) {
        const errorElement = document.getElementById(field.name + 'Error');
        errorElement.textContent = message;
        field.style.borderColor = '#e74c3c';
    },
    
    // Очистить ошибку
    clearError(field) {
        const errorElement = document.getElementById(field.name + 'Error');
        errorElement.textContent = '';
        field.style.borderColor = '#ddd';
    },
    
    // Обработка отправки формы
// Обработка отправки формы
handleBooking(event, eventId) {
    console.log('=== handleBooking вызвана ===');
    console.log('eventId:', eventId);
    
    event.preventDefault();
    console.log('Форма предотвращена от отправки');
    
    const form = event.target;
    console.log('Форма найдена:', form);
    
    const formData = new FormData(form);
    console.log('FormData создан');

    // Валидация всех полей
    let isValid = true;
    const fields = form.querySelectorAll('input[required]');
    console.log('Обязательные поля:', fields.length);
    
    fields.forEach(field => {
        console.log('Валидируем поле:', field.name, 'значение:', field.value);
        if (!this.validateField(field)) {
            isValid = false;
            console.log('Поле не прошло валидацию:', field.name);
        }
    });
    
    console.log('Форма валидна:', isValid);
    
    if (!isValid) {
        alert('Пожалуйста, исправьте ошибки в форме');
        return;
    }
    
    // Собираем данные
    const bookingData = {
        eventId: eventId,
        customerName: formData.get('customerName'),
        customerEmail: formData.get('customerEmail'),
        customerPhone: formData.get('customerPhone'),
        ticketCount: parseInt(formData.get('ticketCount')),
        specialRequests: formData.get('specialRequests'),
        bookingTime: new Date().toISOString()
    };
    
    console.log('Данные бронирования:', bookingData);
    this.showBookingSuccess(bookingData);
},
// Переход к форме покупателя (после выбора мест)
goToCustomerForm() {
    if (!this.selectedSeats || this.selectedSeats.size === 0) {
        alert('Сначала выберите места');
        return;
    }
    
    const modalBody = document.getElementById('modalBody');
    const total = Array.from(this.selectedSeats.values()).reduce((sum, seat) => sum + seat.price, 0);
    
    modalBody.innerHTML = `
        <div style="max-height: 70vh; overflow-y: auto;">
            <h3>📝 Ваши данные</h3>
            
            <div style="background: #e8f4fd; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <strong>Вы выбрали ${this.selectedSeats.size} мест</strong><br>
                💰 Общая стоимость: <strong>${total} ₽</strong>
            </div>
            
            <form id="customerForm">
                <div class="form-group">
                    <label for="customerName">Ваше имя *</label>
                    <input type="text" id="customerName" required placeholder="Иван Иванов">
                </div>
                
                <div class="form-group">
                    <label for="customerEmail">Email *</label>
                    <input type="email" id="customerEmail" required placeholder="ivan@example.com">
                </div>
                
                <div class="form-group">
                    <label for="customerPhone">Телефон *</label>
                    <input type="tel" id="customerPhone" required placeholder="+7 (900) 123-45-67">
                </div>
            </form>
        </div>
        
        <div class="form-actions">
            <button onclick="App.backToSeatSelection()" class="btn-secondary">
                ‹ Назад к выбору мест
            </button>
            <button onclick="App.proceedToPayment()" class="btn-primary">
                💳 Перейти к оплате
            </button>
        </div>
    `;
},
// Показ деталей мероприятия
async showEventDetails(eventId) {
    console.log('📖 Показываем детали мероприятия:', eventId);
    
    try {
        // Загружаем данные мероприятия
        const response = await fetch(`${API_BASE}/events/${eventId}`);
        if (!response.ok) {
            throw new Error('Мероприятие не найдено');
        }
        
        const event = await response.json();
        this.showEventDetailsModal(event);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки мероприятия:', error);
        // Fallback - используем базовые данные
        const events = await fetch(`${API_BASE}/events`).then(r => r.json());
        const event = events.find(e => e.id === eventId);
        if (event) {
            this.showEventDetailsModal(event);
        } else {
            alert('❌ Не удалось загрузить информацию о мероприятии');
        }
    }
},

// Модальное окно с деталями мероприятия
showEventDetailsModal(event) {
    const modal = document.getElementById('bookingModal');
    const modalBody = document.getElementById('modalBody');
    this.currentEventId = event.id;
    this.currentEventName = event.name; // ← ВАЖНО: сохраняем название
    // Форматируем дату
    const eventDate = this.formatDate(event.date);
    
    modalBody.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto; margin-bottom: 1rem;">
            <!-- Заголовок и изображение -->
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <h3 style="color: #2c3e50; margin-bottom: 1rem;">${event.name}</h3>
                <div style="width: 100%; height: 200px; border-radius: 10px; overflow: hidden; margin: 0 auto;">
                    ${event.image_url ? 
                        `<img src="images/${event.image_url}" alt="${event.name}" 
                              style="width:100%;height:100%;object-fit:cover;">` : 
                        '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg, #667eea, #764ba2);color:white;font-size:2rem;">🎭</div>'
                    }
                </div>
            </div>
            
            <!-- Информация о мероприятии -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: start;">
                    <div style="font-weight: bold; color: #2c3e50;">📅 Дата:</div>
                    <div>${eventDate}</div>
                    
                    <div style="font-weight: bold; color: #2c3e50;">📍 Площадка:</div>
                    <div>${event.venue || 'Usupovo Life Hall'}</div>
                    
                    <div style="font-weight: bold; color: #2c3e50;">⏱️ Продолжительность:</div>
                    <div>${event.duration || '120'} минут</div>
                </div>
            </div>
            
            <!-- Описание -->
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: #2c3e50; margin-bottom: 0.5rem;">📝 Описание</h4>
                <p style="line-height: 1.6; color: #555;">${event.description || 'Подробное описание скоро появится...'}</p>
            </div>
            
            <!-- Дополнительная информация -->
            <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; border: 1px solid #ffeaa7; margin-bottom: 1rem;">
                <h5 style="color: #856404; margin-bottom: 0.5rem;">ℹ️ Важная информация</h5>
                <ul style="color: #856404; margin: 0; padding-left: 1.2rem;">
                    <li>Рекомендуем приходить за 30 минут до начала</li>
                    <li>Дети до 12 лет - бесплатно (в сопровождении взрослых)</li>
                    <li>Фото и видео съемка разрешена</li>
                </ul>
            </div>
        </div>
        
        <!-- Кнопки - ВСЕГДА ВИДИМЫЕ -->
        <div class="form-actions" style="position: sticky; bottom: 0; background: white; padding: 1rem 0; border-top: 2px solid #eee; margin-top: 1rem;">
            <button onclick="App.closeModal()" class="btn-secondary">
                ❌ Закрыть
            </button>
            <button onclick="App.openBookingModal(${event.id})" class="btn-primary">
                🎫 Купить билеты
            </button>
        </div>
    `;
    
    modal.style.display = 'block';
},
// Переход к оплате
async proceedToPayment() {
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    
    // Валидация
    if (!name || !email || !phone) {
        alert('❌ Заполните все обязательные поля');
        return;
    }
    
    if (this.selectedSeats.size === 0) {
        alert('❌ Выберите хотя бы одно место');
        return;
    }

    const seatLabels = Array.from(this.selectedSeats.keys());
    const total = Array.from(this.selectedSeats.values()).reduce((sum, seat) => sum + seat.price, 0);
    
    try {
        console.log('💰 Создаем платеж...');
        
        const response = await fetch(`${API_BASE}/create-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventId: this.currentEventId,
                seats: seatLabels,
                customer: {
                    name: name,
                    email: email,
                    phone: phone
                },
                total: total
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            this.showPaymentPage(result);
        } else {
            throw new Error(result.error || 'Ошибка создания платежа');
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания платежа:', error);
        alert(`❌ Ошибка: ${error.message}`);
    }
},

// Показ страницы оплаты
showPaymentPage(paymentData) {
    const modalBody = document.getElementById('modalBody');
    
    // Сбрасываем флаг при каждом новом показе
    this.paymentButtonClicked = false;
    
    modalBody.innerHTML = `
        <div style="text-align: center; max-height: 70vh; overflow-y: auto;">
            <h3>💳 Оплата билетов</h3>
            
            <div style="background: #fff3cd; padding: 1.5rem; border-radius: 10px; margin: 1rem 0; border: 1px solid #ffeaa7;">
                <h4>💰 Сумма к оплате: ${paymentData.total} ₽</h4>
                <p>ID бронирования: <strong>${paymentData.bookingId}</strong></p>
            </div>
            
            <div style="margin: 2rem 0;">
                <p>Нажмите кнопку ниже для перехода к оплате через Тинькофф</p>
                <button onclick="App.openPaymentLink('${paymentData.paymentUrl}')" class="btn-primary" id="paymentLinkButton">
                    💳 Перейти к оплате
                </button>
                <div id="paymentStatus" style="margin-top: 1rem; display: none;">
                    <div style="color: #27ae60; font-weight: bold;">
                        ✅ Вы перешли к оплате
                    </div>
                    <small>Теперь можете подтвердить оплату</small>
                </div>
            </div>
            
            <div style="background: #e8f4fd; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <h5>📋 Инструкция:</h5>
                <ol style="text-align: left; margin: 1rem;">
                    <li>Нажмите "Перейти к оплате"</li>
                    <li>Оплатите ${paymentData.total} ₽ в банке Тинькофф</li>
                    <li>Вернитесь на эту страницу</li>
                    <li>Нажмите "Подтвердить оплату"</li>
                </ol>
            </div>
            
            <div style="color: #666; font-size: 0.9rem; margin: 1rem 0;">
                ⏱️ У вас есть 30 минут для завершения оплаты
            </div>
        </div>
        
        <div class="form-actions">
            <button onclick="App.backToCustomerForm()" class="btn-secondary">
                ‹ Назад
            </button>
            <button onclick="App.confirmPayment('${paymentData.paymentId}')" class="btn-primary" id="confirmPaymentButton" disabled>
                ⏳ Подтвердить оплату
            </button>
        </div>
    `;
    
    // Сохраняем paymentId для подтверждения
    this.currentPaymentId = paymentData.paymentId;
},

// Открытие ссылки оплаты и активация кнопки подтверждения
openPaymentLink(paymentUrl) {
    console.log('🔗 Открываем ссылку оплаты');
    
    // Открываем в новом окне
    window.open(paymentUrl, '_blank');
    
    // Активируем кнопку подтверждения
    this.paymentButtonClicked = true;
    
    // Обновляем UI
    const confirmButton = document.getElementById('confirmPaymentButton');
    const paymentStatus = document.getElementById('paymentStatus');
    const paymentLinkButton = document.getElementById('paymentLinkButton');
    
    if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.innerHTML = '✅ Подтвердить оплату';
        confirmButton.style.background = '#27ae60';
    }
    
    if (paymentStatus) {
        paymentStatus.style.display = 'block';
    }
    
    if (paymentLinkButton) {
        paymentLinkButton.disabled = true;
        paymentLinkButton.innerHTML = '✅ Переход выполнен';
        paymentLinkButton.style.background = '#95a5a6';
    }
    
    // Показываем уведомление
    this.showNotification('✅ Вы перешли к оплате. Теперь можете подтвердить оплату после завершения.', 'success');
},

// Показ уведомления (добавьте этот метод если его нет)
showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
},

// Назад к форме покупателя
backToCustomerForm() {
    this.goToCustomerForm();
},

// Подтверждение оплаты
async confirmPayment(paymentId) {
    // Дополнительная проверка
    if (!this.paymentButtonClicked) {
        alert('❌ Сначала нажмите кнопку "Перейти к оплате", чтобы перейти в банк');
        return;
    }
    
    // Показываем загрузку
    const confirmButton = document.getElementById('confirmPaymentButton');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.innerHTML = '⏳ Проверяем оплату...';
        confirmButton.style.background = '#95a5a6';
    }
    
    try {
        console.log('🔄 Подтверждаем оплату:', paymentId);
        
        const response = await fetch(`${API_BASE}/confirm-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentId: paymentId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // ВАРИАНТ 1: Получаем данные из pending booking (рекомендуется)
            this.showBookingSuccess({
                bookingId: result.bookingId,
                customerName: result.customerName || 'Не указано',
                customerEmail: result.customerEmail || 'Не указано',
                customerPhone: result.customerPhone || 'Не указано',
                seats: Array.from(this.selectedSeats.values()),
                total: result.total,
                message: result.message
            });
            
        } else {
            throw new Error(result.error || 'Ошибка подтверждения оплаты');
        }
        
    } catch (error) {
        console.error('❌ Ошибка подтверждения оплаты:', error);
        
        // Возвращаем кнопку в активное состояние
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = '✅ Подтвердить оплату';
            confirmButton.style.background = '#27ae60';
        }
        
        alert(`❌ Ошибка: ${error.message}`);
    }
},

// Назад к выбору мест
backToSeatSelection() {
    this.closeModal();
    setTimeout(() => {
        this.openBookingModal(1); // временно
    }, 300);
},

    // Финальное бронирование с отправкой на сервер
    async finalBooking() {
        const name = document.getElementById('customerName').value.trim();
        const email = document.getElementById('customerEmail').value.trim();
        const phone = document.getElementById('customerPhone').value.trim();
        
        // Валидация
        if (!name || !email || !phone) {
            alert('❌ Заполните все обязательные поля');
            return;
        }
        
        if (this.selectedSeats.size === 0) {
            alert('❌ Выберите хотя бы одно место');
            return;
        }
        
        const seatLabels = Array.from(this.selectedSeats.keys());
        
        try {
            console.log('📤 Отправляем бронирование на сервер...');
            
            const response = await fetch(`${API_BASE}/book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventId: this.currentEventId,
                    seats: seatLabels,
                    customer: {
                        name: name,
                        email: email,
                        phone: phone
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('✅ Бронирование успешно:', result);
            
            // Показываем успешное бронирование
            this.showBookingSuccess({
                bookingId: result.bookingId,
                customerName: name,
                customerEmail: email,
                customerPhone: phone,
                seats: Array.from(this.selectedSeats.values()),
                total: result.total,
                message: result.message
            });
            
        } catch (error) {
            console.error('❌ Ошибка бронирования:', error);
            alert(`❌ Ошибка бронирования: ${error.message}`);
        }
    },

    // Показ ошибки
    showBookingError(message) {
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; color: #e74c3c;">❌</div>
                <h4>Ошибка</h4>
                <p>${message}</p>
                <button onclick="App.closeModal()" class="btn-primary" style="margin-top: 1rem;">
                    Закрыть
                </button>
            </div>
        `;
    },
// Получить название текущего мероприятия
getCurrentEventName() {
    if (this.currentEventId && window.allEvents) {
        const event = window.allEvents.find(e => e.id == this.currentEventId);
        return event ? event.name : 'Мероприятие';
    }
    
    // Fallback: попробуем получить из DOM
    const eventCards = document.querySelectorAll('.event-card');
    for (let card of eventCards) {
        if (card.dataset.eventId == this.currentEventId) {
            const title = card.querySelector('h3');
            return title ? title.textContent : 'Мероприятие';
        }
    }
    
    return 'Мероприятие';
},
// Показать успешное бронирование с билетом
showBookingSuccess(bookingData) {
    const modalBody = document.getElementById('modalBody');
    this.lastBookingData = bookingData;
    
    // Генерируем QR-код
    const qrData = this.generateQRData(bookingData);
    
    modalBody.innerHTML = `
        <div class="booking-success">
            <div style="text-align: center; color: #27ae60; font-size: 4rem;">✅</div>
            <h4 style="text-align: center; color: #27ae60;">🎉 Бронирование успешно!</h4>
            
            <!-- Подсказка про скриншот -->
            <div style="text-align: center; margin: 1rem 0; padding: 1rem; background: #e8f4fd; border-radius: 8px; border-left: 4px solid #3498db;">
                <p style="margin: 0; color: #2c3e50; font-weight: bold;">
                    📱 Вы можете сделать скриншот, чтобы не забыть
                </p>
            </div>
            
            <!-- Билет - АДАПТИВНЫЙ -->
            <div class="ticket" style="border: 3px solid #3498db; border-radius: 15px; padding: 0; margin: 1.5rem 0; background: white; color: #2c3e50; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); max-width: 100%;">
                <!-- Шапка билета -->
                <div style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 1rem; text-align: center;">
                    <h3 style="margin: 0; font-size: clamp(1.2rem, 4vw, 1.5rem);">🎭 Usupovo Life Hall</h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9; font-size: clamp(0.8rem, 3vw, 0.9rem);">ЭЛЕКТРОННЫЙ БИЛЕТ</p>
                </div>
                
                <!-- Основная информация - АДАПТИВНАЯ -->
                <div style="padding: 1rem;">
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- QR-код - по центру на мобильных -->
                        <div style="text-align: center;">
                            <div id="qrcode" style="background: white; padding: 10px; border-radius: 8px; border: 2px solid #f0f0f0; display: inline-block; max-width: 100%;"></div>
                        </div>
                        
                        <!-- Информация о билете -->
                        <div>
                            <div style="margin-bottom: 0.8rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f0f0f0;">
                                <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">МЕРОПРИЯТИЕ:</strong><br>
                                <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${this.currentEventName || 'Мероприятие'}</span>
                            </div>
                            
                            <!-- Информация о покупателе - СТЕК на мобильных -->
                            <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 1rem;">
                                <!-- Имя -->
                                <div>
                                    <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">ИМЯ:</strong><br>
                                    <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${bookingData.customerName || 'Не указано'}</span>
                                </div>
                                
                                <!-- Телефон и Email в ряд на десктопе, в столбик на мобильных -->
                                <div style="display: grid; grid-template-columns: 1fr; gap: 0.8rem;">
                                    <div>
                                        <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">ТЕЛЕФОН:</strong><br>
                                        <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${bookingData.customerPhone || 'Не указано'}</span>
                                    </div>
                                    
                                    ${bookingData.customerEmail ? `
                                    <div>
                                        <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">EMAIL:</strong><br>
                                        <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${bookingData.customerEmail}</span>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Места -->
                                <div>
                                    <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">МЕСТА:</strong><br>
                                    <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${bookingData.seats.map(seat => `${seat.label} (${seat.type})`).join(', ')}</span>
                                </div>
                                
                                <!-- Номер брони и сумма в ряд -->
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <strong style="color: #3498db; font-size: clamp(0.9rem, 3vw, 1rem);">НОМЕР БРОНИ:</strong><br>
                                        <span style="font-size: clamp(0.8rem, 3vw, 0.9rem);">${bookingData.bookingId}</span>
                                    </div>
                                    
                                    <!-- Сумма -->
                                    <div style="text-align: right;">
                                        <div style="font-size: clamp(1.2rem, 4vw, 1.4rem); font-weight: bold; color: #27ae60;">
                                            💰 ${bookingData.total} ₽
                                        </div>
                                        <small style="color: #7f8c8d; font-size: clamp(0.7rem, 2vw, 0.8rem);">Оплачено</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Правила зала -->
                    <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 2px dashed #3498db;">
                        <div style="display: flex; justify-content: center; gap: 0.8rem; margin-bottom: 0.5rem;">
                            <img src="images/icons.png" alt="Правила зала" style="height: 24px; max-width: 100%;" title="Правила зала: Без еды и напитков, Без оружия, Без курения">
                        </div>
                        <small style="color: #7f8c8d; font-size: clamp(0.7rem, 2vw, 0.8rem);">Правила зала</small>
                    </div>
                </div>
                
                <!-- Подвал билета -->
                <div style="background: #f8f9fa; padding: 0.8rem; border-top: 1px solid #e9ecef;">
                    <div style="text-align: center; font-size: clamp(0.7rem, 2vw, 0.8rem); color: #6c757d; line-height: 1.4;">
                        <p style="margin: 0 0 0.3rem 0;">📍 г.о. Домодедово, КП "Юсупово Лайф Парк", ул. Рассветная, 8</p>
                        <p style="margin: 0 0 0.3rem 0;">📞 +7 (985) 834-94-94</p>
                        <p style="margin: 0; font-weight: bold;">Предъявите QR-код на входе</p>
                    </div>
                </div>
            </div>
            
            <div class="success-actions" style="text-align: center; margin-top: 2rem;">
                <button onclick="App.printTicket()" class="btn-secondary" style="margin-right: 0.5rem; margin-bottom: 0.5rem; padding: 0.8rem 1.2rem; font-size: clamp(0.9rem, 3vw, 1rem);">
                    🖨️ Распечатать
                </button>
                <button onclick="App.closeModal()" class="btn-primary" style="padding: 0.8rem 1.2rem; font-size: clamp(0.9rem, 3vw, 1rem);">
                    👍 Отлично!
                </button>
            </div>
        </div>
    `;
    
    // Генерируем QR-код после отрисовки DOM
    setTimeout(() => {
        this.generateQRCode(qrData);
    }, 100);
},

// Генерация данных для QR-кода
generateQRData(bookingData) {
    const verificationUrl = `${window.location.origin}/verify.html?ticket=${bookingData.bookingId}`;
    return verificationUrl;
},

// Для библиотеки qrcode-generator
generateQRCode(data) {
    const qrElement = document.getElementById('qrcode');
    if (!qrElement) return;

    qrElement.innerHTML = '';

    // Проверяем библиотеку
    const qrcode = window.qrcode;
    
    if (!qrcode) {
        console.error('qrcode library not found');
        return;
    }

    try {
        // Создаем QR-код
        const qr = qrcode(0, 'M');
        qr.addData(data);
        qr.make();
        
        // Создаем canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 120;
        canvas.width = size;
        canvas.height = size;
        
        // Очищаем canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        
        // Рисуем QR-код
        const cellSize = size / qr.getModuleCount();
        ctx.fillStyle = '#000000';
        
        for (let row = 0; row < qr.getModuleCount(); row++) {
            for (let col = 0; col < qr.getModuleCount(); col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        col * cellSize,
                        row * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
        
        qrElement.appendChild(canvas);
        console.log('QR Code generated successfully');

    } catch (error) {
        console.error('QR Code generation failed:', error);
        this.showQRFallback(qrElement, data);
    }
},

// Добавляем обратно функцию запасного варианта
showQRFallback(qrElement, data) {
    const ticketId = data.split('?ticket=')[1] || 'Билет';
    
    qrElement.innerHTML = `
        <div style="
            width: 120px; 
            height: 120px; 
            background: white; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            border: 2px solid #3498db; 
            border-radius: 8px;
            text-align: center;
            padding: 10px;
            color: #000000;
        ">
            <div style="font-size: 24px;">📱</div>
            <div style="font-size: 10px; margin-top: 5px; color: #000000; font-weight: bold;">
                ${ticketId}
            </div>
        </div>
    `;
},

// Печать билета - КОМПАКТНАЯ ВЕРСИЯ
printTicket() {
    const ticket = document.querySelector('.ticket');
    if (!ticket) return;

    // Получаем данные для повторной генерации QR-кода
    const qrData = this.generateQRData(this.lastBookingData);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Билет - Usupovo Life Hall</title>
                <style>
                    @media print {
                        @page {
                            size: A5 landscape;
                            margin: 0.3cm;
                        }
                        body { 
                            margin: 0; 
                            padding: 0;
                            font-family: Arial, sans-serif;
                            -webkit-print-color-adjust: exact;
                        }
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 0;
                        padding: 0.3cm;
                        background: white;
                        width: 100vw;
                        height: 100vh;
                    }
                    
                    .print-ticket { 
                        width: 100%;
                        height: 10.5cm; /* Фиксированная высота для А5 */
                        border: 2px solid #3498db; 
                        border-radius: 8px; 
                        background: white;
                        color: #2c3e50;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .ticket-header {
                        background: linear-gradient(135deg, #3498db, #2980b9); 
                        color: white; 
                        padding: 0.4rem 0.6rem;
                        text-align: center;
                        flex-shrink: 0;
                    }
                    
                    .ticket-main {
                        display: flex;
                        flex: 1;
                        min-height: 0;
                    }
                    
                    .qr-section {
                        flex: 0 0 4.5cm;
                        padding: 0.5rem;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        border-right: 1px dashed #3498db;
                    }
                    
                    .qr-container { 
                        background: white; 
                        padding: 5px; 
                        border-radius: 5px; 
                        border: 1px solid #f0f0f0;
                        margin-bottom: 0.5rem;
                    }
                    
                    .info-section {
                        flex: 1;
                        padding: 0.5rem;
                        font-size: 12px;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .info-grid {
                        flex: 1;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 0.3rem;
                    }
                    
                    .info-item {
                        padding: 0.2rem;
                    }
                    
                    .info-label {
                        font-weight: bold;
                        color: #3498db;
                        font-size: 10px;
                        margin-bottom: 0.1rem;
                    }
                    
                    .info-value {
                        font-size: 11px;
                        line-height: 1.2;
                    }
                    
                    .ticket-footer {
                        background: #f8f9fa; 
                        padding: 0.4rem 0.6rem;
                        border-top: 1px solid #e9ecef;
                        font-size: 9px;
                        text-align: center;
                        color: #6c757d;
                        flex-shrink: 0;
                    }
                    
                    .rules-amount {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 0.3rem;
                        padding-top: 0.3rem;
                        border-top: 1px dashed #3498db;
                    }
                    
                    .amount {
                        font-size: 12px;
                        font-weight: bold;
                        color: #27ae60;
                    }
                    
                    .rules-icons img {
                        height: 18px;
                    }
                    
                    h2 {
                        font-size: 14px;
                        margin: 0;
                    }
                    
                    .header-subtitle {
                        font-size: 10px;
                        opacity: 0.9;
                        margin-top: 0.1rem;
                    }
                    
                    /* Сумма в основной информации */
                    .amount-in-info {
                        font-size: 12px;
                        font-weight: bold;
                        color: #27ae60;
                        text-align: center;
                        margin-top: 0.3rem;
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
            </head>
            <body>
                <div class="print-ticket">
                    <!-- Шапка -->
                    <div class="ticket-header">
                        <h2>🎭 Usupovo Life Hall</h2>
                        <div class="header-subtitle">ЭЛЕКТРОННЫЙ БИЛЕТ</div>
                    </div>
                    
                    <!-- Основное содержимое -->
                    <div class="ticket-main">
                        <!-- QR-код -->
                        <div class="qr-section">
                            <div class="qr-container">
                                <div id="qrcode"></div>
                            </div>
                            <!-- УБРАЛИ СУММУ ОТСЮДА -->
                        </div>
                        
                        <!-- Информация -->
                        <div class="info-section">
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">МЕРОПРИЯТИЕ</div>
                                    <div class="info-value">${this.currentEventName || 'Мероприятие не указано'}</div>
                                </div>
                                
                                <div class="info-item">
                                    <div class="info-label">ИМЯ</div>
                                    <div class="info-value">${this.lastBookingData.customerName || 'Не указано'}</div>
                                </div>
                                
                                <div class="info-item">
                                    <div class="info-label">ТЕЛЕФОН</div>
                                    <div class="info-value">${this.lastBookingData.customerPhone || 'Не указано'}</div>
                                </div>
                                
                                ${this.lastBookingData.customerEmail ? `
                                <div class="info-item">
                                    <div class="info-label">EMAIL</div>
                                    <div class="info-value">${this.lastBookingData.customerEmail}</div>
                                </div>
                                ` : ''}
                                
                                <div class="info-item" style="grid-column: span 2;">
                                    <div class="info-label">МЕСТА</div>
                                    <div class="info-value">${this.lastBookingData.seats.map(seat => `${seat.label} (${seat.type})`).join(', ')}</div>
                                </div>
                                
                                <div class="info-item" style="grid-column: span 2;">
                                    <div class="info-label">НОМЕР БРОНИ</div>
                                    <div class="info-value">${this.lastBookingData.bookingId}</div>
                                </div>
                                
                                <!-- СУММА ПЕРЕМЕЩЕНА СЮДА -->
                                <div class="info-item" style="grid-column: span 2; text-align: center; margin-top: 0.2rem;">
                                    <div class="amount-in-info">
                                        💰 ${this.lastBookingData.total} ₽<br>
                                        <small style="color: #7f8c8d; font-weight: normal;">Оплачено</small>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Правила -->
                            <div class="rules-amount">
                                <div class="rules-icons">
                                    <img src="${window.location.origin}/images/icons.png" alt="Правила зала">
                                </div>
                                <div style="font-size: 9px; color: #7f8c8d;">
                                    Правила зала
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Подвал -->
                    <div class="ticket-footer">
                        <div>📍 г.о. Домодедово, КП "Юсупово Лайф Парк", ул. Рассветная, 8</div>
                        <div>📞 +7 (985) 834-94-94 | Предъявите QR-код на входе</div>
                    </div>
                </div>
                
                <script>
                    // Регенерируем QR-код для печати
                    setTimeout(function() {
                        generateQRForPrint('${qrData}');
                    }, 100);
                    
                    function generateQRForPrint(data) {
                        const qrElement = document.getElementById('qrcode');
                        if (!qrElement || !window.qrcode) return;
                        
                        try {
                            const qr = qrcode(0, 'L');
                            qr.addData(data);
                            qr.make();
                            
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const size = 90;
                            canvas.width = size;
                            canvas.height = size;
                            
                            // Очищаем canvas
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, size, size);
                            
                            // Рисуем QR-код
                            const cellSize = size / qr.getModuleCount();
                            ctx.fillStyle = '#000000';
                            
                            for (let row = 0; row < qr.getModuleCount(); row++) {
                                for (let col = 0; col < qr.getModuleCount(); col++) {
                                    if (qr.isDark(row, col)) {
                                        ctx.fillRect(
                                            col * cellSize,
                                            row * cellSize,
                                            cellSize,
                                            cellSize
                                        );
                                    }
                                }
                            }
                            
                            // Заменяем существующий элемент
                            qrElement.innerHTML = '';
                            qrElement.appendChild(canvas);
                            
                        } catch (error) {
                            console.error('Print QR error:', error);
                        }
                    }
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
    
    // Даем время на генерацию QR-кода перед печати
    setTimeout(() => {
        printWindow.print();
        // Закрываем окно после печати
        setTimeout(() => {
            printWindow.close();
        }, 500);
    }, 500);
},
    
    // Временная функция для получения мероприятия
    getEventById(eventId) {
        return {
            id: eventId,
            name: `Мероприятие #${eventId}`,
            date: new Date().toISOString()
        };
    },
    
    // Вспомогательная функция для склонения слов
    getRussianPlural(number) {
        if (number === 1) return '';
        if (number >= 2 && number <= 4) return 'а';
        return 'ов';
    },
    
    // Закрытие модального окна
    closeModal() {
        document.getElementById('bookingModal').style.display = 'none';
    }
};

// Вспомогательные функции
function scrollToEvents() {
    document.getElementById('events').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Инициализация приложения когда DOM загружен
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Произошла ошибка:', e.error);
});
