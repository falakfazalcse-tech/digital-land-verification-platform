const db = require('../db');

/**
 * Generates a unique ID in format: LD-[ROLE]-[YEAR]-[SEQUENCE]
 * Example: LD-BUY-2026-0001
 */
async function generateCustomUserId(role) {
    const rolePrefixes = {
        buyer: 'BUY',
        seller: 'SEL',
        officer: 'OFF'
    };

    const prefix = rolePrefixes[role.toLowerCase()] || 'USR';
    const year = new Date().getFullYear();
    const pattern = `LD-${prefix}-${year}-%`;

    // Fetch highest existing sequential ID for this role & year
    const [rows] = await db.query(
        'SELECT custom_id FROM users WHERE custom_id LIKE ? ORDER BY id DESC LIMIT 1',
        [pattern]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastId = rows[0].custom_id;
        const parts = lastId.split('-');
        const lastSequence = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSequence)) {
            nextNumber = lastSequence + 1;
        }
    }

    // Pad sequence number to 4 digits (e.g., 1 -> 0001)
    const paddedSequence = String(nextNumber).padStart(4, '0');
    return `LD-${prefix}-${year}-${paddedSequence}`;
}

module.exports = generateCustomUserId;