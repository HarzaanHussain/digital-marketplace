const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Helper function to check for alerts when a new item is created
const checkNewItemAlerts = async (itemId, categoryId, sellerId) => {
  try {
    // Find monitoring alerts for this category
    const [alerts] = await pool.query(
      `SELECT ua.user_id, ua.alert_type_id, ua.category_id
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       WHERE ua.category_id = ? 
       AND at.name = 'New Item' 
       AND ua.user_id != ?
       AND ua.alert_details = 'MONITORING'`,
      [categoryId, sellerId]
    );

    // Get item details for notification
    const [itemDetails] = await pool.query(
      `SELECT i.*, c.name as category_name 
       FROM items i 
       JOIN categories c ON i.category_id = c.category_id 
       WHERE i.item_id = ?`,
      [itemId]
    );

    if (itemDetails.length === 0) return;
    const item = itemDetails[0];

    // Create notification alerts for matching users
    for (const alert of alerts) {
      const alertDetails = `New item in ${item.category_name}: "${item.title}" - Price: $${parseFloat(item.price).toFixed(2)}`;

      await pool.query(
        `INSERT INTO user_alerts (user_id, alert_type_id, item_id, category_id, is_read, alert_details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [alert.user_id, alert.alert_type_id, itemId, categoryId, false, alertDetails]
      );
    }
  } catch (error) {
    console.error('Error checking for alerts:', error);
  }
};

// Helper function to check for price drop alerts
// Helper function to check for price drop alerts
const checkPriceDropAlerts = async (itemId, newPrice, sellerId) => {
  try {
    // Find monitoring alerts for this item
    const [alerts] = await pool.query(
      `SELECT ua.user_id, ua.alert_type_id, ua.price_threshold
       FROM user_alerts ua
       JOIN alert_types at ON ua.alert_type_id = at.alert_type_id
       WHERE ua.item_id = ? 
       AND at.name = 'Price Drop' 
       AND ua.user_id != ?
       AND ua.alert_details = 'MONITORING'`,
      [itemId, sellerId]
    );

    // Get item details for notification
    const [itemDetails] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [itemId]
    );

    if (itemDetails.length === 0) return;
    const item = itemDetails[0];

    // Create notification alerts for users where the new price meets their threshold
    for (const alert of alerts) {
      if (alert.price_threshold && parseFloat(newPrice) <= parseFloat(alert.price_threshold)) {
        // Check if we've already sent an alert at or below this price
        const [existingAlerts] = await pool.query(
          `SELECT * FROM user_alerts 
           WHERE user_id = ? 
           AND item_id = ? 
           AND alert_type_id = ? 
           AND alert_details != 'MONITORING'
           ORDER BY created_at DESC
           LIMIT 1`,
          [alert.user_id, itemId, alert.alert_type_id]
        );
        // If no previous alert or the last alert doesn't mention this price, send a new alert
        const shouldSendAlert = existingAlerts.length === 0 ||
          !existingAlerts[0].alert_details.includes(`now costs $${parseFloat(newPrice).toFixed(2)}`);

        if (shouldSendAlert) {
          const alertDetails = `Price drop! "${item.title}" now costs $${parseFloat(newPrice).toFixed(2)} (Your threshold: $${parseFloat(alert.price_threshold).toFixed(2)})`;

          await pool.query(
            `INSERT INTO user_alerts (user_id, alert_type_id, item_id, is_read, price_threshold, alert_details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [alert.user_id, alert.alert_type_id, itemId, false, alert.price_threshold, alertDetails]
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking for price drop alerts:', error);
  }
};

// @desc    Create a new item
// @route   POST /api/items
// @access  Private
const createItem = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');

    const { title, description, price, category_id } = req.body;

    // Enhanced validation
    if (!title || title.trim() === '') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide a valid title' });
    }

    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide a valid price greater than 0' });
    }

    if (!category_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please select a category' });
    }

    // Verify category exists
    const [categoryCheck] = await pool.query(
      'SELECT * FROM categories WHERE category_id = ?',
      [category_id]
    );

    if (categoryCheck.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid category' });
    }

    // Initialize file path variables
    let filePath = ''; // Default to empty string instead of null
    let thumbnailPath = null;

    // Handle file upload if provided
    if (req.files && req.files.file) {
      const file = req.files.file;

      // Validate file size
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_FILE_SIZE) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'File is too large (max 50MB)' });
      }

      // Generate unique filename
      const fileName = `${uuidv4()}${path.extname(file.name)}`;
      filePath = `/uploads/items/${fileName}`;
      const uploadPath = `./public/uploads/items/${fileName}`;

      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/items')) {
        fs.mkdirSync('./public/uploads/items', { recursive: true });
      }

      try {
        // Move file to uploads directory
        await file.mv(uploadPath);
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('File upload error:', error);
        return res.status(500).json({ message: 'File upload failed' });
      }
    }

    // Handle thumbnail if provided
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;

      // Validate it's an image
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!validImageTypes.includes(thumbnail.mimetype)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Thumbnail must be an image file' });
      }

      const thumbnailName = `thumb_${uuidv4()}${path.extname(thumbnail.name)}`;
      thumbnailPath = `/uploads/thumbnails/${thumbnailName}`;
      const thumbnailUploadPath = `./public/uploads/thumbnails/${thumbnailName}`;

      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/thumbnails')) {
        fs.mkdirSync('./public/uploads/thumbnails', { recursive: true });
      }

      try {
        await thumbnail.mv(thumbnailUploadPath);
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Thumbnail upload error:', error);
        return res.status(500).json({ message: 'Thumbnail upload failed' });
      }
    }

    // Insert item into database
    const [result] = await pool.query(
      'INSERT INTO items (seller_id, category_id, title, description, price, file_path, thumbnail_path, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.user_id, category_id, title, description || '', price, filePath, thumbnailPath, false]
    );

    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to create item' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [result.insertId]
    );

    // Check for alerts that match this new item
    await checkNewItemAlerts(result.insertId, category_id, req.user.user_id);

    await pool.query('COMMIT');
    res.status(201).json(rows[0]);

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all items
// @route   GET /api/items
// @access  Public
const getItems = async (req, res) => {
  try {
    const { category, search, seller, page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT i.*, c.name as category_name, u.username as seller_name
      FROM items i
      JOIN categories c ON i.category_id = c.category_id
      JOIN users u ON i.seller_id = u.user_id
      WHERE i.is_deleted = false
    `;

    const queryParams = [];

    // Add additional filters
    if (category) {
      query += ' AND i.category_id = ?';
      queryParams.push(category);
    }

    if (search) {
      query += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (seller) {
      query += ' AND i.seller_id = ?';
      queryParams.push(seller);
    }

    // Get total count for pagination with separate query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM items i
      WHERE i.is_deleted = false
    `;

    // Add filters to count query too
    if (category) {
      countQuery += ' AND i.category_id = ?';
    }

    if (search) {
      countQuery += ' AND (i.title LIKE ? OR i.description LIKE ?)';
    }

    if (seller) {
      countQuery += ' AND i.seller_id = ?';
    }

    const [countResult] = await pool.query(countQuery, queryParams);
    const totalCount = countResult[0].total;

    // Add pagination to main query
    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    const paginatedParams = [...queryParams, parseInt(limit), parseInt(offset)];

    const [rows] = await pool.query(query, paginatedParams);

    res.json({
      items: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
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
    // Validate item ID exists
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

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
       WHERE r.item_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    // Get average rating separately
    const [avgRatingResult] = await pool.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE item_id = ?',
      [req.params.id]
    );

    const avgRating = avgRatingResult[0].avg_rating || 0;

    const item = {
      ...rows[0],
      reviews,
      avg_rating: avgRating
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
    await pool.query('START TRANSACTION');

    const { title, description, price, category_id } = req.body;

    // Get the item
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ? AND is_deleted = false',
      [req.params.id]
    );

    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Item not found or no longer available' });
    }

    const item = rows[0];

    // Check if user is the seller
    if (item.seller_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Validate updated values
    const newTitle = title !== undefined ? title : item.title;
    let newPrice = price !== undefined ? parseFloat(price) : parseFloat(item.price);
    const newCategoryId = category_id !== undefined ? category_id : item.category_id;

    if (newTitle.trim() === '') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Title cannot be empty' });
    }

    if (isNaN(newPrice) || newPrice <= 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Price must be greater than zero' });
    }

    // Check if category exists
    if (category_id) {
      const [categoryCheck] = await pool.query(
        'SELECT * FROM categories WHERE category_id = ?',
        [category_id]
      );

      if (categoryCheck.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    // Check if price was lowered for price drop alerts
    const oldPrice = parseFloat(item.price);

    if (newPrice < oldPrice) {
      await checkPriceDropAlerts(req.params.id, newPrice, req.user.user_id);
    }

    // Handle new file upload if provided
    let filePath = item.file_path;
    if (req.files && req.files.file) {
      const file = req.files.file;

      // Validate file size
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_FILE_SIZE) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'File is too large (max 50MB)' });
      }

      // Delete old file if it exists
      if (item.file_path) {
        const oldFilePath = `./public${item.file_path}`;
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Generate unique filename
      const fileName = `${uuidv4()}${path.extname(file.name)}`;
      filePath = `/uploads/items/${fileName}`;
      const uploadPath = `./public/uploads/items/${fileName}`;

      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/items')) {
        fs.mkdirSync('./public/uploads/items', { recursive: true });
      }

      try {
        // Move file to uploads directory
        await file.mv(uploadPath);
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('File upload error:', error);
        return res.status(500).json({ message: 'File upload failed' });
      }
    }

    // Handle new thumbnail if provided
    let thumbnailPath = item.thumbnail_path;
    if (req.files && req.files.thumbnail) {
      const thumbnail = req.files.thumbnail;

      // Validate it's an image
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!validImageTypes.includes(thumbnail.mimetype)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Thumbnail must be an image file' });
      }

      // Delete old thumbnail if it exists
      if (item.thumbnail_path) {
        const oldThumbnailPath = `./public${item.thumbnail_path}`;
        if (fs.existsSync(oldThumbnailPath)) {
          fs.unlinkSync(oldThumbnailPath);
        }
      }

      const thumbnailName = `thumb_${uuidv4()}${path.extname(thumbnail.name)}`;
      thumbnailPath = `/uploads/thumbnails/${thumbnailName}`;
      const thumbnailUploadPath = `./public/uploads/thumbnails/${thumbnailName}`;

      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/thumbnails')) {
        fs.mkdirSync('./public/uploads/thumbnails', { recursive: true });
      }

      try {
        await thumbnail.mv(thumbnailUploadPath);
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Thumbnail upload error:', error);
        return res.status(500).json({ message: 'Thumbnail upload failed' });
      }
    }

    // Update the item
    const [result] = await pool.query(
      'UPDATE items SET title = ?, description = ?, price = ?, category_id = ?, file_path = ?, thumbnail_path = ? WHERE item_id = ?',
      [newTitle, description || item.description, newPrice, newCategoryId, filePath, thumbnailPath, req.params.id]
    );

    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Update failed' });
    }

    const [updatedRows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [req.params.id]
    );

    await pool.query('COMMIT');
    res.json(updatedRows[0]);

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an item
// @route   DELETE /api/items/:id
// @access  Private
const deleteItem = async (req, res) => {
  try {
    // Start a database transaction
    await pool.query('START TRANSACTION');

    // Get the item
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Item not found' });
    }

    const item = rows[0];

    // Check if user is the seller
    if (item.seller_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Check if item has been purchased
    const [purchaseRows] = await pool.query(
      'SELECT * FROM purchases WHERE item_id = ?',
      [req.params.id]
    );
    await pool.query('DELETE FROM user_alerts WHERE item_id = ?', [req.params.id]);
    await pool.query('DELETE FROM reviews WHERE item_id = ?', [req.params.id]);
    if (purchaseRows.length > 0) {
      await pool.query(
        'UPDATE items SET is_deleted = true WHERE item_id = ?',
        [req.params.id]
      );

    } else {


      // Delete the file from filesystem if no purchases
      if (item.file_path) {
        const filePath = `./public${item.file_path}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Delete thumbnail
      if (item.thumbnail_path) {
        const thumbnailPath = `./public${item.thumbnail_path}`;
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }

      // Actually delete the item since no one purchased it
      await pool.query(
        'DELETE FROM items WHERE item_id = ?',
        [req.params.id]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'Item removed' });

  } catch (error) {
    await pool.query('ROLLBACK');
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