const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

class Database {
    constructor() {
        this.db = null;
    }

    // Инициализация базы данных
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    // Создание таблиц
    async createTables() {
        return new Promise((resolve, reject) => {
            // Таблица мероприятий
            const eventsTable = `
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    date DATETIME NOT NULL,
                    description TEXT,
                    image_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Таблица мест
            const seatsTable = `
                CREATE TABLE IF NOT EXISTS seats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER,
                    row_label TEXT NOT NULL,
                    seat_number INTEGER NOT NULL,
                    seat_label TEXT NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    category TEXT DEFAULT 'standard',
                    status TEXT DEFAULT 'free',
                    FOREIGN KEY (event_id) REFERENCES events(id),
                    UNIQUE(event_id, seat_label)
                )
            `;

            // Таблица билетов
            const ticketsTable = `
                CREATE TABLE IF NOT EXISTS tickets (
                    id TEXT PRIMARY KEY,
                    event_id INTEGER,
                    seat_id INTEGER,
                    customer_name TEXT NOT NULL,
                    customer_email TEXT NOT NULL,
                    customer_phone TEXT,
                    special_requests TEXT,
                    total_amount DECIMAL(10,2) NOT NULL,
                    booking_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'confirmed',
                    FOREIGN KEY (event_id) REFERENCES events(id),
                    FOREIGN KEY (seat_id) REFERENCES seats(id)
                )
            `;

            this.db.exec(`
                ${eventsTable};
                ${seatsTable};
                ${ticketsTable};
            `, (err) => {
                if (err) {
                    console.error('❌ Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('✅ Database tables created/verified');
                    this.seedInitialData().then(resolve).catch(resolve);
                }
            });
        });
    }

    // Заполнение начальными данными
    async seedInitialData() {
        // Проверяем, есть ли уже мероприятия
        this.db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
            if (err) return;

            if (row.count === 0) {
                console.log('📝 Seeding initial data...');
                this.createSampleEvents();
            }
        });
    }

    // Создание примеров мероприятий
    async createSampleEvents() {
        const events = [
            {
                name: "Джазовый вечер с Ансамблем 'Ностальжи'",
                date: "2024-12-15 19:00:00",
                description: "Незабываемый вечер классического джаза в исполнении лучших музыкантов города",
                image_url: "jazz.jpg"
            },
            {
                name: "Стендап шоу 'Смех до слёз'",
                date: "2024-12-20 20:00:00", 
                description: "Топовые комики страны в одном шоу. Острый юмор и актуальные темы. 18+",
                image_url: "comedy.jpg"
            },
            {
                name: "Рок-фестиваль 'Осенний гром'",
                date: "2024-12-25 18:00:00",
                description: "Целый день живой музыки от лучших рок-групп региона",
                image_url: "rock.jpg"
            }
        ];

        events.forEach((event, index) => {
            this.db.run(
                `INSERT INTO events (name, date, description, image_url) VALUES (?, ?, ?, ?)`,
                [event.name, event.date, event.description, event.image_url],
                function(err) {
                    if (err) {
                        console.error('Error inserting event:', err);
                    } else {
                        console.log(`✅ Event created with ID: ${this.lastID}`);
                        // Создаем места для этого мероприятия
                        createSeatsForEvent(this.lastID);
                    }
                }
            );

            const createSeatsForEvent = (eventId) => {
                const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
                rows.forEach(row => {
                    const seatsInRow = row === 'A' ? 6 : 8;
                    for (let i = 1; i <= seatsInRow; i++) {
                        const isVip = row === 'A' || row === 'B';
                        const price = isVip ? 2500 : 1500;
                        const category = isVip ? 'vip' : 'standard';
                        
                        this.db.run(
                            `INSERT INTO seats (event_id, row_label, seat_number, seat_label, price, category) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [eventId, row, i, `${row}${i}`, price, category]
                        );
                    }
                });
            };
        });
    }

    // Закрытие соединения с БД
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new Database();