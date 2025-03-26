const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// @desc    Create a new item
// @route   POST /api/items
// @access  Private
const createItem = async (req, res) => {
  try {
    const { title, description, price, category_id } = req.body;
    
    if (!title || !price || !category_id) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Initialize file path variables
    let filePath = '';  // Default to empty string instead of null
    let thumbnailPath = null;
    
    // Handle file upload if provided
    if (req.files && req.files.file) {
      const file = req.files.file;
      
      // Generate unique filename
      const fileName = `${uuidv4()}${path.extname(file.name)}`;
      filePath = `/uploads/items/${fileName}`;
      const uploadPath = `./public/uploads/items/${fileName}`;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/items')) {
        fs.mkdirSync('./public/uploads/items', { recursive: true });
      }
      
      // Move file to uploads directory
      await file.mv(uploadPath);
    }
    
    // Handle thumbnail if provided
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;
      const thumbnailName = `thumb_${uuidv4()}${path.extname(thumbnail.name)}`;
      thumbnailPath = `/uploads/thumbnails/${thumbnailName}`;
      const thumbnailUploadPath = `./public/uploads/thumbnails/${thumbnailName}`;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/thumbnails')) {
        fs.mkdirSync('./public/uploads/thumbnails', { recursive: true });
      }
      
      await thumbnail.mv(thumbnailUploadPath);
    }
    
    // Insert item into database
    const [result] = await pool.query(
      'INSERT INTO items (seller_id, category_id, title, description, price, file_path, thumbnail_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, category_id, title, description, price, filePath, thumbnailPath]
    );
    
    if (result.affectedRows === 1) {
      const [rows] = await pool.query(
        'SELECT * FROM items WHERE item_id = ?',
        [result.insertId]
      );
      
      // Check for alerts that match this new item
      await checkNewItemAlerts(result.insertId, category_id);
      
      res.status(201).json(rows[0]);
    } else {
      res.status(400).json({ message: 'Failed to create item' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to check for alerts when a new item is created
const checkNewItemAlerts = async (itemId, categoryId) => {
  try {
    // Find users who have alerts for this category
    const [alerts] = await pool.query(
      `SELECT ua.alert_id, ua.user_id, ua.alert_type_id, ua.category_id, at.name as alert_type_name
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       WHERE ua.category_id = ? AND at.name = 'New Item'`,
      [categoryId]
    );
    
    // Get item details
    const [itemDetails] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [itemId]
    );
    
    if (itemDetails.length === 0) return;
    const item = itemDetails[0];
    
    // Create alerts for matching users
    for (const alert of alerts) {
      await pool.query(
        `INSERT INTO user_alerts (user_id, alert_type_id, item_id, category_id, is_read)
         VALUES (?, ?, ?, ?, ?)`,
        [alert.user_id, alert.alert_type_id, itemId, categoryId, false]
      );
    }
  } catch (error) {
    console.error('Error checking for alerts:', error);
  }
};

// @desc    Get all items
// @route   GET /api/items
// @access  Public
const getItems = async (req, res) => {
  try {
    const { category, search, seller } = req.query;
    
    let query = `
      SELECT i.*, c.name as category_name, u.username as seller_name
      FROM items i
      JOIN categories c ON i.category_id = c.category_id
      JOIN users u ON i.seller_id = u.user_id
    `;
    
    const queryParams = [];
    
    // Add WHERE clause if filters are provided
    if (category || search || seller) {
      query += ' WHERE';
      
      if (category) {
        query += ' i.category_id = ?';
        queryParams.push(category);
      }
      
      if (search) {
        if (queryParams.length > 0) {
          query += ' AND';
        }
        query += ' (i.title LIKE ? OR i.description LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`);
      }
      
      if (seller) {
        if (queryParams.length > 0) {
          query += ' AND';
        }
        query += ' i.seller_id = ?';
        queryParams.push(seller);
      }
    }
    
    query += ' ORDER BY i.created_at DESC';
    
    const [rows] = await pool.query(query, queryParams);
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a single item
// @route   GET /api/items/:id
// @access  Public
const getItemById = async (req, res) => {
  try {
    console.log('Fetching item with ID:', req.params.id);
    
    const [rows] = await pool.query(
      `SELECT i.*, c.name as category_name, u.username as seller_name, u.user_id as seller_id
       FROM items i
       JOIN categories c ON i.category_id = c.category_id
       JOIN users u ON i.seller_id = u.user_id
       WHERE i.item_id = ?`,
      [req.params.id]
    );
    
    console.log('Query result rows:', rows.length);
    
    if (rows.length === 0) {
      console.log('Item not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Get reviews for the item
    const [reviews] = await pool.query(
      `SELECT r.*, u.username as reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.user_id
       WHERE r.item_id = ?`,
      [req.params.id]
    );
    
    const item = {
      ...rows[0],
      reviews
    };
    
    console.log('Sending item data to client');
    res.json(item);
  } catch (error) {
    console.error('Error in getItemById:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update an item
// @route   PUT /api/items/:id
// @access  Private
const updateItem = async (req, res) => {
  try {
    const { title, description, price, category_id } = req.body;
    
    // Get the item
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const item = rows[0];
    
    // Check if user is the seller
    if (item.seller_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Check if price was lowered for price drop alerts
    const oldPrice = parseFloat(item.price);
    const newPrice = price ? parseFloat(price) : oldPrice;
    
    if (newPrice < oldPrice) {
      await checkPriceDropAlerts(req.params.id, newPrice);
    }
    
    // Update the item
    const [result] = await pool.query(
      'UPDATE items SET title = ?, description = ?, price = ?, category_id = ? WHERE item_id = ?',
      [
        title || item.title,
        description || item.description,
        newPrice,
        category_id || item.category_id,
        req.params.id
      ]
    );
    
    if (result.affectedRows === 1) {
      const [updatedRows] = await pool.query(
        'SELECT * FROM items WHERE item_id = ?',
        [req.params.id]
      );
      
      res.json(updatedRows[0]);
    } else {
      res.status(400).json({ message: 'Update failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to check for price drop alerts
const checkPriceDropAlerts = async (itemId, newPrice) => {
  try {
    // Find users who have price drop alerts for this item
    const [alerts] = await pool.query(
      `SELECT ua.alert_id, ua.user_id, ua.alert_type_id, ua.price_threshold
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       WHERE ua.item_id = ? AND at.name = 'Price Drop'`,
      [itemId]
    );
    
    // Create alerts for users where the new price is below their threshold
    for (const alert of alerts) {
      if (alert.price_threshold && newPrice <= alert.price_threshold) {
        await pool.query(
          `INSERT INTO user_alerts (user_id, alert_type_id, item_id, is_read)
           VALUES (?, ?, ?, ?)`,
          [alert.user_id, alert.alert_type_id, itemId, false]
        );
      }
    }
  } catch (error) {
    console.error('Error checking for price drop alerts:', error);
  }
};

// @desc    Delete an item
// @route   DELETE /api/items/:id
// @access  Private
const deleteItem = async (req, res) => {
  try {
    // Get the item
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const item = rows[0];
    
    // Check if user is the seller
    if (item.seller_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Delete the file from filesystem
    if (item.file_path) {
      const filePath = `./public${item.file_path}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete the thumbnail from filesystem
    if (item.thumbnail_path) {
      const thumbnailPath = `./public${item.thumbnail_path}`;
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    // Delete the item from database
    const [result] = await pool.query(
      'DELETE FROM items WHERE item_id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 1) {
      res.json({ message: 'Item removed' });
    } else {
      res.status(400).json({ message: 'Delete failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
};