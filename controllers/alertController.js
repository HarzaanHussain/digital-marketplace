const pool = require('../config/db');

// @desc    Create a new alert
// @route   POST /api/alerts
// @access  Private
const createAlert = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { alert_type_id, item_id, category_id, price_threshold } = req.body;
    
    if (!alert_type_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide an alert type' });
    }
    
    // Verify alert type exists
    const [alertTypeRows] = await pool.query(
      'SELECT * FROM alert_types WHERE alert_type_id = ?',
      [alert_type_id]
    );
    
    if (alertTypeRows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid alert type' });
    }
    
    const alertType = alertTypeRows[0];
    
    // For Price Drop alerts
    if (alertType.name === 'Price Drop') {
      if (!item_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Item is required for Price Drop alerts' });
      }
      
      // Verify item exists
      const [itemRows] = await pool.query(
        'SELECT * FROM items WHERE item_id = ? AND is_deleted = false',
        [item_id]
      );
      
      if (itemRows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Item not found or no longer available' });
      }
      
      const item = itemRows[0];
      
      // Prevent setting alerts for own items
      if (item.seller_id === req.user.user_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'You cannot set alerts for your own items' });
      }
      
      // Validate price threshold
      if (!price_threshold || parseFloat(price_threshold) <= 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Price threshold must be a positive number' });
      }
      
      // Ensure the threshold is below the current price
      if (parseFloat(price_threshold) >= parseFloat(item.price)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          message: `Price threshold must be below the current price ($${parseFloat(item.price).toFixed(2)})`
        });
      }
    }
    
    // For New Item alerts
    if (alertType.name === 'New Item') {
      if (!category_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Category is required for New Item alerts' });
      }
    }
    
    // Check for existing similar alerts
    let duplicateCheckQuery = 'SELECT * FROM user_alerts WHERE user_id = ? AND alert_type_id = ? AND is_read = false';
    const duplicateCheckParams = [req.user.user_id, alert_type_id];
    
    if (item_id) {
      duplicateCheckQuery += ' AND item_id = ?';
      duplicateCheckParams.push(item_id);
    } else {
      duplicateCheckQuery += ' AND item_id IS NULL';
    }
    
    if (category_id) {
      duplicateCheckQuery += ' AND category_id = ?';
      duplicateCheckParams.push(category_id);
    } else {
      duplicateCheckQuery += ' AND category_id IS NULL';
    }
    
    const [duplicateAlerts] = await pool.query(duplicateCheckQuery, duplicateCheckParams);
    
    if (duplicateAlerts.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You already have this alert set' });
    }
    
    // Create the monitoring alert (NOT a notification)
    const [result] = await pool.query(
      'INSERT INTO user_alerts (user_id, alert_type_id, item_id, category_id, price_threshold, is_read, alert_details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, alert_type_id, item_id || null, category_id || null, price_threshold || null, true, 'Monitoring active']
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to create alert' });
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM user_alerts WHERE alert_id = ?',
      [result.insertId]
    );
    
    await pool.query('COMMIT');
    res.status(201).json(rows[0]);
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user alerts
// @route   GET /api/alerts
// @access  Private
const getUserAlerts = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Only get active alerts (exclude those with items that have been deleted)
    const [rows] = await pool.query(
      `SELECT ua.*, at.name as alert_type_name, 
              i.title as item_title, i.price as item_price, i.thumbnail_path as item_thumbnail,
              c.name as category_name
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       LEFT JOIN items i ON ua.item_id = i.item_id
       LEFT JOIN categories c ON ua.category_id = c.category_id
       WHERE ua.user_id = ?
         AND (i.is_deleted IS NULL OR i.is_deleted = false)
       ORDER BY ua.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.user_id, limit, offset]
    );
    
    // Get total count separately - avoid mixing aggregate and non-aggregate columns
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM user_alerts ua
       LEFT JOIN items i ON ua.item_id = i.item_id
       WHERE ua.user_id = ?
         AND (i.is_deleted IS NULL OR i.is_deleted = false)`,
      [req.user.user_id]
    );
    
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      alerts: rows,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages
      }
    });
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
    await pool.query('START TRANSACTION');
    
    // Get the alert
    const [rows] = await pool.query(
      'SELECT * FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    const alert = rows[0];
    
    // Check if user owns the alert
    if (alert.user_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update the alert
    const [result] = await pool.query(
      'UPDATE user_alerts SET is_read = ? WHERE alert_id = ?',
      [true, req.params.id]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Update failed' });
    }
    
    await pool.query('COMMIT');
    res.json({ message: 'Alert marked as read' });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an alert
// @route   DELETE /api/alerts/:id
// @access  Private
const deleteAlert = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    // Get the alert
    const [rows] = await pool.query(
      'SELECT * FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    const alert = rows[0];
    
    // Check if user owns the alert
    if (alert.user_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Delete the alert
    const [result] = await pool.query(
      'DELETE FROM user_alerts WHERE alert_id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Delete failed' });
    }
    
    await pool.query('COMMIT');
    res.json({ message: 'Alert removed' });
    
  } catch (error) {
    await pool.query('ROLLBACK');
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

// @desc    Mark all alerts as read
// @route   PUT /api/alerts/read-all
// @access  Private
const markAllAlertsAsRead = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const [result] = await pool.query(
      'UPDATE user_alerts SET is_read = ? WHERE user_id = ? AND is_read = ?',
      [true, req.user.user_id, false]
    );
    
    await pool.query('COMMIT');
    res.json({ 
      message: 'All alerts marked as read',
      count: result.affectedRows
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createAlert,
  getUserAlerts,
  markAlertAsRead,
  deleteAlert,
  getAlertTypes,
  markAllAlertsAsRead
};