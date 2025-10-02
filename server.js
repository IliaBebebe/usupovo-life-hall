const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DATABASE_URL || './usupovo-hall.db';

const app = express();
const PORT = 3000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database', err);
    } else {
        console.log('✅ Connected to SQLite database:', dbPath);
        initializeDatabase();
    }
});

// Правильная инициализация БД
function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    // Создаем таблицы последовательно
    const tables = [
        `CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            image_url TEXT
        )`,
        
        `CREATE TABLE IF NOT EXISTS seats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            seat_label TEXT NOT NULL,
            price INTEGER NOT NULL,
            category TEXT,
            status TEXT DEFAULT 'free'
        )`,
        
        `CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            event_id INTEGER,
            seat_labels TEXT,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            total_amount INTEGER,
            booking_time TEXT,
            status TEXT DEFAULT 'active'
        )`,
        
        `CREATE TABLE IF NOT EXISTS pending_bookings (
            payment_id TEXT PRIMARY KEY,
            booking_id TEXT NOT NULL,
            event_id INTEGER NOT NULL,
            seat_labels TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT,
            total_amount INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL
        )`,

        `CREATE TABLE IF NOT EXISTS site_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page TEXT NOT NULL,
            visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_agent TEXT
        )`
    ];

    let currentIndex = 0;
    
    function createNextTable() {
        if (currentIndex >= tables.length) {
            console.log('✅ All tables created successfully');
            checkAndInsertSampleData();
            return;
        }
        
        const sql = tables[currentIndex];
        db.run(sql, function(err) {
            if (err) {
                console.error(`❌ Error creating table ${currentIndex + 1}:`, err);
                console.error('SQL:', sql);
            } else {
                console.log(`✅ Table ${currentIndex + 1} created/verified`);
            }
            currentIndex++;
            createNextTable();
        });
    }
    
    createNextTable();
}

// Проверяем и вставляем тестовые данные
function checkAndInsertSampleData() {
    // Проверяем есть ли мероприятия
    db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
        if (err) {
            console.error('Error checking events:', err);
            return;
        }
        
        // Добавляем тестовые данные ТОЛЬКО если таблица пустая
        if (row.count === 0) {
            console.log('📝 Inserting sample data for first run...');
            insertSampleData();
        } else {
            console.log('✅ Database already has data, skipping sample data');
        }
    });
}

// Вставка тестовых данных
function insertSampleData() {
    const events = [
        ['Джазовый вечер с Ансамблем "Ностальжи"', '2024-12-15 19:00:00', 'Незабываемый вечер классического джаза', 'jazz.jpg'],
        ['Стендап шоу "Смех до слёз"', '2024-12-20 20:00:00', 'Топовые комики страны в одном шоу', 'comedy.jpg'],
        ['Рок-фестиваль "Осенний гром"', '2024-12-25 18:00:00', 'Целый день живой музыки', 'rock.jpg']
    ];
    
    let eventsInserted = 0;
    
    events.forEach(event => {
        db.run(
            'INSERT INTO events (name, date, description, image_url) VALUES (?, ?, ?, ?)',
            event,
            function(err) {
                if (err) {
                    console.error('Error inserting event:', err);
                } else {
                    eventsInserted++;
                    console.log(`✅ Event created with ID: ${this.lastID}`);
                    
                    // Создаем места для этого мероприятия
                    createSeatsForEvent(this.lastID);
                }
                
                // Когда все события вставлены
                if (eventsInserted === events.length) {
                    console.log('✅ All sample data inserted');
                }
            }
        );
    });
}

// Создание мест для мероприятия
function createSeatsForEvent(eventId) {
    console.log(`🔄 Creating seats for event ${eventId}...`);
    
    const rows = ['A', 'B', 'C', 'D'];
    let seatsCreated = 0;
    const totalSeats = rows.length * 6; // 4 ряда по 6 мест
    
    rows.forEach(row => {
        for (let i = 1; i <= 6; i++) {
            const isVip = row === 'A' || row === 'B';
            const price = isVip ? 2500 : 1500;
            const category = isVip ? 'vip' : 'standard';
            
            db.run(
                'INSERT INTO seats (event_id, seat_label, price, category) VALUES (?, ?, ?, ?)',
                [eventId, `${row}${i}`, price, category],
                function(err) {
                    if (err) {
                        console.error('Error creating seat:', err);
                    } else {
                        seatsCreated++;
                    }
                    
                    if (seatsCreated === totalSeats) {
                        console.log(`✅ All seats created for event ${eventId}`);
                    }
                }
            );
        }
    });
}
// API Routes
app.get('/api/events', (req, res) => {
    db.all('SELECT * FROM events ORDER BY date', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});
// Middleware для трекинга посещений
app.use((req, res, next) => {
    // Трекаем только основные страницы, не API и не статику
    if (req.path === '/' || req.path === '/verify.html' || req.path === '/admin') {
        db.run(
            'INSERT INTO site_stats (page, user_agent) VALUES (?, ?)',
            [req.path, req.get('User-Agent')],
            (err) => {
                if (err) console.error('Stats tracking error:', err);
            }
        );
    }
    next();
});
// API для получения статистики
app.get('/api/admin/stats', (req, res) => {
    // Общее количество посещений
    db.get('SELECT COUNT(*) as total FROM site_stats', (err, totalRow) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Посещения по страницам
        db.all(`
            SELECT page, COUNT(*) as count 
            FROM site_stats 
            GROUP BY page 
            ORDER BY count DESC
        `, (err, pageStats) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Последние 10 посещений
            db.all(`
                SELECT page, visit_time 
                FROM site_stats 
                ORDER BY visit_time DESC 
                LIMIT 10
            `, (err, recentVisits) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                res.json({
                    totalVisits: totalRow.total,
                    pageStats: pageStats,
                    recentVisits: recentVisits
                });
            });
        });
    });
});
app.get('/api/seats/event/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    db.all(
        'SELECT * FROM seats WHERE event_id = ? ORDER BY seat_label',
        [eventId],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

app.post('/api/book', (req, res) => {
    const { eventId, seats, customer } = req.body;
    
    if (!seats || seats.length === 0) {
        return res.status(400).json({ error: 'No seats selected' });
    }
    
    // Рассчитываем общую стоимость
    const placeholders = seats.map(() => '?').join(',');
    db.all(
        `SELECT SUM(price) as total FROM seats WHERE seat_label IN (${placeholders})`,
        seats,
        (err, result) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const total = result[0].total;
            const bookingId = 'B' + Date.now();
            
            // Создаем билет
            db.run(
                `INSERT INTO tickets (id, event_id, seat_labels, customer_name, customer_email, customer_phone, total_amount, booking_time) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [bookingId, eventId, seats.join(','), customer.name, customer.email, customer.phone, total],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    // Помечаем места как занятые
                    seats.forEach(seat => {
                        db.run(
                            'UPDATE seats SET status = "occupied" WHERE seat_label = ? AND event_id = ?',
                            [seat, eventId]
                        );
                    });
                    
                    res.json({
                        success: true,
                        bookingId: bookingId,
                        total: total,
                        message: 'Booking successful!'
                    });
                }
            );
        }
    );
});
// Получить одно мероприятие по ID
app.get('/api/events/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    
    console.log('📖 Загружаем мероприятие ID:', eventId);
    
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, row) => {
        if (err) {
            console.error('❌ Error fetching event:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            console.log('❌ Мероприятие не найдено:', eventId);
            res.status(404).json({ error: 'Мероприятие не найдено' });
            return;
        }
        
        console.log('✅ Мероприятие найдено:', row.name);
        res.json(row);
    });
});
// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});
// API для проверки билета по ID
app.get('/api/ticket/:ticketId', (req, res) => {
    const ticketId = req.params.ticketId;
    
    console.log('🔍 Проверяем билет:', ticketId);
    
    db.get(`
        SELECT t.*, e.name as event_name, e.date as event_date 
        FROM tickets t 
        LEFT JOIN events e ON t.event_id = e.id 
        WHERE t.id = ?
    `, [ticketId], (err, ticket) => {
        if (err) {
            console.error('❌ Database error:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!ticket) {
            console.log('❌ Билет не найден:', ticketId);
            res.status(404).json({ 
                valid: false, 
                message: 'Билет не найден' 
            });
            return;
        }
        
        console.log('✅ Билет найден, статус:', ticket.status);
        
        res.json({
            valid: true,
            ticket: {
                id: ticket.id,
                event: ticket.event_name,
                eventDate: ticket.event_date,
                customer: ticket.customer_name,
                seats: ticket.seat_labels,
                total: ticket.total_amount,
                bookingTime: ticket.booking_time,
                status: ticket.status // ВАЖНО: возвращаем статус!
            }
        });
    });
});

// API для отметки билета как использованного - ИСПРАВЛЕННАЯ ВЕРСИЯ
app.post('/api/ticket/:ticketId/use', (req, res) => {
    const ticketId = req.params.ticketId;
    
    console.log('🔄 Отмечаем билет как использованный:', ticketId);
    
    // 1. Сначала обновляем статус
    db.run(
        'UPDATE tickets SET status = "used" WHERE id = ?',
        [ticketId],
        function(err) {
            if (err) {
                console.error('❌ Database error:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Билет не найден' });
                return;
            }
            
            console.log('✅ Билет отмечен как использованный, изменений:', this.changes);
            
            // 2. Затем получаем ОБНОВЛЕННЫЕ данные билета
            db.get(`
                SELECT t.*, e.name as event_name, e.date as event_date 
                FROM tickets t 
                LEFT JOIN events e ON t.event_id = e.id 
                WHERE t.id = ?
            `, [ticketId], (err, ticket) => {
                if (err) {
                    console.error('❌ Error fetching updated ticket:', err);
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                if (!ticket) {
                    res.status(404).json({ error: 'Билет не найден после обновления' });
                    return;
                }
                
                console.log('📋 Обновленный статус билета:', ticket.status);
                
                // 3. Возвращаем обновленные данные
                res.json({
                    success: true,
                    ticket: {
                        id: ticket.id,
                        event: ticket.event_name,
                        eventDate: ticket.event_date,
                        customer: ticket.customer_name,
                        seats: ticket.seat_labels,
                        total: ticket.total_amount,
                        bookingTime: ticket.booking_time,
                        status: ticket.status // ВАЖНО: возвращаем статус!
                    },
                    message: 'Билет отмечен как использованный'
                });
            });
        }
    );
});
app.get('/verify.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/verify.html'));
});
// ==================== АДМИН РОУТЫ ====================

// Получить все бронирования для админки
app.get('/api/admin/bookings', (req, res) => {
    db.all(`
        SELECT t.*, e.name as event_name, e.date as event_date 
        FROM tickets t 
        LEFT JOIN events e ON t.event_id = e.id 
        ORDER BY t.booking_time DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить все мероприятия для админки
app.get('/api/admin/events', (req, res) => {
    db.all(`
        SELECT e.*, 
               (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) as tickets_sold,
               (SELECT SUM(t.total_amount) FROM tickets t WHERE t.event_id = e.id) as total_revenue
        FROM events e 
        ORDER BY e.date DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Создать новое мероприятие
app.post('/api/admin/events', (req, res) => {
    const { name, date, description, image_url, venue, duration } = req.body;
    
    console.log('🔄 Создаем мероприятие:', { name, date, description, image_url, venue, duration });
    
    if (!name || !date) {
        return res.status(400).json({ error: 'Название и дата обязательны' });
    }
    
    // ОБРАБОТКА ИЗОБРАЖЕНИЯ: добавляем путь если нужно
    let finalImageUrl = image_url;
    if (image_url && image_url !== 'default.jpg') {
        // Если указано просто имя файла, добавляем путь
        if (!image_url.includes('/')) {
            finalImageUrl = image_url; // Просто имя файла
        }
        // Если указан полный путь, оставляем как есть (для обратной совместимости)
    } else {
        finalImageUrl = 'default.jpg';
    }
    
    db.run(
        'INSERT INTO events (name, date, description, image_url) VALUES (?, ?, ?, ?)',
        [name, date, description, finalImageUrl],
        function(err) {
            if (err) {
                console.error('❌ Error creating event:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            
            const eventId = this.lastID;
            console.log('✅ Мероприятие создано с ID:', eventId);
            
            // Автоматически создаем места для нового мероприятия
            createSeatsForEvent(eventId);
            
            res.json({ 
                success: true, 
                eventId: eventId,
                message: 'Мероприятие создано' 
            });
        }
    );
    
    function createSeatsForEvent(eventId) {
        const rows = ['A', 'B', 'C', 'D'];
        console.log('🔄 Создаем места для мероприятия', eventId);
        
        rows.forEach(row => {
            const seatsInRow = 6;
            for (let i = 1; i <= seatsInRow; i++) {
                const isVip = row === 'A' || row === 'B';
                const price = isVip ? 2500 : 1500;
                const category = isVip ? 'vip' : 'standard';
                
                db.run(
                    'INSERT INTO seats (event_id, seat_label, price, category) VALUES (?, ?, ?, ?)',
                    [eventId, `${row}${i}`, price, category],
                    function(err) {
                        if (err) {
                            console.error('❌ Error creating seat:', err);
                        }
                    }
                );
            }
        });
        console.log('✅ Места созданы для мероприятия', eventId);
    }
});

// Удалить мероприятие
app.delete('/api/admin/events/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    
    console.log('🔄 Удаляем мероприятие:', eventId);
    
    db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
        if (err) {
            console.error('❌ Error deleting event:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Мероприятие не найдено' });
            return;
        }
        
        // Также удаляем связанные места
        db.run('DELETE FROM seats WHERE event_id = ?', [eventId]);
        
        console.log('✅ Мероприятие удалено:', eventId);
        res.json({ 
            success: true, 
            message: 'Мероприятие удалено' 
        });
    });
});

// Статистика для дашборда
app.get('/api/admin/stats', (req, res) => {
    db.all(`
        SELECT 
            (SELECT COUNT(*) FROM tickets) as total_bookings,
            (SELECT SUM(total_amount) FROM tickets) as total_revenue,
            (SELECT COUNT(*) FROM events) as total_events,
            (SELECT COUNT(*) FROM tickets WHERE status = 'used') as used_tickets
    `, (err, rows) => {
        if (err) {
            console.error('❌ Error getting stats:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows[0]);
    });
});
// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Serve admin.js
app.get('/admin.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.js'));
});
// Управление местами мероприятия
app.get('/api/admin/events/:eventId/seats', (req, res) => {
    const eventId = req.params.eventId;
    
    db.all(`
        SELECT * FROM seats 
        WHERE event_id = ? 
        ORDER BY seat_label
    `, [eventId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});
// Обновить место
app.put('/api/admin/seats/:seatId', (req, res) => {
    const seatId = req.params.seatId;
    const { price, category, status } = req.body;
    
    db.run(
        'UPDATE seats SET price = ?, category = ?, status = ? WHERE id = ?',
        [price, category, status, seatId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Место не найдено' });
                return;
            }
            
            res.json({ 
                success: true, 
                message: 'Место обновлено' 
            });
        }
    );
});
// Создание заказа для оплаты
// ==================== ПЛАТЕЖНЫЕ РОУТЫ ====================
// Создание заказа для оплаты - С ОТЛАДКОЙ
app.post('/api/create-payment', (req, res) => {
    const { eventId, seats, customer, total } = req.body;
    
    console.log('💰 Создаем платеж для:', { 
        eventId, 
        seats, 
        customer: customer, // ВАЖНО: выводим объект customer
        total 
    });
    
    if (!seats || seats.length === 0) {
        return res.status(400).json({ error: 'No seats selected' });
    }

    const bookingId = 'B' + Date.now();
    const paymentId = 'P' + Date.now();
    
    // Рассчитываем время истечения (30 минут)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Проверяем что customer содержит нужные поля
    console.log('👤 Данные покупателя:', {
        name: customer.name,
        email: customer.email, 
        phone: customer.phone
    });

    // Сохраняем в БД
    db.run(
        `INSERT INTO pending_bookings 
         (payment_id, booking_id, event_id, seat_labels, customer_name, customer_email, customer_phone, total_amount, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            paymentId, 
            bookingId, 
            eventId, 
            seats.join(','), 
            customer.name || 'Не указано',
            customer.email || 'Не указано',
            customer.phone || 'Не указано',
            total, 
            expiresAt
        ],
        function(err) {
            if (err) {
                console.error('❌ Error creating pending booking:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            
            console.log('✅ Pending booking created:', paymentId);
            
            res.json({
                success: true,
                paymentId: paymentId,
                bookingId: bookingId,
                total: total,
                paymentUrl: `https://www.tinkoff.ru/rm/r_uofdonvrKc.jQDChgrcqD/aqsut828?amount=${total}`,
                message: 'Перейдите по ссылке для оплаты'
            });
        }
    );
});

// Подтверждение оплаты - С ОТЛАДКОЙ
app.post('/api/confirm-payment', (req, res) => {
    const { paymentId } = req.body;
    
    console.log('🔄 Подтверждаем оплату:', paymentId);
    
    // Проверяем существование и не истекло ли время
    db.get(
        `SELECT * FROM pending_bookings 
         WHERE payment_id = ? AND datetime(expires_at) > datetime('now')`,
        [paymentId],
        (err, pendingBooking) => {
            if (err) {
                console.error('❌ Database error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            if (!pendingBooking) {
                return res.status(404).json({ 
                    error: 'Бронирование не найдено или время оплаты истекло' 
                });
            }

            console.log('📋 Данные из pending_bookings:', pendingBooking);
            
            const { booking_id, event_id, seat_labels, customer_name, customer_email, customer_phone, total_amount } = pendingBooking;

            // Создаем постоянное бронирование
            db.run(
                `INSERT INTO tickets (id, event_id, seat_labels, customer_name, customer_email, customer_phone, total_amount, booking_time, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'active')`,
                [booking_id, event_id, seat_labels, customer_name, customer_email, customer_phone, total_amount],
                function(err) {
                    if (err) {
                        console.error('❌ Error creating ticket:', err);
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    // Помечаем места как занятые
                    const seats = seat_labels.split(',');
                    seats.forEach(seat => {
                        db.run(
                            'UPDATE seats SET status = "occupied" WHERE seat_label = ? AND event_id = ?',
                            [seat, event_id]
                        );
                    });

                    // Удаляем из pending_bookings
                    db.run('DELETE FROM pending_bookings WHERE payment_id = ?', [paymentId]);
                    
                    console.log('✅ Бронирование подтверждено:', booking_id);
                    res.json({
                        success: true,
                        bookingId: booking_id,
                        total: total_amount,
                        customerName: customer_name,
                        customerEmail: customer_email,
                        customerPhone: customer_phone
                    });
                }
            );
        }
    );
});
// Массовое создание мест
app.post('/api/admin/events/:eventId/seats/bulk', (req, res) => {
    const eventId = req.params.eventId;
    const { rows, seatsPerRow, basePrice, vipRows } = req.body;
    
    // Удаляем существующие места
    db.run('DELETE FROM seats WHERE event_id = ?', [eventId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Создаем новые места
        let seatsCreated = 0;
        const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        for (let i = 0; i < rows; i++) {
            const row = rowLetters[i];
            const isVip = vipRows.includes(i);
            
            for (let j = 1; j <= seatsPerRow; j++) {
                const price = isVip ? basePrice * 1.5 : basePrice;
                const category = isVip ? 'vip' : 'standard';
                
                db.run(
                    'INSERT INTO seats (event_id, seat_label, price, category, status) VALUES (?, ?, ?, ?, ?)',
                    [eventId, `${row}${j}`, Math.round(price), category, 'free'],
                    function(err) {
                        if (err) {
                            console.error('Error creating seat:', err);
                        } else {
                            seatsCreated++;
                        }
                    }
                );
            }
        }
        
        // Ждем немного чтобы все места успели создатьсь
        setTimeout(() => {
            res.json({ 
                success: true, 
                message: `Создано ${seatsCreated} мест`,
                seatsCreated: seatsCreated
            });
        }, 500);
    });
});
// Запуск сервера
app.listen(PORT, () => {
    console.log('🎭 Usupovo Life Hall Server running!');
    console.log(`📍 Локально: http://localhost:${PORT}`);
    console.log(`📍 В сети: http://192.168.1.75:${PORT}`);
    console.log(`📊 Admin: http://192.168.1.75:${PORT}/admin`);
    console.log(`🔍 Проверка: http://192.168.1.75:${PORT}/verify.html`);
    console.log(`🔗 API: http://localhost:${PORT}/api/events`);
});