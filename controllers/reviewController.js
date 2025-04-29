const pool = require('../config/db');

// Helper function to update item's average rating
const updateItemAverageRating = async (itemId) => {
  try {
    // Get average rating separately to avoid GROUP BY issues
    const [ratingRows] = await pool.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE item_id = ?',
      [itemId]
    );
    
    const avgRating = ratingRows[0].avg_rating || 0;
    
    // Check if avg_rating column exists in items table
    const [columnCheck] = await pool.query(`
      SELECT COUNT(*) as column_exists
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'items'
        AND column_name = 'avg_rating'
    `);
    
    if (columnCheck[0].column_exists > 0) {
      // Update items table with average rating
      await pool.query(
        'UPDATE items SET avg_rating = ? WHERE item_id = ?',
        [avgRating, itemId]
      );
    }
  } catch (error) {
    console.error('Error updating average rating:', error);
    throw error;
  }
};

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { item_id, rating, comment } = req.body;
    
    // Input validation
    if (!item_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide an item ID' });
    }
    
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5' });
    }
    
    // Validate comment length
    if (comment && comment.length > 1000) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Comment is too long (maximum 1000 characters)' });
    }
    
    // Check if item exists and is not deleted
    const [itemRows] = await pool.query(
      'SELECT * FROM items WHERE item_id = ?', 
      [item_id]
    );
    
    if (itemRows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const item = itemRows[0];
    
    // Prevent sellers from reviewing their own items
    if (item.seller_id === req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You cannot review your own item' });
    }
    
    // Check if user has purchased the item
    const [purchaseRows] = await pool.query(
      'SELECT * FROM purchases WHERE buyer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (purchaseRows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You must purchase an item before reviewing it' });
    }
    
    // Check if user has already reviewed this item
    const [existingReviews] = await pool.query(
      'SELECT * FROM reviews WHERE reviewer_id = ? AND item_id = ?',
      [req.user.user_id, item_id]
    );
    
    if (existingReviews.length > 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'You have already reviewed this item' });
    }
    
    // Create review
    const [result] = await pool.query(
      'INSERT INTO reviews (item_id, reviewer_id, rating, comment) VALUES (?, ?, ?, ?)',
      [item_id, req.user.user_id, rating, comment || null]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to create review' });
    }
    
    const [rows] = await pool.query(
      `SELECT r.*, u.username as reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.user_id
       WHERE r.review_id = ?`,
      [result.insertId]
    );
    
    // Update item's average rating
    await updateItemAverageRating(item_id);
    
    await pool.query('COMMIT');
    res.status(201).json(rows[0]);
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get reviews for an item
// @route   GET /api/reviews/item/:id
// @access  Public
const getItemReviews = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT r.*, u.username as reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.user_id
       WHERE r.item_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );
    
    // Get total count with a separate query
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM reviews WHERE item_id = ?',
      [req.params.id]
    );
    
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      reviews: rows,
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

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { rating, comment } = req.body;
    
    // Validate rating
    if (rating !== undefined && (isNaN(parseInt(rating)) || parseInt(rating) < 1 || parseInt(rating) > 5)) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Validate comment length
    if (comment !== undefined && comment.length > 1000) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Comment is too long (maximum 1000 characters)' });
    }
    
    // Get the review
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const review = rows[0];
    
    // Check if user owns the review
    if (review.reviewer_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Update the review
    const newRating = rating !== undefined ? parseInt(rating) : review.rating;
    const newComment = comment !== undefined ? comment : review.comment;
    
    const [result] = await pool.query(
      'UPDATE reviews SET rating = ?, comment = ? WHERE review_id = ?',
      [newRating, newComment, req.params.id]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Update failed' });
    }
    
    // Update item's average rating
    await updateItemAverageRating(review.item_id);
    
    const [updatedRows] = await pool.query(
      `SELECT r.*, u.username as reviewer_name
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.user_id
       WHERE r.review_id = ?`,
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

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    // Get the review
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const review = rows[0];
    const itemId = review.item_id;
    
    // Check if user owns the review
    if (review.reviewer_id !== req.user.user_id) {
      await pool.query('ROLLBACK');
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Delete the review
    const [result] = await pool.query(
      'DELETE FROM reviews WHERE review_id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Delete failed' });
    }
    
    // Update item's average rating
    await updateItemAverageRating(itemId);
    
    await pool.query('COMMIT');
    res.json({ message: 'Review removed' });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user reviews
// @route   GET /api/reviews/user
// @access  Private
const getUserReviews = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT r.*, i.title as item_title, i.thumbnail_path as item_thumbnail
       FROM reviews r
       JOIN items i ON r.item_id = i.item_id
       WHERE r.reviewer_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.user_id, limit, offset]
    );
    
    // Get total count with a separate query
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM reviews WHERE reviewer_id = ?',
      [req.user.user_id]
    );
    
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      reviews: rows,
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

module.exports = {
  createReview,
  getItemReviews,
  updateReview,
  deleteReview,
  getUserReviews
};