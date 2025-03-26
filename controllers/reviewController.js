const pool = require('../config/db');

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
  try {
    const { item_id, rating, comment } = req.body;
    
    if (!item_id || !rating) {
      return res.status(400).json({ message: 'Please provide an item ID and rating' });
    }
    
    // Check if item exists
    const [itemRows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?',
      [item_id]
    );
    
    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Check if user has purchased the item
    const [purchaseRows] = await pool.query(
      'SELECT * FROM purchases WHERE buyer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (purchaseRows.length === 0) {
      return res.status(400).json({ message: 'You must purchase an item before reviewing it' });
    }
    
    // Check if user has already reviewed this item
    const [existingReviews] = await pool.query(
      'SELECT * FROM reviews WHERE reviewer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (existingReviews.length > 0) {
      return res.status(400).json({ message: 'You have already reviewed this item' });
    }
    
    // Create review
    const [result] = await pool.query(
      'INSERT INTO reviews (item_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)',
      [item_id, req.user.user_id, rating, comment || null]
    );
    
    if (result.affectedRows === 1) {
      const [rows] = await pool.query(
        `SELECT r.*, u.username as reviewer_name
         FROM reviews r
         JOIN users u ON r.reviewer_id = u.user_id
         WHERE r.review_id = ?`,
        [result.insertId]
      );
      
      res.status(201).json(rows[0]);
    } else {
      res.status(400).json({ message: 'Failed to create review' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get reviews for an item
// @route   GET /api/reviews/item/:id
// @access  Public
const getItemReviews = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.username as reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.user_id
       WHERE r.item_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    // Get the review
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const review = rows[0];
    
    // Check if user owns the review
    if (review.reviewer_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update the review
    const [result] = await pool.query(
      'UPDATE reviews SET rating = ?, comment = ? WHERE review_id = ?',
      [rating || review.rating, comment !== undefined ? comment : review.comment, req.params.id]
    );
    
    if (result.affectedRows === 1) {
      const [updatedRows] = await pool.query(
        `SELECT r.*, u.username as reviewer_name
         FROM reviews r
         JOIN users u ON r.reviewer_id = u.user_id
         WHERE r.review_id = ?`,
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

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = async (req, res) => {
  try {
    // Get the review
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const review = rows[0];
    
    // Check if user owns the review
    if (review.reviewer_id !== req.user.user_id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Delete the review
    const [result] = await pool.query(
      'DELETE FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 1) {
      res.json({ message: 'Review removed' });
    } else {
      res.status(400).json({ message: 'Delete failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createReview,
  getItemReviews,
  updateReview,
  deleteReview
};  