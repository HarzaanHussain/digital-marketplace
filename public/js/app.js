// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        currentPage: 'home',
        currentItemId: null,
        user: null,
        token: localStorage.getItem('token'),
        alertCount: 0
    };

    // API Base URL
    const API_URL = '/api';

    // Initialize App
    init();

    // Initialize the application
    async function init() {
        // Check if user is logged in
        if (state.token) {
            try {
                const user = await fetchUserProfile();
                state.user = user;
                updateAuthUI();
                checkForAlerts();
            } catch (error) {
                console.error('Failed to fetch user profile:', error);
                logout();
            }
        } else {
            updateAuthUI();
        }

        // Set up event listeners
        setupEventListeners();

        // Load initial page
        const pageFromHash = window.location.hash.substring(1);
        if (pageFromHash) {
            navigateTo(pageFromHash);
        } else {
            navigateTo('home');
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                const action = e.target.dataset.action;
                
                if (page) {
                    navigateTo(page);
                } else if (action === 'logout') {
                    logout();
                }
            });
        });

        // Handle form submissions and other events based on the current page
        document.addEventListener('click', handleClick);
    }

    // Handle click events
    function handleClick(e) {
        // Check for data-action
        if (e.target.dataset.action) {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'browse':
                    navigateTo('browse');
                    break;
                case 'sell':
                    navigateTo('sell');
                    break;
                case 'closeAlert':
                    closeAlert(e.target.closest('.alert'));
                    break;
                case 'viewItem':
                    const itemId = e.target.closest('.item-card').dataset.id;
                    viewItem(itemId);
                    break;
                case 'browseCategory':
                    const categoryId = e.target.closest('.category-card').dataset.id;
                    navigateTo('browse', { categoryId });
                    break;
                case 'markRead':
                    const alertId = e.target.closest('.alert-card').dataset.id;
                    markAlertAsRead(alertId);
                    break;
                case 'deleteAlert':
                    const alertToDeleteId = e.target.closest('.alert-card').dataset.id;
                    deleteAlert(alertToDeleteId);
                    break;
            }
        }
    }

    // Navigate to a page
    function navigateTo(page, params = {}) {
        state.currentPage = page;
        state.params = params;
        
        // Update URL hash
        window.location.hash = page;
        
        // Clear page content
        const pageContent = document.getElementById('page-content');
        pageContent.innerHTML = '';
        
        // Load page content
        loadPage(page, params);
        
        // Update active nav link
        updateActiveNavLink(page);
    }

    // Update the active navigation link
    function updateActiveNavLink(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.page === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Load page content
    async function loadPage(page, params = {}) {
        const pageContent = document.getElementById('page-content');
        
        switch (page) {
            case 'home':
                renderTemplate('home-template', pageContent);
                loadFeaturedItems();
                loadCategories();
                break;
                
            case 'browse':
                renderTemplate('browse-template', pageContent);
                loadCategories();
                
                const searchButton = document.getElementById('search-button');
                searchButton.addEventListener('click', () => {
                    const searchInput = document.getElementById('search-input').value;
                    loadItems({ search: searchInput });
                });
                
                const categoryFilter = document.getElementById('category-filter');
                categoryFilter.addEventListener('change', () => {
                    loadItems({ category: categoryFilter.value });
                });
                
                // Load items with initial params
                loadItems(params);
                break;
                
            case 'item':
                renderTemplate('item-detail-template', pageContent);
                loadItem(params.itemId);
                
                // Set up back button
                const backButton = document.getElementById('back-button');
                backButton.addEventListener('click', () => {
                    navigateTo('browse');
                });
                
                // Set up review form
                const reviewForm = document.getElementById('review-form');
                if (reviewForm) {
                    reviewForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        submitReview(params.itemId);
                    });
                }
                
                // Set up star rating
                const stars = document.querySelectorAll('.star-rating i');
                if (stars.length > 0) {
                    stars.forEach(star => {
                        star.addEventListener('click', () => {
                            const rating = star.dataset.rating;
                            document.getElementById('rating-input').value = rating;
                            updateStarRating(rating);
                        });
                    });
                    
                    // Set initial star rating
                    updateStarRating(5);
                }
                
                // Set up alert button
                const setAlertButton = document.getElementById('set-alert-button');
                if (setAlertButton) {
                    setAlertButton.addEventListener('click', () => {
                        openSetAlertModal(params.itemId);
                    });
                }
                
                // Set up purchase button
                const purchaseButton = document.getElementById('purchase-button');
                if (purchaseButton) {
                    purchaseButton.addEventListener('click', () => {
                        purchaseItem(params.itemId);
                    });
                }
                break;
                
            case 'login':
                if (state.user) {
                    navigateTo('profile');
                    return;
                }
                
                renderTemplate('login-template', pageContent);
                
                const loginForm = document.getElementById('login-form');
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    login();
                });
                break;
                
            case 'register':
                if (state.user) {
                    navigateTo('profile');
                    return;
                }
                
                renderTemplate('register-template', pageContent);
                
                const registerForm = document.getElementById('register-form');
                registerForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    register();
                });
                break;
                
            case 'profile':
                if (!state.user) {
                    navigateTo('login');
                    return;
                }
                
                renderTemplate('profile-template', pageContent);
                loadProfile();
                
                // Set up profile form
                const profileForm = document.getElementById('profile-form');
                profileForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    updateProfile();
                });
                
                // Set up profile image upload
                const profileImageUpload = document.getElementById('profile-image-upload');
                profileImageUpload.addEventListener('change', () => {
                    uploadProfileImage();
                });
                
                // Set up tabs
                const tabItems = document.querySelectorAll('.tab-item');
                tabItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const tab = item.dataset.tab;
                        switchTab(tab);
                    });
                });
                
                // Load purchases and sales
                loadPurchases();
                loadSales();
                break;
                
            case 'sell':
                if (!state.user) {
                    navigateTo('login');
                    return;
                }
                
                renderTemplate('sell-template', pageContent);
                loadCategoriesForSell();
                
                const sellForm = document.getElementById('sell-form');
                sellForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    sellItem();
                });
                break;
                
            case 'alerts':
                if (!state.user) {
                    navigateTo('login');
                    return;
                }
                
                renderTemplate('alerts-template', pageContent);
                loadAlerts();
                
                // Set up new alert button
                const newAlertButton = document.getElementById('new-alert-button');
                newAlertButton.addEventListener('click', () => {
                    openNewAlertModal();
                });
                
                // Set up modal close
                const closeModal = document.querySelector('.close-modal');
                closeModal.addEventListener('click', () => {
                    closeModal();
                });
                
                // Set up new alert form
                const newAlertForm = document.getElementById('new-alert-form');
                newAlertForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    createAlert();
                });
                
                // Set up alert type change
                const alertTypeInput = document.getElementById('alert-type-input');
                alertTypeInput.addEventListener('change', () => {
                    updateAlertForm();
                });
                
                // Load alert types, categories, and items for the form
                loadAlertTypes();
                loadCategoriesForAlerts();
                loadItemsForAlerts();
                break;
                
            default:
                pageContent.innerHTML = '<div class="not-found"><h2>Page Not Found</h2></div>';
        }
    }

    // Render a template
    function renderTemplate(templateId, container) {
        const template = document.getElementById(templateId);
        if (template) {
            const content = template.content.cloneNode(true);
            container.appendChild(content);
            
            // Show/hide elements based on authentication
            updateAuthUI();
        }
    }

    // Update UI elements based on authentication state
    function updateAuthUI() {
        const isLoggedIn = !!state.user;
        
        // Update navigation
        document.getElementById('login-link').classList.toggle('hidden', isLoggedIn);
        document.getElementById('register-link').classList.toggle('hidden', isLoggedIn);
        document.getElementById('profile-link').classList.toggle('hidden', !isLoggedIn);
        document.getElementById('logout-link').classList.toggle('hidden', !isLoggedIn);
        document.getElementById('sell-link').classList.toggle('hidden', !isLoggedIn);
        document.getElementById('alerts-link').classList.toggle('hidden', !isLoggedIn);
        
        // Update alert badge
        const alertBadge = document.getElementById('alert-badge');
        if (alertBadge) {
            alertBadge.classList.toggle('hidden', state.alertCount === 0);
            alertBadge.textContent = state.alertCount;
        }
        
        // Update auth-required elements
        document.querySelectorAll('.auth-required').forEach(element => {
            element.classList.toggle('hidden', !isLoggedIn);
        });
    }

    // API Requests
    // Make an API request
    async function apiRequest(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }
        
        const options = {
            method,
            headers
        };
        
        if (data) {
            if (data instanceof FormData) {
                // If FormData, don't set Content-Type header
                delete options.headers['Content-Type'];
                options.body = data;
            } else {
                options.body = JSON.stringify(data);
            }
        }
        
        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const responseData = await response.json();
                
                if (!response.ok) {
                    throw new Error(responseData.message || 'API request failed');
                }
                
                return responseData;
            } else {
                if (!response.ok) {
                    throw new Error('API request failed');
                }
                
                return await response.text();
            }
        } catch (error) {
            console.error(`API request error for ${endpoint}:`, error);
            showAlert(error.message || 'Failed to connect to server', 'danger');
            throw error;
        }
    }

    // Authentication Functions
    // Login user
    async function login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const data = await apiRequest('/users/login', 'POST', { email, password });
            
            // Save token and user data
            localStorage.setItem('token', data.token);
            state.token = data.token;
            state.user = data.user;
            
            // Update UI and redirect
            updateAuthUI();
            showAlert('Login successful!', 'success');
            navigateTo('home');
            
            // Check for alerts
            checkForAlerts();
        } catch (error) {
            showAlert('Login failed: ' + error.message, 'danger');
        }
    }

    // Register user
    async function register() {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const fullName = document.getElementById('register-full-name').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'danger');
            return;
        }
        
        try {
            const data = await apiRequest('/users', 'POST', {
                username,
                email,
                password,
                full_name: fullName
            });
            
            // Save token and user data
            localStorage.setItem('token', data.token);
            state.token = data.token;
            state.user = data.user;
            
            // Update UI and redirect
            updateAuthUI();
            showAlert('Registration successful!', 'success');
            navigateTo('home');
        } catch (error) {
            showAlert('Registration failed: ' + error.message, 'danger');
        }
    }

    // Logout user
    function logout() {
        // Clear token and user data
        localStorage.removeItem('token');
        state.token = null;
        state.user = null;
        
        // Update UI and redirect
        updateAuthUI();
        showAlert('You have been logged out', 'info');
        navigateTo('home');
    }

    // Fetch user profile
    async function fetchUserProfile() {
        return await apiRequest('/users/profile');
    }

    // Check for unread alerts
    async function checkForAlerts() {
        if (!state.user) return;
        
        try {
            const alerts = await apiRequest('/alerts');
            const unreadCount = alerts.filter(alert => !alert.is_read).length;
            
            state.alertCount = unreadCount;
            updateAuthUI();
        } catch (error) {
            console.error('Failed to check for alerts:', error);
        }
    }

    // Home Page Functions
    // Load featured items
    async function loadFeaturedItems() {
        const container = document.getElementById('featured-items-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            const items = await apiRequest('/items?limit=4');
            
            if (items.length === 0) {
                container.innerHTML = '<p class="no-items">No items available</p>';
                return;
            }
            
            container.innerHTML = '';
            
            items.forEach(item => {
                const itemElement = createItemCard(item);
                container.appendChild(itemElement);
            });
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load items</p>';
            console.error('Failed to load featured items:', error);
        }
    }

    // Load categories
    async function loadCategories() {
        const container = document.getElementById('categories-container');
        const categoryFilter = document.getElementById('category-filter');
        
        try {
            const categories = await apiRequest('/categories');
            
            // Update category grid if it exists
            if (container) {
                container.innerHTML = '';
                
                categories.forEach(category => {
                    const categoryElement = createCategoryCard(category);
                    container.appendChild(categoryElement);
                });
            }
            
            // Update category filter if it exists
            if (categoryFilter) {
                // Keep the first option
                const firstOption = categoryFilter.options[0];
                categoryFilter.innerHTML = '';
                categoryFilter.appendChild(firstOption);
                
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.category_id;
                    option.textContent = category.name;
                    categoryFilter.appendChild(option);
                });
                
                // Set selected category if specified in params
                if (state.params && state.params.categoryId) {
                    categoryFilter.value = state.params.categoryId;
                }
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p class="error">Failed to load categories</p>';
            }
            console.error('Failed to load categories:', error);
        }
    }

    // Create a category card element
    function createCategoryCard(category) {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.id = category.category_id;
        card.dataset.action = 'browseCategory';
        
        // Get icon based on category name
        let icon = 'fa-tag';
        switch (category.name.toLowerCase()) {
            case 'digital art':
                icon = 'fa-palette';
                break;
            case 'music':
                icon = 'fa-music';
                break;
            case 'e-books':
                icon = 'fa-book';
                break;
            case 'software':
                icon = 'fa-code';
                break;
            case 'templates':
                icon = 'fa-file-alt';
                break;
        }
        
        card.innerHTML = `
            <div class="category-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="category-name">${category.name}</div>
        `;
        
        return card;
    }

    // Browse Page Functions
    // Load items for browse page
    async function loadItems(params = {}) {
        const container = document.getElementById('browse-items-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        // Build query string
        const queryParams = [];
        if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
        if (params.category) queryParams.push(`category=${encodeURIComponent(params.category)}`);
        if (params.categoryId) queryParams.push(`category=${encodeURIComponent(params.categoryId)}`);
        if (params.seller) queryParams.push(`seller=${encodeURIComponent(params.seller)}`);
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        
        try {
            const items = await apiRequest(`/items${queryString}`);
            
            if (items.length === 0) {
                container.innerHTML = '<p class="no-items">No items found</p>';
                return;
            }
            
            container.innerHTML = '';
            
            items.forEach(item => {
                const itemElement = createItemCard(item);
                container.appendChild(itemElement);
            });
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load items</p>';
            console.error('Failed to load items:', error);
        }
    }

    // Create an item card element
    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.item_id;
        card.dataset.action = 'viewItem';
        
        // Default thumbnail if none provided
        const thumbnail = item.thumbnail_path || '/img/default-thumbnail.png';
        
        card.innerHTML = `
            <div class="item-image">
                <img src="${thumbnail}" alt="${item.title}">
            </div>
            <div class="item-details">
                <h3 class="item-title">${item.title}</h3>
                <div class="item-price">$${parseFloat(item.price).toFixed(2)}</div>
                <div class="item-seller">by ${item.seller_name || 'Unknown'}</div>
            </div>
        `;
        
        return card;
    }

    // View an item
    function viewItem(itemId) {
        navigateTo('item', { itemId });
    }

    // Item Detail Page Functions
    // Load item details
    async function loadItem(itemId) {
        if (!itemId) return;
        
        state.currentItemId = itemId;
        
        try {
            const item = await apiRequest(`/items/${itemId}`);
            
            // Update item details
            document.getElementById('item-title').textContent = item.title;
            document.getElementById('item-description').textContent = item.description;
            document.getElementById('item-category').textContent = item.category_name;
            document.getElementById('item-seller').textContent = item.seller_name;
            document.getElementById('item-price').textContent = `$${parseFloat(item.price).toFixed(2)}`;
            
            // Set thumbnail
            const thumbnailImg = document.getElementById('item-thumbnail');
            thumbnailImg.src = item.thumbnail_path || '/img/default-thumbnail.png';
            thumbnailImg.alt = item.title;
            
            // Load reviews
            loadReviews(item.reviews);
            
            // Update purchase button
            const purchaseButton = document.getElementById('purchase-button');
            if (state.user && state.user.user_id === item.seller_id) {
                purchaseButton.textContent = 'Edit Item';
                purchaseButton.dataset.action = 'editItem';
            } else {
                purchaseButton.textContent = 'Purchase';
                purchaseButton.dataset.action = 'purchaseItem';
            }
        } catch (error) {
            showAlert('Failed to load item details', 'danger');
            console.error('Failed to load item:', error);
        }
    }

    // Load reviews for an item
    function loadReviews(reviews) {
        const container = document.getElementById('reviews-container');
        if (!container) return;
        
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<p class="no-reviews">No reviews yet</p>';
            return;
        }
        
        container.innerHTML = '';
        
        reviews.forEach(review => {
            const reviewElement = createReviewElement(review);
            container.appendChild(reviewElement);
        });
    }

    // Create a review element
    function createReviewElement(review) {
        const reviewElement = document.createElement('div');
        reviewElement.className = 'review';
        
        const date = new Date(review.created_at).toLocaleDateString();
        
        reviewElement.innerHTML = `
            <div class="review-header">
                <span class="reviewer">${review.reviewer_name}</span>
                <span class="review-date">${date}</span>
            </div>
            <div class="star-rating">
                ${createStarRating(review.rating)}
            </div>
            <div class="review-comment">${review.comment}</div>
        `;
        
        return reviewElement;
    }

    // Create star rating HTML
    function createStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    // Update star rating display
    function updateStarRating(rating) {
        const stars = document.querySelectorAll('.star-rating i');
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    // Submit a review
    async function submitReview(itemId) {
        const rating = document.getElementById('rating-input').value;
        const comment = document.getElementById('review-comment').value;
        
        if (!rating) {
            showAlert('Please select a rating', 'warning');
            return;
        }
        
        try {
            await apiRequest(`/reviews`, 'POST', {
                item_id: itemId,
                rating,
                comment
            });
            
            showAlert('Review submitted successfully!', 'success');
            
            // Reload item to show new review
            loadItem(itemId);
            
            // Clear form
            document.getElementById('review-comment').value = '';
            updateStarRating(5);
        } catch (error) {
            showAlert('Failed to submit review', 'danger');
            console.error('Failed to submit review:', error);
        }
    }

    // Purchase an item
    async function purchaseItem(itemId) {
        try {
            await apiRequest('/purchases', 'POST', { item_id: itemId });
            
            showAlert('Item purchased successfully!', 'success');
            
            // Navigate to profile/purchases
            navigateTo('profile');
            switchTab('purchases');
        } catch (error) {
            showAlert('Failed to purchase item', 'danger');
            console.error('Failed to purchase item:', error);
        }
    }

    // Open set alert modal for an item
    function openSetAlertModal(itemId) {
        // Navigate to alerts page and open modal
        navigateTo('alerts');
        
        // Wait for page to load and then open modal
        setTimeout(() => {
            openNewAlertModal();
            
            // Pre-select item
            const alertItemInput = document.getElementById('alert-item-input');
            if (alertItemInput) {
                alertItemInput.value = itemId;
            }
            
            // Show price threshold field
            document.getElementById('alert-price-group').classList.remove('hidden');
        }, 500);
    }

    // Profile Page Functions
    // Load user profile
    async function loadProfile() {
        if (!state.user) return;
        
        try {
            const profile = await fetchUserProfile();
            
            // Update profile form
            document.getElementById('profile-username').value = profile.username;
            document.getElementById('profile-email').value = profile.email;
            document.getElementById('profile-full-name').value = profile.full_name;
            
            // Update profile image
            const profileImage = document.getElementById('profile-image');
            profileImage.src = profile.profile_image || '/img/default-profile.png';
        } catch (error) {
            showAlert('Failed to load profile', 'danger');
            console.error('Failed to load profile:', error);
        }
    }

    // Update user profile
    async function updateProfile() {
        const username = document.getElementById('profile-username').value;
        const email = document.getElementById('profile-email').value;
        const fullName = document.getElementById('profile-full-name').value;
        const password = document.getElementById('profile-password').value;
        
        const data = {
            username,
            email,
            full_name: fullName
        };
        
        if (password) {
            data.password = password;
        }
        
        try {
            const updatedProfile = await apiRequest('/users/profile', 'PUT', data);
            
            state.user = {
                ...state.user,
                username: updatedProfile.username,
                email: updatedProfile.email,
                full_name: updatedProfile.full_name
            };
            
            showAlert('Profile updated successfully!', 'success');
            
            // Clear password field
            document.getElementById('profile-password').value = '';
        } catch (error) {
            showAlert('Failed to update profile', 'danger');
            console.error('Failed to update profile:', error);
        }
    }

    // Upload profile image
    async function uploadProfileImage() {
        const fileInput = document.getElementById('profile-image-upload');
        const file = fileInput.files[0];
        
        if (!file) return;
        
        const formData = new FormData();
        formData.append('profile_image', file);
        
        try {
            const updatedProfile = await apiRequest('/users/profile', 'PUT', formData);
            
            // Update profile image
            const profileImage = document.getElementById('profile-image');
            profileImage.src = updatedProfile.profile_image;
            
            showAlert('Profile image updated successfully!', 'success');
        } catch (error) {
            showAlert('Failed to update profile image', 'danger');
            console.error('Failed to update profile image:', error);
        }
    }

    // Switch profile tabs
    function switchTab(tab) {
        // Update tab nav
        document.querySelectorAll('.tab-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tab}-tab`);
        });
    }

    // Load user purchases
    async function loadPurchases() {
        const container = document.getElementById('purchases-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            const purchases = await apiRequest('/purchases');
            
            if (purchases.length === 0) {
                container.innerHTML = '<p class="no-items">No purchases yet</p>';
                return;
            }
            
            container.innerHTML = '';
            
            purchases.forEach(purchase => {
                const purchaseElement = createPurchaseElement(purchase);
                container.appendChild(purchaseElement);
            });
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load purchases</p>';
            console.error('Failed to load purchases:', error);
        }
    }

    // Create purchase element
    function createPurchaseElement(purchase) {
        const element = document.createElement('div');
        element.className = 'purchase-card';
        
        const date = new Date(purchase.purchase_date).toLocaleDateString();
        
        element.innerHTML = `
            <div class="purchase-image">
                <img src="${purchase.thumbnail_path || '/img/default-thumbnail.png'}" alt="${purchase.title}">
            </div>
            <div class="purchase-details">
                <div class="purchase-title">${purchase.title}</div>
                <div class="purchase-price">$${parseFloat(purchase.purchase_price).toFixed(2)}</div>
                <div class="purchase-date">Purchased on ${date}</div>
            </div>
            <div class="purchase-actions">
                <button class="btn btn-secondary" data-action="downloadItem" data-id="${purchase.item_id}">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `;
        
        return element;
    }

    // Load user sales
    async function loadSales() {
        const container = document.getElementById('sales-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            const sales = await apiRequest('/items?seller=' + state.user.user_id);
            
            if (sales.length === 0) {
                container.innerHTML = '<p class="no-items">No sales yet</p>';
                return;
            }
            
            container.innerHTML = '';
            
            sales.forEach(sale => {
                const saleElement = createSaleElement(sale);
                container.appendChild(saleElement);
            });
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load sales</p>';
            console.error('Failed to load sales:', error);
        }
    }

    // Create sale element
    function createSaleElement(sale) {
        const element = document.createElement('div');
        element.className = 'sale-card';
        
        element.innerHTML = `
            <div class="sale-image">
                <img src="${sale.thumbnail_path || '/img/default-thumbnail.png'}" alt="${sale.title}">
            </div>
            <div class="sale-details">
                <div class="sale-title">${sale.title}</div>
                <div class="sale-price">$${parseFloat(sale.price).toFixed(2)}</div>
                <div class="sale-date">Listed on ${new Date(sale.created_at).toLocaleDateString()}</div>
            </div>
            <div class="sale-actions">
                <button class="btn btn-secondary" data-action="editItem" data-id="${sale.item_id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;
        
        return element;
    }

    // Sell Page Functions
    // Load categories for sell form
    async function loadCategoriesForSell() {
        const categoryInput = document.getElementById('item-category-input');
        if (!categoryInput) return;
        
        try {
            const categories = await apiRequest('/categories');
            
            // Keep the first option
            const firstOption = categoryInput.options[0];
            categoryInput.innerHTML = '';
            categoryInput.appendChild(firstOption);
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.category_id;
                option.textContent = category.name;
                categoryInput.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    // Sell an item
    async function sellItem() {
        const title = document.getElementById('item-title-input').value;
        const description = document.getElementById('item-description-input').value;
        const price = document.getElementById('item-price-input').value;
        const categoryId = document.getElementById('item-category-input').value;
        const fileInput = document.getElementById('item-file-input');
        const thumbnailInput = document.getElementById('item-thumbnail-input');
        
        if (!title || !price || !categoryId || !fileInput.files[0]) {
            showAlert('Please fill in all required fields', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('category_id', categoryId);
        formData.append('file', fileInput.files[0]);
        
        if (thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }
        
        try {
            const item = await apiRequest('/items', 'POST', formData);
            
            showAlert('Item listed successfully!', 'success');
            
            // Navigate to item page
            navigateTo('item', { itemId: item.item_id });
        } catch (error) {
            showAlert('Failed to list item', 'danger');
            console.error('Failed to list item:', error);
        }
    }

    // Alerts Page Functions
    // Load user alerts
    async function loadAlerts() {
        const container = document.getElementById('alerts-container');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            const alerts = await apiRequest('/alerts');
            
            if (alerts.length === 0) {
                container.innerHTML = '<p class="no-alerts">No alerts set</p>';
                return;
            }
            
            container.innerHTML = '';
            
            alerts.forEach(alert => {
                const alertElement = createAlertElement(alert);
                container.appendChild(alertElement);
            });
            
            // Update alert count
            state.alertCount = alerts.filter(alert => !alert.is_read).length;
            updateAuthUI();
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load alerts</p>';
            console.error('Failed to load alerts:', error);
        }
    }

    // Create alert element
    function createAlertElement(alert) {
        const element = document.createElement('div');
        element.className = 'alert-card';
        if (!alert.is_read) {
            element.classList.add('unread');
        }
        element.dataset.id = alert.alert_id;
        
        let alertTitle = '';
        let alertInfo = '';
        
        switch (alert.alert_type_name) {
            case 'Price Drop':
                alertTitle = 'Price Drop Alert';
                alertInfo = `Price dropped for ${alert.item_title || 'an item'}`;
                break;
            case 'New Item':
                alertTitle = 'New Item Alert';
                alertInfo = `New item in ${alert.category_name || 'a category'}`;
                break;
            case 'Back in Stock':
                alertTitle = 'Back in Stock Alert';
                alertInfo = `${alert.item_title || 'An item'} is back in stock`;
                break;
            case 'Seller Update':
                alertTitle = 'Seller Update Alert';
                alertInfo = `Update from seller for ${alert.item_title || 'an item'}`;
                break;
            default:
                alertTitle = 'Alert';
                alertInfo = 'You have a new alert';
        }
        
        element.innerHTML = `
            <div class="alert-content">
                <div class="alert-title">${alertTitle}</div>
                <div class="alert-info">${alertInfo}</div>
                <div class="alert-date">${new Date(alert.created_at).toLocaleString()}</div>
            </div>
            <div class="alert-actions">
                ${!alert.is_read ? `<button class="btn btn-secondary" data-action="markRead">Mark as Read</button>` : ''}
                <button class="btn btn-danger" data-action="deleteAlert"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        return element;
    }

    // Mark alert as read
    async function markAlertAsRead(alertId) {
        if (!alertId) return;
        
        try {
            await apiRequest(`/alerts/${alertId}/read`, 'PUT');
            
            // Reload alerts
            loadAlerts();
        } catch (error) {
            showAlert('Failed to mark alert as read', 'danger');
            console.error('Failed to mark alert as read:', error);
        }
    }

    // Delete alert
    async function deleteAlert(alertId) {
        if (!alertId) return;
        
        try {
            await apiRequest(`/alerts/${alertId}`, 'DELETE');
            
            // Reload alerts
            loadAlerts();
        } catch (error) {
            showAlert('Failed to delete alert', 'danger');
            console.error('Failed to delete alert:', error);
        }
    }

    // Open new alert modal
    function openNewAlertModal() {
        const modal = document.getElementById('new-alert-modal');
        modal.classList.remove('hidden');
    }

    // Close modal
    function closeModal() {
        const modal = document.getElementById('new-alert-modal');
        modal.classList.add('hidden');
    }

    // Update alert form based on selected alert type
    function updateAlertForm() {
        const alertType = document.getElementById('alert-type-input').value;
        const alertTypeText = document.getElementById('alert-type-input').options[document.getElementById('alert-type-input').selectedIndex].text;
        
        // Show/hide fields based on alert type
        document.getElementById('alert-item-group').classList.add('hidden');
        document.getElementById('alert-category-group').classList.add('hidden');
        document.getElementById('alert-price-group').classList.add('hidden');
        
        if (!alertType) return;
        
        switch (alertTypeText) {
            case 'Price Drop':
                document.getElementById('alert-item-group').classList.remove('hidden');
                document.getElementById('alert-price-group').classList.remove('hidden');
                break;
            case 'New Item':
                document.getElementById('alert-category-group').classList.remove('hidden');
                break;
            case 'Back in Stock':
                document.getElementById('alert-item-group').classList.remove('hidden');
                break;
            case 'Seller Update':
                document.getElementById('alert-item-group').classList.remove('hidden');
                break;
        }
    }

    // Load alert types
    async function loadAlertTypes() {
        const alertTypeInput = document.getElementById('alert-type-input');
        if (!alertTypeInput) return;
        
        try {
            const alertTypes = await apiRequest('/alerts/types');
            
            // Keep the first option
            const firstOption = alertTypeInput.options[0];
            alertTypeInput.innerHTML = '';
            alertTypeInput.appendChild(firstOption);
            
            alertTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.alert_type_id;
                option.textContent = type.name;
                alertTypeInput.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load alert types:', error);
        }
    }

    // Load categories for alerts
    async function loadCategoriesForAlerts() {
        const categoryInput = document.getElementById('alert-category-input');
        if (!categoryInput) return;
        
        try {
            const categories = await apiRequest('/categories');
            
            // Keep the first option
            const firstOption = categoryInput.options[0];
            categoryInput.innerHTML = '';
            categoryInput.appendChild(firstOption);
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.category_id;
                option.textContent = category.name;
                categoryInput.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    // Load items for alerts
    async function loadItemsForAlerts() {
        const itemInput = document.getElementById('alert-item-input');
        if (!itemInput) return;
        
        try {
            const items = await apiRequest('/items');
            
            // Keep the first option
            const firstOption = itemInput.options[0];
            itemInput.innerHTML = '';
            itemInput.appendChild(firstOption);
            
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.item_id;
                option.textContent = item.title;
                itemInput.appendChild(option);
            });
            
            // If current item is set, select it
            if (state.currentItemId) {
                itemInput.value = state.currentItemId;
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }

    // Create a new alert
    async function createAlert() {
        const alertTypeId = document.getElementById('alert-type-input').value;
        const itemId = document.getElementById('alert-item-input').value;
        const categoryId = document.getElementById('alert-category-input').value;
        const priceThreshold = document.getElementById('alert-price-input').value;
        
        if (!alertTypeId) {
            showAlert('Please select an alert type', 'warning');
            return;
        }
        
        // Check required fields based on alert type
        const alertTypeText = document.getElementById('alert-type-input').options[document.getElementById('alert-type-input').selectedIndex].text;
        
        switch (alertTypeText) {
            case 'Price Drop':
                if (!itemId) {
                    showAlert('Please select an item', 'warning');
                    return;
                }
                break;
            case 'New Item':
                if (!categoryId) {
                    showAlert('Please select a category', 'warning');
                    return;
                }
                break;
            case 'Back in Stock':
            case 'Seller Update':
                if (!itemId) {
                    showAlert('Please select an item', 'warning');
                    return;
                }
                break;
        }
        
        try {
            await apiRequest('/alerts', 'POST', {
                alert_type_id: alertTypeId,
                item_id: itemId || null,
                category_id: categoryId || null,
                price_threshold: priceThreshold || null
            });
            
            showAlert('Alert created successfully!', 'success');
            
            // Close modal and reload alerts
            closeModal();
            loadAlerts();
        } catch (error) {
            showAlert('Failed to create alert', 'danger');
            console.error('Failed to create alert:', error);
        }
    }

    // Utility Functions
    // Show alert message
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container');
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <span>${message}</span>
            <span class="close" data-action="closeAlert">&times;</span>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            closeAlert(alert);
        }, 5000);
    }

    // Close alert message
    function closeAlert(alert) {
        if (alert && alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }
});