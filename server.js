require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import routes
const userRoutes = require('./routes/userRoutes');
const itemRoutes = require('./routes/itemRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const alertRoutes = require('./routes/alertRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
}));

// Create upload directories if they don't exist
const fs = require('fs');
const dirs = [
  './public/uploads/items', 
  './public/uploads/profiles', 
  './public/uploads/thumbnails',
  './public/img'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create default images if they don't exist
const defaultImages = [
  { path: './public/img', file: 'default-thumbnail.png' },
  { path: './public/img', file: 'default-profile.png' }
];

defaultImages.forEach(img => {
  const filePath = path.join(img.path, img.file);
  if (!fs.existsSync(filePath)) {
    // Create a simple SVG as placeholder
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f1f1f1"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" text-anchor="middle" fill="#999">
        ${img.file.replace('.png', '')}
      </text>
    </svg>`;
    
    fs.writeFileSync(filePath, placeholderSvg);
  }
});

// Static folders - CORRECTED PATHS
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/alerts', alertRoutes);

// Serve frontend in production
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});