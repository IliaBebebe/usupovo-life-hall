const express = require('express');
const router = express.Router();
const database = require('../database');

// Получить все билеты
router.get('/', (req, res) => {
    database.db.all(`
        SELECT t.*, e.name as event_name, s.seat_label, s.price
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN seats s ON t.seat_id = s.id
        ORDER BY t.booking_time DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить билет по ID
router.get('/:id', (req, res) => {
    const ticketId = req.params.id;
    
    database.db.get(`
        SELECT t.*, e.name as event_name, e.date as event_date, s.seat_label, s.price
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        JOIN seats s ON t.seat_id = s.id
        WHERE t.id = ?
    `, [ticketId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Ticket not found' });
            return;
        }
        res.json(row);
    });
});

module.exports = router;