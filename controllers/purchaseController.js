const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

// @desc    Create a new purchase
// @route   POST /api/purchases
// @access  Private
const createPurchase = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { item_id } = req.body;
    
    if (!item_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide an item ID' });
    }
    
    // Get item details  make sure it's not deleted
    const [itemRows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ? AND is_deleted = false',
      [item_id]
    );
    
    if (itemRows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Item not found or no longer available' });
    }
    
    const item = itemRows[0];
    
    // Check if user is trying to buy their own item
    if (item.seller_id === req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You cannot purchase your own item' });
    }
    
    // Check if user has already purchased this item
    const [existingPurchases] = await pool.query(
      'SELECT * FROM purchases WHERE buyer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (existingPurchases.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You have already purchased this item' });
    }
    
    // Create purchase
    const [result] = await pool.query(
      'INSERT INTO purchases (buyer_id, item_id, purchase_price) VALUES (?, ?, ?)',
      [req.user.user_id, item_id, item.price]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to create purchase' });
    }
    
    // Create notification for seller - only once within the transaction
    try {
      // Check if seller_notifications table exists first
      const [tableCheck] = await pool.query(`
        SELECT COUNT(*) as table_exists
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = 'seller_notifications'
      `);
      
      if (tableCheck[0].table_exists > 0) {
        // Check if a notification already exists for this purchase to avoid duplicates
        const [existingNotification] = await pool.query(
          'SELECT * FROM seller_notifications WHERE seller_id = ? AND item_id = ? AND buyer_id = ? AND purchase_id = ?',
          [item.seller_id, item_id, req.user.user_id, result.insertId]
        );
        
        if (existingNotification.length === 0) {
          await pool.query(
            'INSERT INTO seller_notifications (seller_id, item_id, buyer_id, purchase_id) VALUES (?, ?, ?, ?)',
            [item.seller_id, item_id, req.user.user_id, result.insertId]
          );
        }
      }
    } catch (notificationError) {
      // Log but don't fail the purchase if notification can't be created
      console.error('Failed to create seller notification:', notificationError);
    }
    
    // Delete any price drop alerts for this user and item
    try {
      await pool.query(
        `DELETE FROM user_alerts 
         WHERE user_id = ? AND item_id = ? AND alert_type_id IN 
           (SELECT alert_type_id FROM alert_types WHERE name = 'Price Drop')`,
        [req.user.user_id, item_id]
      );
    } catch (alertError) {
      // Log but don't fail the purchase if alert deletion fails
      console.error('Failed to delete price drop alerts:', alertError);
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM purchases WHERE purchase_id = ?',
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

// @desc    Get user purchases
// @route   GET /api/purchases
// @access  Private
const getUserPurchases = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT p.*, i.title, i.description, i.file_path, i.thumbnail_path, u.username as seller_name,
              i.is_deleted
       FROM purchases p
       JOIN items i ON p.item_id = i.item_id
       JOIN users u ON i.seller_id = u.user_id
       WHERE p.buyer_id = ?
       ORDER BY p.purchase_date DESC
       LIMIT ? OFFSET ?`,
      [req.user.user_id, limit, offset]
    );
    
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM purchases WHERE buyer_id = ?',
      [req.user.user_id]
    );
    
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      purchases: rows,
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

// @desc    Get user sales
// @route   GET /api/purchases/sales
// @access  Private
const getUserSales = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT p.*, i.title, i.description, u.username as buyer_name, i.is_deleted
       FROM purchases p
       JOIN items i ON p.item_id = i.item_id
       JOIN users u ON p.buyer_id = u.user_id
       WHERE i.seller_id = ?
       ORDER BY p.purchase_date DESC
       LIMIT ? OFFSET ?`,
      [req.user.user_id, limit, offset]
    );
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM purchases p
       JOIN items i ON p.item_id = i.item_id
       WHERE i.seller_id = ?`,
      [req.user.user_id]
    );
    
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      sales: rows,
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


// @desc    Download purchased item
// @route   GET /api/purchases/:id/download
// @access  Private
const downloadPurchasedItem = async (req, res) => {
  try {
    console.log('Download request for purchase ID:', req.params.id);
    console.log('User ID:', req.user?.user_id);
    
    // Check if user has purchased this item
    const [purchases] = await pool.query(
      'SELECT p.*, i.file_path, i.title, i.seller_id FROM purchases p JOIN items i ON p.item_id = i.item_id WHERE p.purchase_id = ?',
      [req.params.id]
    );
    
    if (purchases.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    const purchase = purchases[0];
    console.log('Found purchase:', { 
      purchase_id: purchase.purchase_id,
      buyer_id: purchase.buyer_id,
      seller_id: purchase.seller_id,
      file_path: purchase.file_path
    });
    
    // Check if the requester is either the buyer or the seller of the item
    if (purchase.buyer_id !== req.user.user_id && purchase.seller_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized to download this file' });
    }
    
    // Check if file exists
    if (!purchase.file_path || purchase.file_path === '') {
      console.log('No file path found, serving default file');
      // Return a default file if no file is attached
      const defaultFilePath = path.join(__dirname, '..', 'public', 'downloads', 'default-item.txt');
      
      // Create the default file if it doesn't exist
      if (!fs.existsSync(defaultFilePath)) {
        const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
        
        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }
        
        // Create a simple default file with some info
        fs.writeFileSync(
          defaultFilePath, 
          `This is a placeholder file for "${purchase.title}"\nPurchase ID: ${purchase.purchase_id}\nDownloaded on: ${new Date().toLocaleString()}`
        );
      }
      
      // Generate a suitable filename
      const fileName = purchase.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
      
      console.log('Sending default file as:', fileName);
      
      // Send the default file
      return res.download(defaultFilePath, fileName);
    }
    
    // Improved file path handling
    let filePath;
    
    if (path.isAbsolute(purchase.file_path)) {
      filePath = purchase.file_path;
    } 
    else if (purchase.file_path.startsWith('/')) {
      filePath = path.join(__dirname, '..', 'public', purchase.file_path.substring(1));
    } 
    else {
      filePath = path.join(__dirname, '..', 'public', purchase.file_path);
    }
    
    console.log('Resolved file path:', filePath);
    
    // Check if file exists on server
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at resolved path: ${filePath}`);
      
      // Try alternative path resolutions
      const alternativePaths = [
        path.join(__dirname, '..', 'public', purchase.file_path),
        path.join(__dirname, '..', purchase.file_path),
        path.join(__dirname, '..', 'public', purchase.file_path.replace(/^\/+/, '')),
        path.join(__dirname, '..', 'public/uploads/items', path.basename(purchase.file_path))
      ];
      
      let fileFound = false;
      
      for (const altPath of alternativePaths) {
        console.log('Trying alternative path:', altPath);
        if (fs.existsSync(altPath)) {
          filePath = altPath;
          fileFound = true;
          console.log('Found file at alternative path');
          break;
        }
      }
      
      if (!fileFound) {
        console.log('File still not found, serving default file');
        
        // Return a default file if the actual file is missing
        const defaultFilePath = path.join(__dirname, '..', 'public', 'downloads', 'default-item.txt');
        
        // Create the default file if it doesn't exist
        if (!fs.existsSync(defaultFilePath)) {
          const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
          
          // Create downloads directory if it doesn't exist
          if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
          }
          
          // Create a simple default file with some info
          fs.writeFileSync(
            defaultFilePath, 
            `This is a placeholder file for "${purchase.title}"\nThe original file was not found.\nPurchase ID: ${purchase.purchase_id}\nDownloaded on: ${new Date().toLocaleString()}`
          );
        }
        
        // Generate a suitable filename
        const fileName = purchase.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
        
        console.log('Sending default file as:', fileName);
        
        // Send the default file
        return res.download(defaultFilePath, fileName);
      }
    }
    
    // Generate a suitable filename
    const fileName = purchase.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + path.extname(purchase.file_path);
    
    console.log(`Sending file: ${filePath} as ${fileName}`);
    
    // Send file
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Server error while downloading file' });
  }
};

// @desc    Get seller notifications
// @route   GET /api/purchases/notifications
// @access  Private
const getSellerNotifications = async (req, res) => {
  try {
    // Check if the seller_notifications table exists first
    const [tableCheck] = await pool.query(`
      SELECT COUNT(*) as table_exists
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = 'seller_notifications'
    `);
    
    if (tableCheck[0].table_exists === 0) {
      return res.json([]);  // Return empty array if table doesn't exist
    }
    
    const [rows] = await pool.query(
      `SELECT sn.*, i.title as item_title, u.username as buyer_name, p.purchase_price
       FROM seller_notifications sn
       JOIN items i ON sn.item_id = i.item_id
       JOIN users u ON sn.buyer_id = u.user_id
       JOIN purchases p ON sn.purchase_id = p.purchase_id
       WHERE sn.seller_id = ?
       ORDER BY sn.created_at DESC`,
      [req.user.user_id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark seller notification as read
// @route   PUT /api/purchases/notifications/:id/read
// @access  Private
const markNotificationAsRead = async (req, res) => {
  try {
    // Check if the seller_notifications table exists first
    const [tableCheck] = await pool.query(`
      SELECT COUNT(*) as table_exists
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = 'seller_notifications'
    `);
    
    if (tableCheck[0].table_exists === 0) {
      return res.status(404).json({ message: 'Notification feature not available' });
    }
    
    // Get the notification
    const [rows] = await pool.query(
      'SELECT * FROM seller_notifications WHERE notification_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    const notification = rows[0];
    
    // Check if user owns the notification
    if (notification.seller_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update the notification
    const [result] = await pool.query(
      'UPDATE seller_notifications SET is_read = ? WHERE notification_id = ?',
      [true, req.params.id]
    );
    
    if (result.affectedRows === 1) {
      res.json({ message: 'Notification marked as read' });
    } else {
      res.status(400).json({ message: 'Update failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPurchase,
  getUserPurchases,
  getUserSales,
  downloadPurchasedItem,
  getSellerNotifications,
  markNotificationAsRead
};