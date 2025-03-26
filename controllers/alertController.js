const pool = require('../config/db');

// @desc    Create a new alert
// @route   POST /api/alerts
// @access  Private
const createAlert = async (req, res) => {
  try {
    const { alert_type_id, item_id, category_id, price_threshold } = req.body;
    
    if (!alert_type_id) {
      return res.status(400).json({ message: 'Please provide an alert type' });
    }
    
    // At least one of item_id or category_id must be provided
    if (!item_id && !category_id) {
      return res.status(400).json({ message: 'Please provide either an item or a category' });
    }
    
    // Insert alert into database
    const [result] = await pool.query(
      'INSERT INTO user_alerts (user_id, alert_type_id, item_id, category_id, price_threshold) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, alert_type_id, item_id || null, category_id || null, price_threshold || null]
    );
    
    if (result.affectedRows === 1) {
      const [rows] = await pool.query(
        'SELECT * FROM user_alerts WHERE alert_id = ?',
        [result.insertId]
      );
      
      res.status(201).json(rows[0]);
    } else {
      res.status(400).json({ message: 'Failed to create alert' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user alerts
// @route   GET /api/alerts
// @access  Private
const getUserAlerts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ua.*, at.name as alert_type_name, i.title as item_title, c.name as category_name
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       LEFT JOIN items i ON ua.item_id = i.item_id
       LEFT JOIN categories c ON ua.category_id = c.category_id
       WHERE ua.user_id = ?
       ORDER BY ua.created_at DESC`,
      [req.user.user_id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private
const markAlertAsRead = async (req, res) => {
  try {
    // Get the alert
    const [rows] = await pool.query(
      'SELECT * FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    const alert = rows[0];
    
    // Check if user owns the alert
    if (alert.user_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update the alert
    const [result] = await pool.query(
      'UPDATE user_alerts SET is_read = ? WHERE alert_id = ?',
      [true, req.params.id]
    );
    
    if (result.affectedRows === 1) {
      res.json({ message: 'Alert marked as read' });
    } else {
      res.status(400).json({ message: 'Update failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an alert
// @route   DELETE /api/alerts/:id
// @access  Private
const deleteAlert = async (req, res) => {
  try {
    // Get the alert
    const [rows] = await pool.query(
      'SELECT * FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    const alert = rows[0];
    
    // Check if user owns the alert
    if (alert.user_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Delete the alert
    const [result] = await pool.query(
      'DELETE FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 1) {
      res.json({ message: 'Alert removed' });
    } else {
      res.status(400).json({ message: 'Delete failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get alert types
// @route   GET /api/alerts/types
// @access  Public
const getAlertTypes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM alert_types');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createAlert,
  getUserAlerts,
  markAlertAsRead,
  deleteAlert,
  getAlertTypes
};