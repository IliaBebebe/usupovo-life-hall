const API_BASE = '/api';
class AdminPanel {
    constructor() {
        this.init();
    }

    init() {
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        
        this.setupEventListeners();
        this.loadDashboard();
        this.loadEventsForSelect();
    }

    updateTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleString('ru-RU');
        }
    }

    setupEventListeners() {
        // Форма создания мероприятия
        const createEventForm = document.getElementById('createEventForm');
        if (createEventForm) {
            createEventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createEvent();
            });
        }

        // Форма массового создания мест
        const createSeatsForm = document.getElementById('createSeatsForm');
        if (createSeatsForm) {
            createSeatsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createBulkSeats();
            });
        }

        // Выбор мероприятия для управления местами
        const eventSelect = document.getElementById('eventSelect');
        if (eventSelect) {
            eventSelect.addEventListener('change', (e) => {
                this.loadEventSeats(e.target.value);
            });
        }

        // Поиск бронирований
        const searchBookings = document.getElementById('searchBookings');
        if (searchBookings) {
            searchBookings.addEventListener('input', (e) => {
                this.searchBookings(e.target.value);
            });
        }

        // Фильтр мероприятий
        const filterEvents = document.getElementById('filterEvents');
        if (filterEvents) {
            filterEvents.addEventListener('change', (e) => {
                this.filterEvents(e.target.value);
            });
        }
    }

    // Массовое создание мест
    async createBulkSeats() {
        const seatsContainer = document.getElementById('seatsContainer');
        const eventId = seatsContainer ? seatsContainer.dataset.eventId : null;
        
        if (!eventId) {
            this.showError('❌ Сначала выберите мероприятие');
            return;
        }

        const rowsCount = document.getElementById('rowsCount');
        const seatsPerRow = document.getElementById('seatsPerRow');
        const basePrice = document.getElementById('basePrice');
        const vipRows = document.getElementById('vipRows');

        if (!rowsCount || !seatsPerRow || !basePrice) {
            this.showError('❌ Не найдены необходимые элементы формы');
            return;
        }

        const seatsConfig = {
            rows: parseInt(rowsCount.value),
            seatsPerRow: parseInt(seatsPerRow.value),
            basePrice: parseInt(basePrice.value),
            vipRows: vipRows ? vipRows.value.split(',').map(Number).filter(n => !isNaN(n)) : [],
            vipMultiplier: 1.5
        };

        // Валидация
        if (!seatsConfig.rows || !seatsConfig.seatsPerRow || !seatsConfig.basePrice) {
            this.showError('❌ Заполните все обязательные поля');
            return;
        }

        if (seatsConfig.rows > 20 || seatsConfig.seatsPerRow > 20) {
            this.showError('❌ Слишком большое количество рядов или мест в ряду (максимум 20)');
            return;
        }

        await this.createSeatsBulk(eventId, seatsConfig);
    }

    async loadDashboard() {
        try {
            const [stats, bookings, events] = await Promise.all([
                this.fetchData('/admin/stats'),
                this.fetchData('/admin/bookings?limit=5'),
                this.fetchData('/admin/events?limit=3')
            ]);

            this.renderStats(stats);
            this.renderRecentBookings(bookings);
            this.renderUpcomingEvents(events);
        } catch (error) {
            console.error('Ошибка загрузки дашборда:', error);
            this.showError('Ошибка загрузки дашборда');
        }
    }

    // Загрузка мероприятий для выпадающего списка
    async loadEventsForSelect() {
        try {
            const events = await this.fetchData('/admin/events');
            const select = document.getElementById('eventSelect');
            
            if (!select) return;

            select.innerHTML = '<option value="">-- Выберите мероприятие --</option>';
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.id;
                option.textContent = `${event.name} (${new Date(event.date).toLocaleDateString('ru-RU')})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка загрузки мероприятий:', error);
            this.showError('Ошибка загрузки мероприятий');
        }
    }

    // Загрузка мест мероприятия
    async loadEventSeats(eventId) {
        const container = document.getElementById('seatsContainer');
        
        if (!container) return;

        if (!eventId) {
            container.innerHTML = '<div class="loading">Выберите мероприятие для управления местами</div>';
            return;
        }

        container.innerHTML = '<div class="loading">Загрузка схемы зала...</div>';

        try {
            const seats = await this.fetchData(`/admin/events/${eventId}/seats`);
            this.renderSeatsGrid(seats, eventId);
        } catch (error) {
            console.error('Ошибка загрузки мест:', error);
            container.innerHTML = '<div class="error-message">❌ Ошибка загрузки мест</div>';
        }
    }

    // Отрисовка схемы зала
    renderSeatsGrid(seats, eventId) {
        const container = document.getElementById('seatsContainer');
        if (!container) return;
        
        if (!seats || seats.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    🎪 Места не настроены
                    <br><small>Используйте форму выше для создания схемы зала</small>
                </div>
            `;
            return;
        }

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

        let html = `
            <div class="seats-controls">
                <button class="btn btn-secondary" onclick="admin.regenerateSeats(${eventId})">
                    🔄 Перегенерировать места
                </button>
                <button class="btn btn-warning" onclick="admin.clearAllSeats(${eventId})">
                    🗑️ Очистить все места
                </button>
            </div>

            <div class="seat-legend">
                <div class="legend-item">
                    <div class="legend-color legend-standard"></div>
                    <span>Стандарт</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-vip"></div>
                    <span>VIP</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-occupied"></div>
                    <span>Занято</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color legend-blocked"></div>
                    <span>Заблокировано</span>
                </div>
            </div>
            
            <div style="text-align: center; margin: 1rem 0;">
                <div class="stage">
                    🎪 СЦЕНА
                </div>
            </div>
            
            <div class="seats-grid">
        `;

        sortedRows.forEach(row => {
            html += `<div class="seat-row">`;
            html += `<div class="row-label">Ряд ${row}</div>`;
            
            // Сортируем места в ряду
            rows[row].sort((a, b) => {
                const aNum = parseInt(a.seat_label.substring(1));
                const bNum = parseInt(b.seat_label.substring(1));
                return aNum - bNum;
            });
            
            rows[row].forEach(seat => {
                let statusClass = 'seat-standard';
                if (seat.status === 'occupied') {
                    statusClass = 'seat-occupied';
                } else if (seat.status === 'blocked') {
                    statusClass = 'seat-blocked';
                } else if (seat.category === 'vip') {
                    statusClass = 'seat-vip';
                }
                
                html += `
                    <div class="seat ${statusClass}" 
                         onclick="admin.editSeat(${seat.id}, '${seat.seat_label}', ${seat.price}, '${seat.category}', '${seat.status}')"
                         title="Место ${seat.seat_label} - ${this.getCategoryName(seat.category)} - ${seat.price} ₽ - ${this.getStatusName(seat.status)}">
                        ${seat.seat_label.substring(1)}
                    </div>
                `;
            });
            
            html += `</div>`;
        });

        html += `</div>`;
        
        // Сохраняем eventId для формы создания мест
        container.innerHTML = html;
        container.dataset.eventId = eventId;
    }

    getCategoryName(category) {
        const categories = {
            'standard': 'Стандарт',
            'vip': 'VIP'
        };
        return categories[category] || category;
    }

    getStatusName(status) {
        const statuses = {
            'free': 'Свободно',
            'occupied': 'Занято',
            'blocked': 'Заблокировано'
        };
        return statuses[status] || status;
    }

    // Редактирование места
    editSeat(seatId, seatLabel, currentPrice, currentCategory, currentStatus) {
        const container = document.getElementById('seatsContainer');
        if (!container) return;
        
        const editorHtml = `
            <div class="seat-editor">
                <h4>✏️ Редактирование места ${seatLabel}</h4>
                <form id="editSeatForm">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div class="form-group">
                            <label for="editPrice">Цена (₽):</label>
                            <input type="number" id="editPrice" value="${currentPrice}" min="100" step="50" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="editCategory">Категория:</label>
                            <select id="editCategory" required>
                                <option value="standard" ${currentCategory === 'standard' ? 'selected' : ''}>Стандарт</option>
                                <option value="vip" ${currentCategory === 'vip' ? 'selected' : ''}>VIP</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="editStatus">Статус:</label>
                            <select id="editStatus" required>
                                <option value="free" ${currentStatus === 'free' ? 'selected' : ''}>Свободно</option>
                                <option value="occupied" ${currentStatus === 'occupied' ? 'selected' : ''}>Занято</option>
                                <option value="blocked" ${currentStatus === 'blocked' ? 'selected' : ''}>Заблокировано</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button type="submit" class="btn btn-success">💾 Сохранить</button>
                        <button type="button" class="btn btn-danger" onclick="admin.deleteSeat(${seatId})">🗑️ Удалить место</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.seat-editor').remove()">❌ Отмена</button>
                    </div>
                </form>
            </div>
        `;
        
        // Удаляем предыдущий редактор
        const existingEditor = container.querySelector('.seat-editor');
        if (existingEditor) {
            existingEditor.remove();
        }
        
        container.insertAdjacentHTML('beforeend', editorHtml);
        
        // Назначаем обработчик формы
        const editForm = document.getElementById('editSeatForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateSeat(seatId);
            });
        }
    }

    // Обновление места
    async updateSeat(seatId) {
        const editPrice = document.getElementById('editPrice');
        const editCategory = document.getElementById('editCategory');
        const editStatus = document.getElementById('editStatus');

        if (!editPrice || !editCategory || !editStatus) {
            this.showError('❌ Не найдены элементы формы редактирования');
            return;
        }

        const formData = {
            price: parseInt(editPrice.value),
            category: editCategory.value,
            status: editStatus.value
        };

        try {
            const result = await this.sendData(`/admin/seats/${seatId}`, 'PUT', formData);

            if (result.success) {
                this.showSuccess('✅ Место обновлено!');
                // Перезагружаем схему зала
                const eventSelect = document.getElementById('eventSelect');
                const eventId = eventSelect ? eventSelect.value : null;
                if (eventId) {
                    this.loadEventSeats(eventId);
                }
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка обновления места:', error);
            this.showError('❌ Ошибка обновления места');
        }
    }

    // Удаление места
    async deleteSeat(seatId) {
        if (!confirm('Удалить это место? Это действие нельзя отменить.')) {
            return;
        }

        try {
            const result = await this.sendData(`/admin/seats/${seatId}`, 'DELETE');

            if (result.success) {
                this.showSuccess('✅ Место удалено!');
                const eventSelect = document.getElementById('eventSelect');
                const eventId = eventSelect ? eventSelect.value : null;
                if (eventId) {
                    this.loadEventSeats(eventId);
                }
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка удаления места:', error);
            this.showError('❌ Ошибка удаления места');
        }
    }

    // Перегенерация мест
    async regenerateSeats(eventId) {
        if (!confirm('Перегенерировать все места? Текущая схема будет полностью удалена и создана заново.')) {
            return;
        }

        const rowsCount = document.getElementById('rowsCount');
        const seatsPerRow = document.getElementById('seatsPerRow');
        const basePrice = document.getElementById('basePrice');
        const vipRows = document.getElementById('vipRows');

        const seatsConfig = {
            rows: rowsCount ? parseInt(rowsCount.value) || 6 : 6,
            seatsPerRow: seatsPerRow ? parseInt(seatsPerRow.value) || 8 : 8,
            basePrice: basePrice ? parseInt(basePrice.value) || 1500 : 1500,
            vipRows: vipRows ? vipRows.value.split(',').map(Number).filter(n => !isNaN(n)) : [],
            vipMultiplier: 1.5
        };

        await this.createSeatsBulk(eventId, seatsConfig);
    }

    // Очистка всех мест
    async clearAllSeats(eventId) {
        if (!confirm('Очистить все места? Все данные о местах и бронированиях будут удалены.')) {
            return;
        }

        try {
            const result = await this.sendData(`/admin/events/${eventId}/seats`, 'DELETE');

            if (result.success) {
                this.showSuccess('✅ Все места очищены!');
                this.loadEventSeats(eventId);
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка очистки мест:', error);
            this.showError('❌ Ошибка очистки мест');
        }
    }

    // Массовое создание мест
    async createSeatsBulk(eventId, seatsConfig) {
        try {
            const result = await this.sendData(`/admin/events/${eventId}/seats/bulk`, 'POST', seatsConfig);

            if (result.success) {
                this.showSuccess('✅ ' + (result.message || 'Места успешно созданы!'));
                // Перезагружаем схему зала
                this.loadEventSeats(eventId);
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка создания мест:', error);
            this.showError('❌ Ошибка создания мест');
        }
    }

    async loadBookings() {
        try {
            const bookings = await this.fetchData('/admin/bookings');
            this.renderAllBookings(bookings);
        } catch (error) {
            console.error('Ошибка загрузки бронирований:', error);
            this.showError('Ошибка загрузки бронирований');
        }
    }

    async loadEvents() {
        try {
            const events = await this.fetchData('/admin/events');
            this.renderAllEvents(events);
        } catch (error) {
            console.error('Ошибка загрузки мероприятий:', error);
            this.showError('Ошибка загрузки мероприятий');
        }
    }

    // Поиск бронирований
    async searchBookings(query) {
        try {
            const bookings = await this.fetchData(`/admin/bookings?search=${encodeURIComponent(query)}`);
            this.renderAllBookings(bookings);
        } catch (error) {
            console.error('Ошибка поиска бронирований:', error);
        }
    }

    // Фильтр мероприятий
    async filterEvents(filter) {
        try {
            const events = await this.fetchData(`/admin/events?filter=${filter}`);
            this.renderAllEvents(events);
        } catch (error) {
            console.error('Ошибка фильтрации мероприятий:', error);
        }
    }

    async createEvent() {
    const eventName = document.getElementById('eventName');
    const eventDate = document.getElementById('eventDate');
    const eventDescription = document.getElementById('eventDescription');
    const eventImage = document.getElementById('eventImage');
    const eventVenue = document.getElementById('eventVenue');
    const eventDuration = document.getElementById('eventDuration');

    if (!eventName || !eventDate || !eventVenue) {
        this.showError('❌ Не найдены необходимые элементы формы');
        return;
    }

    const eventData = {
        name: eventName.value,
        date: eventDate.value.replace('T', ' ') + ':00',
        description: eventDescription ? eventDescription.value : '',
        // ИЗМЕНЕНИЕ: используем только имя файла, путь добавится на сервере
        image_url: eventImage ? eventImage.value.trim() : 'default.jpg',
        venue: eventVenue.value,
        duration: eventDuration ? parseInt(eventDuration.value) || 120 : 120
    };

    // Валидация
    if (!eventData.name || !eventData.date || !eventData.venue) {
        this.showError('❌ Заполните все обязательные поля');
        return;
    }

    // Дополнительная валидация для изображения
    if (eventData.image_url && eventData.image_url !== 'default.jpg') {
        // Проверяем что это просто имя файла, а не URL
        if (eventData.image_url.includes('http') || eventData.image_url.includes('/')) {
            this.showError('❌ Укажите только имя файла (например: "concert.jpg"), а не полный URL');
            return;
        }
        
        // Проверяем расширение файла
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const hasValidExtension = validExtensions.some(ext => 
            eventData.image_url.toLowerCase().endsWith(ext)
        );
        
        if (!hasValidExtension) {
            this.showError('❌ Поддерживаются только файлы: .jpg, .jpeg, .png, .gif, .webp');
            return;
        }
    }

    try {
        const result = await this.sendData('/admin/events', 'POST', eventData);

        if (result.success) {
            this.showSuccess('✅ Мероприятие создано!');
            const createEventForm = document.getElementById('createEventForm');
            if (createEventForm) {
                createEventForm.reset();
            }
            this.loadEvents();
            this.loadEventsForSelect();
            showSection('events');
        } else {
            this.showError('❌ Ошибка: ' + result.error);
        }
    } catch (error) {
        console.error('Ошибка создания мероприятия:', error);
        this.showError('❌ Ошибка создания мероприятия');
    }
}

    async deleteEvent(eventId) {
        if (!confirm('Удалить это мероприятие? Все связанные бронирования также будут удалены.')) {
            return;
        }

        try {
            const result = await this.sendData(`/admin/events/${eventId}`, 'DELETE');

            if (result.success) {
                this.showSuccess('✅ Мероприятие удалено!');
                this.loadEvents();
                this.loadEventsForSelect();
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка удаления мероприятия:', error);
            this.showError('❌ Ошибка удаления мероприятия');
        }
    }

    // Экспорт бронирований
    async exportBookings() {
        try {
            const response = await fetch(`${API_BASE}/admin/bookings/export`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.showSuccess('✅ Экспорт завершен!');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showError('❌ Ошибка экспорта');
        }
    }

    // Экспорт мероприятий
    async exportEvents() {
        try {
            const response = await fetch(`${API_BASE}/admin/events/export`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `events_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.showSuccess('✅ Экспорт завершен!');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showError('❌ Ошибка экспорта');
        }
    }

    renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.total_bookings || 0}</div>
                <div class="stat-label">Всего бронирований</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${(stats.total_revenue || 0).toLocaleString()} ₽</div>
                <div class="stat-label">Общая выручка</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.total_events || 0}</div>
                <div class="stat-label">Мероприятий</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.used_tickets || 0}</div>
                <div class="stat-label">Использовано билетов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.available_seats || 0}</div>
                <div class="stat-label">Свободных мест</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.avg_booking_value ? Math.round(stats.avg_booking_value) : 0} ₽</div>
                <div class="stat-label">Средний чек</div>
            </div>
        `;
    }

    renderRecentBookings(bookings) {
        const container = document.getElementById('recentBookings');
        if (container) {
            this.renderBookingsTable(bookings.slice(0, 5), container);
        }
    }

    renderUpcomingEvents(events) {
        const container = document.getElementById('upcomingEvents');
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="no-data">Нет предстоящих мероприятий</div>';
            return;
        }

        container.innerHTML = `
            <div class="events-grid">
                ${events.map(event => `
                    <div class="event-card">
                        <div class="event-name">${event.name}</div>
                        <div class="event-date">${new Date(event.date).toLocaleString('ru-RU')}</div>
                        <div class="event-stats">
                            <span>${event.tickets_sold || 0} билетов</span>
                            <span>${(event.total_revenue || 0).toLocaleString()} ₽</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAllBookings(bookings) {
        const container = document.getElementById('allBookings');
        if (container) {
            this.renderBookingsTable(bookings, container);
        }
    }

    renderBookingsTable(bookings, container) {
        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<div class="no-data">Бронирований нет</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Мероприятие</th>
                            <th>Гость</th>
                            <th>Телефон</th>
                            <th>Места</th>
                            <th>Сумма</th>
                            <th>Дата брони</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(booking => `
                            <tr>
                                <td>${booking.id}</td>
                                <td>${booking.event_name || 'Не указано'}</td>
                                <td>${booking.customer_name}</td>
                                <td>${booking.customer_phone || 'Не указан'}</td>
                                <td>${booking.seat_labels}</td>
                                <td>${booking.total_amount} ₽</td>
                                <td>${new Date(booking.booking_time).toLocaleString('ru-RU')}</td>
                                <td>
                                    <span class="status-badge status-${booking.status || 'active'}">
                                        ${this.getBookingStatusName(booking.status)}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-info" onclick="admin.viewBookingDetails(${booking.id})">
                                            👁️
                                        </button>
                                        ${booking.status === 'active' ? `
                                            <button class="btn btn-sm btn-success" onclick="admin.markBookingUsed(${booking.id})">
                                                ✅
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-sm btn-danger" onclick="admin.cancelBooking(${booking.id})">
                                            ❌
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getBookingStatusName(status) {
        const statuses = {
            'active': 'Активен',
            'used': 'Использован',
            'cancelled': 'Отменен'
        };
        return statuses[status] || status;
    }

    renderAllEvents(events) {
        const container = document.getElementById('allEvents');
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="no-data">Мероприятий нет</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Название</th>
                            <th>Дата и время</th>
                            <th>Площадка</th>
                            <th>Продано билетов</th>
                            <th>Выручка</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(event => {
                            const eventDate = new Date(event.date);
                            const now = new Date();
                            const isPast = eventDate < now;
                            const status = isPast ? 'past' : 'upcoming';
                            
                            return `
                                <tr>
                                    <td>
                                        <div class="event-title">${event.name}</div>
                                        <div class="event-description">${event.description || 'Нет описания'}</div>
                                    </td>
                                    <td>${eventDate.toLocaleString('ru-RU')}</td>
                                    <td>${event.venue || 'Не указана'}</td>
                                    <td>
                                        <div>${event.tickets_sold || 0} / ${event.total_seats || 0}</div>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${((event.tickets_sold || 0) / (event.total_seats || 1)) * 100}%"></div>
                                        </div>
                                    </td>
                                    <td>${(event.total_revenue || 0).toLocaleString()} ₽</td>
                                    <td>
                                        <span class="status-badge status-${status}">
                                            ${status === 'past' ? 'Завершено' : 'Предстоящее'}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-info" onclick="admin.viewEventDetails(${event.id})">
                                                👁️
                                            </button>
                                            <button class="btn btn-sm btn-warning" onclick="admin.editEvent(${event.id})">
                                                ✏️
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="admin.deleteEvent(${event.id})">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Просмотр деталей бронирования
    async viewBookingDetails(bookingId) {
        try {
            const booking = await this.fetchData(`/admin/bookings/${bookingId}`);
            this.showBookingModal(booking);
        } catch (error) {
            console.error('Ошибка загрузки деталей бронирования:', error);
            this.showError('Ошибка загрузки деталей бронирования');
        }
    }

    // Пометка бронирования как использованного
    async markBookingUsed(bookingId) {
        try {
            const result = await this.sendData(`/admin/bookings/${bookingId}/mark-used`, 'PUT');
            
            if (result.success) {
                this.showSuccess('✅ Бронирование отмечено как использованное!');
                this.loadBookings();
                this.loadDashboard();
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка обновления бронирования:', error);
            this.showError('❌ Ошибка обновления бронирования');
        }
    }

    // Отмена бронирования
    async cancelBooking(bookingId) {
        if (!confirm('Отменить это бронирование?')) {
            return;
        }

        try {
            const result = await this.sendData(`/admin/bookings/${bookingId}/cancel`, 'PUT');
            
            if (result.success) {
                this.showSuccess('✅ Бронирование отменено!');
                this.loadBookings();
                this.loadDashboard();
            } else {
                this.showError('❌ Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка отмены бронирования:', error);
            this.showError('❌ Ошибка отмены бронирования');
        }
    }

    // Просмотр деталей мероприятия
    async viewEventDetails(eventId) {
        try {
            const event = await this.fetchData(`/admin/events/${eventId}`);
            this.showEventModal(event);
        } catch (error) {
            console.error('Ошибка загрузки деталей мероприятия:', error);
            this.showError('Ошибка загрузки деталей мероприятия');
        }
    }

    // Редактирование мероприятия
    async editEvent(eventId) {
        // Реализация формы редактирования мероприятия
        alert('Функция редактирования мероприятия в разработке');
    }

    // Модальное окно с деталями бронирования
    showBookingModal(booking) {
        const modalHtml = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Детали бронирования #${booking.id}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Мероприятие:</label>
                                <span>${booking.event_name}</span>
                            </div>
                            <div class="info-item">
                                <label>Гость:</label>
                                <span>${booking.customer_name}</span>
                            </div>
                            <div class="info-item">
                                <label>Телефон:</label>
                                <span>${booking.customer_phone || 'Не указан'}</span>
                            </div>
                            <div class="info-item">
                                <label>Email:</label>
                                <span>${booking.customer_email || 'Не указан'}</span>
                            </div>
                            <div class="info-item">
                                <label>Места:</label>
                                <span>${booking.seat_labels}</span>
                            </div>
                            <div class="info-item">
                                <label>Общая сумма:</label>
                                <span>${booking.total_amount} ₽</span>
                            </div>
                            <div class="info-item">
                                <label>Дата бронирования:</label>
                                <span>${new Date(booking.booking_time).toLocaleString('ru-RU')}</span>
                            </div>
                            <div class="info-item">
                                <label>Статус:</label>
                                <span class="status-badge status-${booking.status}">${this.getBookingStatusName(booking.status)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Модальное окно с деталями мероприятия
    showEventModal(event) {
        const eventDate = new Date(event.date);
        const modalHtml = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${event.name}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Дата и время:</label>
                                <span>${eventDate.toLocaleString('ru-RU')}</span>
                            </div>
                            <div class="info-item">
                                <label>Площадка:</label>
                                <span>${event.venue || 'Не указана'}</span>
                            </div>
                            <div class="info-item">
                                <label>Продолжительность:</label>
                                <span>${event.duration || 120} минут</span>
                            </div>
                            <div class="info-item">
                                <label>Продано билетов:</label>
                                <span>${event.tickets_sold || 0} / ${event.total_seats || 0}</span>
                            </div>
                            <div class="info-item">
                                <label>Выручка:</label>
                                <span>${(event.total_revenue || 0).toLocaleString()} ₽</span>
                            </div>
                            <div class="info-item full-width">
                                <label>Описание:</label>
                                <p>${event.description || 'Нет описания'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Утилиты для работы с API
    async fetchData(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async sendData(endpoint, method, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    }

    // Утилиты для уведомлений
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

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
    }
}

// Глобальные функции
function showSection(sectionId) {
    // Обновляем активную кнопку навигации
    document.querySelectorAll('.admin-nav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Активируем текущую кнопку
    const activeButton = Array.from(document.querySelectorAll('.admin-nav button')).find(btn => 
        btn.getAttribute('onclick')?.includes(`'${sectionId}'`)
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Скрыть все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Показать выбранную секцию
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Загрузить данные для секции
    if (window.admin) {
        if (sectionId === 'bookings') {
            window.admin.loadBookings();
        } else if (sectionId === 'events') {
            window.admin.loadEvents();
        } else if (sectionId === 'dashboard') {
            window.admin.loadDashboard();
        }
    }
}
function showStats() {
    const statsSection = document.getElementById('statsSection');
    statsSection.style.display = statsSection.style.display === 'none' ? 'block' : 'none';
    
    if (statsSection.style.display === 'block') {
        loadStats();
    }
}

function loadStats() {
    fetch('/api/admin/stats')
        .then(response => response.json())
        .then(stats => {
            document.getElementById('statsContent').innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4>📈 Общая статистика</h4>
                        <p><strong>Всего посещений:</strong> ${stats.totalVisits}</p>
                        
                        <h4>🌐 Посещения по страницам</h4>
                        ${stats.pageStats.map(page => `
                            <p>${page.page}: ${page.count} посещений</p>
                        `).join('')}
                    </div>
                    
                    <div>
                        <h4>🕒 Последние посещения</h4>
                        ${stats.recentVisits.map(visit => `
                            <p>${new Date(visit.visit_time).toLocaleString('ru-RU')} - ${visit.page}</p>
                        `).join('')}
                    </div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error loading stats:', error);
            document.getElementById('statsContent').innerHTML = '<p>Ошибка загрузки статистики</p>';
        });
}
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminPanel();
    
    // Восстановление темы
    const savedTheme = localStorage.getItem('admin-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
});