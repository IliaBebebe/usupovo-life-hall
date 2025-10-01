const express = require('express');
const router = express.Router();
const database = require('../database');

// Получить все места для мероприятия
router.get('/event/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    
    database.db.all(`
        SELECT s.*, 
               CASE 
                   WHEN EXISTS (SELECT 1 FROM tickets t WHERE t.seat_id = s.id AND t.status = 'confirmed') 
                   THEN 'occupied' 
                   ELSE s.status 
               END as actual_status
        FROM seats s 
        WHERE s.event_id = ?
        ORDER BY s.row_label, s.seat_number
    `, [eventId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Забронировать места
router.post('/book', (req, res) => {
    const { eventId, seatIds, customerData } = req.body;
    
    // Начинаем транзакцию
    database.db.serialize(() => {
        // Проверяем, свободны ли места
        const placeholders = seatIds.map(() => '?').join(',');
        database.db.all(`
            SELECT s.* FROM seats s
            LEFT JOIN tickets t ON s.id = t.seat_id AND t.status = 'confirmed'
            WHERE s.id IN (${placeholders}) AND t.id IS NOT NULL
        `, seatIds, (err, occupiedSeats) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (occupiedSeats.length > 0) {
                res.status(400).json({ 
                    error: 'Some seats are already occupied',
                    occupiedSeats: occupiedSeats.map(s => s.seat_label)
                });
                return;
            }
            
            // Создаем билеты
            const bookingId = 'B' + Date.now();
            const totalAmount = 0; // Рассчитаем ниже
            
            seatIds.forEach(seatId => {
                database.db.run(
                    `INSERT INTO tickets (id, event_id, seat_id, customer_name, customer_email, customer_phone, special_requests, total_amount) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [bookingId + '-' + seatId, eventId, seatId, customerData.name, 
                     customerData.email, customerData.phone, customerData.specialRequests, 0]
                );
            });
            
            res.json({ 
                bookingId: bookingId,
                message: 'Seats booked successfully'
            });
        });
    });
});

module.exports = router;