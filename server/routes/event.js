const express = require('express');
const router = express.Router();
const database = require('../database');

// Получить все мероприятия
router.get('/', (req, res) => {
    database.db.all(`
        SELECT * FROM events 
        WHERE date > datetime('now') 
        ORDER BY date ASC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить мероприятие по ID
router.get('/:id', (req, res) => {
    const eventId = req.params.id;
    
    database.db.get(`
        SELECT * FROM events WHERE id = ?
    `, [eventId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }
        res.json(row);
    });
});

// Создать новое мероприятие
router.post('/', (req, res) => {
    const { name, date, description, image_url } = req.body;
    
    database.db.run(
        `INSERT INTO events (name, date, description, image_url) VALUES (?, ?, ?, ?)`,
        [name, date, description, image_url],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                id: this.lastID,
                message: 'Event created successfully'
            });
        }
    );
});

module.exports = router;