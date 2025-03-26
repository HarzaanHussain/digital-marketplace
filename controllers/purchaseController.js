const pool = require('../config/db');
const path = require('path');

// @desc    Create a new purchase
// @route   POST /api/purchases
// @access  Private
const createPurchase = async (req, res) => {
  try {
    const { item_id } = req.body;
    
    if (!item_id) {
      return res.status(400).json({ message: 'Please provide an item ID' });
    }
    
    // Get item details
    const [itemRows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [item_id]
    );
    
    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const item = itemRows[0];
    
    // Check if user is trying to buy their own item
    if (item.seller_id === req.user.user_id) {
      return res.status(400).json({ message: 'You cannot purchase your own item' });
    }
    
    // Check if user has already purchased this item
    const [existingPurchases] = await pool.query(
      'SELECT * FROM purchases WHERE buyer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (existingPurchases.length > 0) {
      return res.status(400).json({ message: 'You have already purchased this item' });
    }
    
    // Create purchase
    const [result] = await pool.query(
      'INSERT INTO purchases (buyer_id, item_id, purchase_price) VALUES (?, ?, ?)',
      [req.user.user_id, item_id, item.price]
    );
    
    if (result.affectedRows === 1) {
      const [rows] = await pool.query(
        'SELECT * FROM purchases WHERE purchase_id = ?',
        [result.insertId]
      );
      
      res.status(201).json(rows[0]);
    } else {
      res.status(400).json({ message: 'Failed to create purchase' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user purchases
// @route   GET /api/purchases
// @access  Private
const getUserPurchases = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, i.title, i.description, i.file_path, i.thumbnail_path, u.username as seller_name
       FROM purchases p
       JOIN items i ON p.item_id = i.item_id
       JOIN users u ON i.seller_id = u.user_id
       WHERE p.buyer_id = ?
       ORDER BY p.purchase_date DESC`,
      [req.user.user_id]
    );
    
    res.json(rows);
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
    const [rows] = await pool.query(
      `SELECT p.*, i.title, i.description, u.username as buyer_name
       FROM purchases p
       JOIN items i ON p.item_id = i.item_id
       JOIN users u ON p.buyer_id = u.user_id
       WHERE i.seller_id = ?
       ORDER BY p.purchase_date DESC`,
      [req.user.user_id]
    );
    
    res.json(rows);
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
    // Check if user has purchased this item
    const [purchases] = await pool.query(
      'SELECT p.*, i.file_path, i.title FROM purchases p JOIN items i ON p.item_id = i.item_id WHERE p.purchase_id = ? AND p.buyer_id = ?',
      [req.params.id, req.user.user_id]
    );
    
    if (purchases.length === 0) {
      return res.status(404).json({ message: 'Purchase not found or not authorized' });
    }
    
    const purchase = purchases[0];
    
    // Send file
    res.download(`./public${purchase.file_path}`, `${purchase.title}${path.extname(purchase.file_path)}`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPurchase,
  getUserPurchases,
  getUserSales,
  downloadPurchasedItem
};