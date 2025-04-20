document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        currentPage: 'home',
        currentItemId: null,
        user: null,
        token: localStorage.getItem('token'),
        alertCount: 0,
        notificationCount: 0
    };

    

   /* ---------- Sanitation helper utilities ---------- */
const sanitize = str => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;           // encoded version
  };
  
  const showFieldError = (el, msg) => {
    const old = el.nextElementSibling;
    if (old?.classList.contains('field-error')) old.remove();
  
    const e = document.createElement('div');
    e.className = 'field-error';
    e.textContent = msg;
    el.after(e);
  };

  const clearFieldErrors = formEl => {
    formEl.querySelectorAll('.field-error').forEach(e => e.remove());
  };
  
  /* ------------------------------------------- */
  


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
                checkForSellerNotifications();
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
                case 'markAllRead':
                    markAllAlertsAsRead();
                    break;
                case 'markNotificationRead':
                    const notificationId = e.target.closest('.notification-card').dataset.id;
                    markNotificationAsRead(notificationId);
                    break;
                case 'deleteAlert':
                    const alertToDeleteId = e.target.closest('.alert-card').dataset.id;
                    deleteAlert(alertToDeleteId);
                    break;
                case 'deleteItem':
                    const itemToDeleteId = e.target.dataset.id;
                    const itemTitle = e.target.closest('.sale-card')?.querySelector('.sale-title')?.textContent || 'this item';
                    confirmDeleteItem(itemToDeleteId, itemTitle);
                    break;
                case 'downloadItem':
                    const downloadItemId = e.target.dataset.id;
                    downloadPurchasedItem(downloadItemId);
                    break;
                case 'editItem':
                    const editItemId = e.target.dataset.id;
                    if (editItemId) {
                        showPriceEditDialog(editItemId);
                    } else {
                        console.error('No item ID found for edit action');
                    }
                    break;
                case 'editReview':
                    const reviewId = e.target.dataset.id;
                    const reviewElement = e.target.closest('.review');
                    editReview(reviewId, reviewElement);
                    break;
                case 'cancelEditReview':
                    const cancelReview = e.target.closest('.review');
                    cancelEditReview(cancelReview);
                    break;
                case 'closePriceEditDialog':
                    closePriceEditDialog();
                    break;
                case 'updatePrice':
                    submitPriceUpdate();
                    break;
            }
        }
    }

    // Navigate to a page
    function navigateTo(page, params = {}) {
        // Clear any previous state if needed
        if (page === 'home' || page === 'browse') {
            state.currentItemId = null;
        }
        
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
                if (params.itemId) {
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
                            if (purchaseButton.dataset.action === 'editItem') {
                                showPriceEditDialog(params.itemId);
                            } else {
                                purchaseItem(params.itemId);
                            }
                        });
                    }
                } else {
                    showAlert('Invalid item ID', 'danger');
                    navigateTo('browse');
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
                loadSellerNotifications();
                break;

                 /* ---------- SELL PAGE ---------- */
            case 'sell':
            // 1️⃣ must be logged‑in
            if (!state.user) {
                navigateTo('login');
                return;
                }

                // 2️⃣ render template & populate category <select>
                renderTemplate('sell-template', pageContent);
                
                // Load categories
                await loadCategoriesForSell();
                
                // Add submit handler for form
                // 3️⃣ wire up the form
                const sellForm = document.getElementById('sell-form');
                if (sellForm) {
    
                //live validation as the user types 
                sellForm.addEventListener('input', () => clearFieldErrors(sellForm));
                

                sellForm.addEventListener('submit', e => {
                        e.preventDefault();          // stay on the page
                        sellItem();                  // call the real function below
                    });
                }

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

                // Set up mark all as read button
                const markAllReadButton = document.getElementById('mark-all-read-button');
                if (markAllReadButton) {
                    markAllReadButton.addEventListener('click', () => {
                        markAllAlertsAsRead();
                    });
                }

                // Set up modal close
                const closeModalBtn = document.querySelector('.close-modal');
                closeModalBtn.addEventListener('click', () => {
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
        } else {
            container.innerHTML = `<div class="error">Template not found: ${templateId}</div>`;
        }
    }

    // Show price edit dialog
    function showPriceEditDialog(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }
        
        // Close existing dialog if any
        closePriceEditDialog();
        
        // Get the current item data
        apiRequest(`/items/${itemId}`, 'GET')
            .then(item => {
                // Create the price edit dialog element
                const dialog = document.createElement('div');
                dialog.id = 'price-edit-dialog';
                dialog.className = 'modal';
                dialog.innerHTML = `
                    <div class="modal-content">
                        <span class="close-button" data-action="closePriceEditDialog">&times;</span>
                        <h3>Edit Price for "${item.title}"</h3>
                        <div class="form-group">
                            <label for="edit-price-input">New Price ($)</label>
                            <input type="number" id="edit-price-input" min="0.01" step="0.01" value="${item.price}" required>
                        </div>
                        <input type="hidden" id="edit-item-id" value="${item.item_id}">
                        <button id="update-price-button" class="btn btn-primary">Update Price</button>
                    </div>
                `;

                // Add to the page
                document.body.appendChild(dialog);
                
                // Add direct event listener
                const updateButton = document.getElementById('update-price-button');
                updateButton.addEventListener('click', submitPriceUpdate);
                
                // Show the dialog
                dialog.style.display = 'block';
            })
            .catch(error => {
                showAlert('Failed to load item: ' + error.message, 'danger');
            });
    }

    // Close price edit dialog
    function closePriceEditDialog() {
        const dialog = document.getElementById('price-edit-dialog');
        if (dialog) {
            dialog.remove();
        }
    }

    // Submit price update
    function submitPriceUpdate() {
        const itemIdElement = document.getElementById('edit-item-id');
        const priceElement = document.getElementById('edit-price-input');
        
        if (!itemIdElement || !priceElement) {
            showAlert('Form elements not found', 'danger');
            return;
        }
        
        const itemId = itemIdElement.value;
        const newPrice = priceElement.value;
        
        if (!itemId) {
            showAlert('Item ID not found', 'danger');
            return;
        }
        
        // Validate price
        if (!newPrice || parseFloat(newPrice) <= 0) {
            showAlert('Please enter a valid price greater than 0', 'warning');
            return;
        }

        // Create FormData with just the price
        const formData = new FormData();
        formData.append('price', newPrice);
        
        // Update the item with just the price change
        apiRequest(`/items/${itemId}`, 'PUT', formData)
            .then(updatedItem => {
                showAlert('Price updated successfully!', 'success');
                
                // Close the dialog
                closePriceEditDialog();
                
                // Refresh the current page to show updated price
                if (state.currentPage === 'item' && state.params.itemId == itemId) {
                    loadItem(itemId);
                } else if (state.currentPage === 'profile') {
                    loadSales();
                }
            })
            .catch(error => {
                showAlert('Failed to update price: ' + error.message, 'danger');
            });
    }

    // Load categories for sell form
    async function loadCategoriesForSell() {
        const categoryInput = document.getElementById('item-category-input');
        if (!categoryInput) return;
    
        try {
            const categories = await apiRequest('/categories');
    
            // Keep the first option (or create one if it doesn't exist)
            let firstOption;
            if (categoryInput.options.length > 0) {
                firstOption = categoryInput.options[0];
            } else {
                firstOption = document.createElement('option');
                firstOption.value = '';
                firstOption.textContent = 'Select a category';
            }
            
            categoryInput.innerHTML = '';
            categoryInput.appendChild(firstOption);
    
            // Add all categories
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.category_id;
                option.textContent = category.name;
                categoryInput.appendChild(option);
            });
            
            return categories;
            
        } catch (error) {
            showAlert('Failed to load categories. Please try again.', 'danger');
            console.error('Failed to load categories:', error);
        }
    }

    // Sell a new item
    async function sellItem() {
        const title = document.getElementById('item-title-input').value.trim();
        const description = document.getElementById('item-description-input').value.trim();
        const price = document.getElementById('item-price-input').value;
        const categoryId = document.getElementById('item-category-input').value;
        const fileInput = document.getElementById('item-file-input');
        const thumbnailInput = document.getElementById('item-thumbnail-input');
        
        // Validation
        if (!title) {
            showAlert('Please enter a title', 'warning');
            return;
        }
        
        if (!price || parseFloat(price) <= 0) {
            showAlert('Please enter a valid price greater than 0', 'warning');
            return;
        }
        
        if (!categoryId) {
            showAlert('Please select a category', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('category_id', categoryId);

        // Only append file if one is selected
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        // Only append thumbnail if one is selected
        if (thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        try {
            // Use POST method for new items
            const item = await apiRequest('/items', 'POST', formData);
            
            showAlert('Item listed successfully!', 'success');

            // Navigate to item page
            navigateTo('item', { itemId: item.item_id });
        } catch (error) {
            showAlert('Failed to list item: ' + (error.message || 'Unknown error'), 'danger');
        }
    }

    // Edit a review
    function editReview(reviewId, reviewElement) {
        // Store the original content to restore if canceled
        if (!reviewElement.dataset.originalRating) {
            const ratingStars = reviewElement.querySelector('.star-rating').innerHTML;
            const commentText = reviewElement.querySelector('.review-comment').textContent;
            reviewElement.dataset.originalRating = ratingStars;
            reviewElement.dataset.originalComment = commentText;
            reviewElement.dataset.reviewId = reviewId;

            // Get current rating
            const activeStars = reviewElement.querySelectorAll('.star-rating .fas.fa-star').length;
            
            // Create edit form
            const editForm = document.createElement('form');
            editForm.className = 'edit-review-form';
            editForm.innerHTML = `
                <div class="rating-select">
                    <span>Rating: </span>
                    <div class="star-rating edit-stars">
                        <i class="${activeStars >= 1 ? 'fas' : 'far'} fa-star" data-rating="1"></i>
                        <i class="${activeStars >= 2 ? 'fas' : 'far'} fa-star" data-rating="2"></i>
                        <i class="${activeStars >= 3 ? 'fas' : 'far'} fa-star" data-rating="3"></i>
                        <i class="${activeStars >= 4 ? 'fas' : 'far'} fa-star" data-rating="4"></i>
                        <i class="${activeStars >= 5 ? 'fas' : 'far'} fa-star" data-rating="5"></i>
                    </div>
                    <input type="hidden" class="edit-rating-input" value="${activeStars}">
                </div>
                <div class="form-group">
                    <textarea class="edit-comment" rows="3">${commentText}</textarea>
                </div>
                <div class="edit-actions">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" data-action="cancelEditReview">Cancel</button>
                </div>
            `;
            
            // Replace the review content with the edit form
            reviewElement.querySelector('.review-comment').style.display = 'none';
            reviewElement.querySelector('.star-rating').style.display = 'none';
            reviewElement.appendChild(editForm);
            
            // Add star rating functionality
            const editStars = editForm.querySelectorAll('.edit-stars i');
            editStars.forEach(star => {
                star.addEventListener('click', () => {
                    const rating = star.dataset.rating;
                    editForm.querySelector('.edit-rating-input').value = rating;
                    
                    // Update star display
                    editStars.forEach(s => {
                        if (s.dataset.rating <= rating) {
                            s.classList.remove('far');
                            s.classList.add('fas');
                        } else {
                            s.classList.remove('fas');
                            s.classList.add('far');
                        }
                    });
                });
            });
            
            // Add submit handler
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                submitReviewEdit(reviewId, reviewElement);
            });
        }
    }

    // Submit review edit
    async function submitReviewEdit(reviewId, reviewElement) {
        const editForm = reviewElement.querySelector('.edit-review-form');
        const rating = editForm.querySelector('.edit-rating-input').value;
        const comment = editForm.querySelector('.edit-comment').value;
        
        // Validate rating
        if (!rating || isNaN(parseInt(rating)) || parseInt(rating) < 1 || parseInt(rating) > 5) {
            showAlert('Please select a valid rating between 1 and 5', 'warning');
            return;
        }
        
        try {
            await apiRequest(`/reviews/${reviewId}`, 'PUT', {
                rating: parseInt(rating),
                comment
            });
            
            showAlert('Review updated successfully!', 'success');
            
            // Update the review display with the new star rating
            const updatedStarRating = createStarRating(rating);
            
            reviewElement.querySelector('.star-rating').innerHTML = updatedStarRating;
            reviewElement.querySelector('.review-comment').textContent = comment;
            
            // Remove form and show original content
            reviewElement.removeChild(editForm);
            reviewElement.querySelector('.review-comment').style.display = 'block';
            reviewElement.querySelector('.star-rating').style.display = 'block';
            
            // Clear stored originals
            delete reviewElement.dataset.originalRating;
            delete reviewElement.dataset.originalComment;
            delete reviewElement.dataset.reviewId;
            
        } catch (error) {
            showAlert('Failed to update review: ' + error.message, 'danger');
        }
    }

    // Cancel review edit
    function cancelEditReview(reviewElement) {
        // Remove the edit form
        const editForm = reviewElement.querySelector('.edit-review-form');
        if (editForm) {
            reviewElement.removeChild(editForm);
        }
        
        // Show original content
        reviewElement.querySelector('.review-comment').style.display = 'block';
        reviewElement.querySelector('.star-rating').style.display = 'block';
        
        // Clear stored originals
        delete reviewElement.dataset.originalRating;
        delete reviewElement.dataset.originalComment;
        delete reviewElement.dataset.reviewId;
    }

    // Confirm delete item dialog
    function confirmDeleteItem(itemId, title) {
        if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
            deleteItem(itemId);
        }
    }

    // Delete an item
    async function deleteItem(itemId) {
        try {
            await apiRequest(`/items/${itemId}`, 'DELETE');
            
            showAlert('Item deleted successfully!', 'success');
            
            // If on item detail page, navigate back to profile
            if (state.currentPage === 'item') {
                navigateTo('home');
                switchTab('home');
            } else {
                // If on profile page, just reload sales
                loadSales();
            }
        } catch (error) {
            showAlert('Failed to delete item: ' + error.message, 'danger');
        }
    }

    // Download a purchased item
    async function downloadPurchasedItem(itemId) {
        try {
            // Get the purchase ID from purchases data
            const purchasesResponse = await apiRequest('/purchases');
            const purchases = purchasesResponse.purchases || purchasesResponse;
            const purchase = purchases.find(p => p.item_id === parseInt(itemId));
            
            if (!purchase) {
                showAlert('Item not found in your purchases', 'danger');
                return;
            }
            
            // Create temporary anchor to initiate download
            const a = document.createElement('a');
            a.href = `/api/purchases/${purchase.purchase_id}/download`;
            a.download = '';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            showAlert('Download started!', 'success');
        } catch (error) {
            showAlert('Failed to download item: ' + error.message, 'danger');
        }
    }

    // Check for seller notifications
    async function checkForSellerNotifications() {
        if (!state.user) return;

        try {
            const notifications = await apiRequest('/purchases/notifications');
            const unreadCount = notifications.filter(notification => !notification.is_read).length;

            state.notificationCount = unreadCount;
            updateAuthUI();
        } catch (error) {
            console.error('Failed to check for seller notifications:', error);
        }
    }

    // Mark notification as read
    async function markNotificationAsRead(notificationId) {
        if (!notificationId) return;

        try {
            await apiRequest(`/purchases/notifications/${notificationId}/read`, 'PUT');

            // Reload notifications
            loadSellerNotifications();
            
            // Update notification count
            checkForSellerNotifications();
        } catch (error) {
            showAlert('Failed to mark notification as read', 'danger');
        }
    }
    
    // Mark all alerts as read
    async function markAllAlertsAsRead() {
        try {
            await apiRequest('/alerts/read-all', 'PUT');
            
            showAlert('All alerts marked as read', 'success');
            
            // Reload alerts
            loadAlerts();
            
            // Update alert count
            checkForAlerts();
        } catch (error) {
            showAlert('Failed to mark all alerts as read', 'danger');
        }
    }

    // Update UI elements based on authentication state
    function updateAuthUI() {
        const isLoggedIn = !!state.user;

        // Update navigation
        const loginLink = document.getElementById('login-link');
        const registerLink = document.getElementById('register-link');
        const profileLink = document.getElementById('profile-link');
        const logoutLink = document.getElementById('logout-link');
        const sellLink = document.getElementById('sell-link');
        const alertsLink = document.getElementById('alerts-link');
        
        if (loginLink) loginLink.classList.toggle('hidden', isLoggedIn);
        if (registerLink) registerLink.classList.toggle('hidden', isLoggedIn);
        if (profileLink) profileLink.classList.toggle('hidden', !isLoggedIn);
        if (logoutLink) logoutLink.classList.toggle('hidden', !isLoggedIn);
        if (sellLink) sellLink.classList.toggle('hidden', !isLoggedIn);
        if (alertsLink) alertsLink.classList.toggle('hidden', !isLoggedIn);

        // Update alert badge
        const alertBadge = document.getElementById('alert-badge');
        if (alertBadge) {
            alertBadge.classList.toggle('hidden', state.alertCount === 0);
            alertBadge.textContent = state.alertCount;
        }
        
        // Update notification badge
        const notificationBadge = document.getElementById('notification-badge');
        if (notificationBadge) {
            notificationBadge.classList.toggle('hidden', state.notificationCount === 0);
            notificationBadge.textContent = state.notificationCount;
        }
        
        // Also update the notification badge in the tab if it exists
        const notificationBadgeTab = document.getElementById('notification-badge-tab');
        if (notificationBadgeTab) {
            notificationBadgeTab.classList.toggle('hidden', state.notificationCount === 0);
            notificationBadgeTab.textContent = state.notificationCount;
        }

        // Update auth-required elements
        document.querySelectorAll('.auth-required').forEach(element => {
            element.classList.toggle('hidden', !isLoggedIn);
        });
    }

    // API Requests
    // Make an API request
    async function apiRequest(endpoint, method = 'GET', data = null) {
        // Prevent requests with undefined IDs
        if (endpoint.includes('/undefined') || endpoint.includes('/null')) {
            console.warn('Prevented request to invalid endpoint:', endpoint);
            return Promise.reject(new Error('Invalid ID'));
        }

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

            // Check for alerts and notifications
            checkForAlerts();
            checkForSellerNotifications();
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
        state.currentItemId = null;

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
            const alertsResponse = await apiRequest('/alerts');
            const alerts = alertsResponse.alerts || alertsResponse;
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

        container.innerHTML = '<div class="loading"></div>';

        try {
            const response = await apiRequest('/items?limit=4');
            const items = response.items || response;

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
          <i class="fas ${sanitize(icon)}"></i>
        </div>
        <div class="category-name">${sanitize(category.name)}</div>
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
        
        // Add pagination
        const page = params.page || 1;
        const limit = params.limit || 12;
        queryParams.push(`page=${page}`);
        queryParams.push(`limit=${limit}`);

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        try {
            const response = await apiRequest(`/items${queryString}`);
            const items = response.items || response;
            const pagination = response.pagination;

            if (items.length === 0) {
                container.innerHTML = '<p class="no-items">No items found</p>';
                return;
            }

            container.innerHTML = '';

            items.forEach(item => {
                const itemElement = createItemCard(item);
                container.appendChild(itemElement);
            });
            
            // Add pagination controls if available
            if (pagination) {
                const paginationElement = createPagination(pagination, params);
                container.appendChild(paginationElement);
            }
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load items</p>';
        }
    }

    // Create pagination controls
    function createPagination(pagination, currentParams) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';
        
        // Previous page button
        if (pagination.page > 1) {
            const prevButton = document.createElement('button');
            prevButton.className = 'btn btn-secondary';
            prevButton.innerHTML = '&laquo; Previous';
            prevButton.addEventListener('click', () => {
                const newParams = { ...currentParams, page: pagination.page - 1 };
                loadItems(newParams);
            });
            paginationDiv.appendChild(prevButton);
        }
        
        // Page number
        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
        paginationDiv.appendChild(pageInfo);
        
        // Next page button
        if (pagination.page < pagination.totalPages) {
            const nextButton = document.createElement('button');
            nextButton.className = 'btn btn-secondary';
            nextButton.innerHTML = 'Next &raquo;';
            nextButton.addEventListener('click', () => {
                const newParams = { ...currentParams, page: pagination.page + 1 };
                loadItems(newParams);
            });
            paginationDiv.appendChild(nextButton);
        }
        
        return paginationDiv;
    }

    // Create an item card element
    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.item_id;

        // Make entire card clickable
        card.addEventListener('click', () => {
            viewItem(item.item_id);
        });

        // Default thumbnail if none provided
        //  Sanitized
        const thumbnail = item.thumbnail_path || '/img/default-thumbnail.png';

             card.innerHTML = `
            <div class="item-image">
                <img src="${sanitize(thumbnail)}" alt="${sanitize(item.title)}">
            </div>
            <div class="item-details">
                <h3 class="item-title">${sanitize(item.title)}</h3>
                <div class="item-price">$${parseFloat(item.price).toFixed(2)}</div>
                <div class="item-seller">by ${sanitize(item.seller_name || 'Unknown')}</div>
            </div>
            `;


        return card;
    }

    // View an item
    function viewItem(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'warning');
            return;
        }
        navigateTo('item', { itemId });
    }

    // Item Detail Page Functions
    // Load item details
    async function loadItem(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

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

            // Update purchase button and alert button
            const purchaseButton = document.getElementById('purchase-button');
            const setAlertButton = document.getElementById('set-alert-button');
            const itemActions = document.querySelector('.item-actions');

            if (state.user && state.user.user_id === item.seller_id) {
                // Item owner view - show edit and delete buttons
                purchaseButton.textContent = 'Edit Price';
                purchaseButton.dataset.action = 'editItem';
                purchaseButton.dataset.id = item.item_id;
                
                // Remove any existing delete buttons first
                const existingDeleteBtn = itemActions.querySelector('.btn-danger');
                if (existingDeleteBtn) {
                    existingDeleteBtn.remove();
                }
                
                // Create delete button
                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-danger';
                deleteButton.textContent = 'Delete Item';
                deleteButton.dataset.id = item.item_id;
                deleteButton.dataset.action = 'deleteItem';
                
                // Hide alert button for owner
                if (setAlertButton) {
                    setAlertButton.classList.add('hidden');
                }
                
                // Add delete button to actions container
                itemActions.appendChild(deleteButton);
            } else {
                // Non-owner view - show purchase button
                purchaseButton.textContent = 'Purchase';
                purchaseButton.dataset.action = 'purchaseItem';
                
                // Check if user has already purchased this item
                if (state.user) {
                    try {
                        const purchasesResponse = await apiRequest('/purchases');
                        const purchases = purchasesResponse.purchases || purchasesResponse;
                        const alreadyPurchased = purchases.some(p => p.item_id === parseInt(itemId));
                        
                        if (alreadyPurchased) {
                            // Already purchased - show download button instead
                            purchaseButton.textContent = 'Download';
                            purchaseButton.dataset.action = 'downloadItem';
                            purchaseButton.dataset.id = itemId;
                            
                            // Hide alert button for buyers who already purchased
                            if (setAlertButton) {
                                setAlertButton.classList.add('hidden');
                            }
                            
                            // Show review form
                            const reviewForm = document.querySelector('.add-review');
                            if (reviewForm) {
                                reviewForm.classList.remove('hidden');
                            }
                        }
                    } catch (error) {
                        console.error('Error checking purchase status:', error);
                    }
                }
            }
        } catch (error) {
            showAlert('Failed to load item details: ' + error.message, 'danger');
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
                
        // Check if this is the current user's review
        const isUserReview = state.user && review.reviewer_id === state.user.user_id;
        
        // Add edit buttons for user's own reviews
        const editButton = isUserReview ? 
            `<div class="review-actions">
                <button class="btn btn-secondary btn-sm" data-action="editReview" data-id="${review.review_id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>` : '';

        reviewElement.innerHTML = `
            <div class="review-header">
                <span class="reviewer">${sanitize(review.reviewer_name)}</span>
                <span class="review-date">${sanitize(date)}</span>
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
        rating = parseInt(rating);
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
        // Convert rating to number
        rating = parseInt(rating);
        // Find all star icons
        const stars = document.querySelectorAll('.star-rating i');

        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            // Add active class to stars with rating <= selected rating
            if (starRating <= rating) {
                star.classList.remove('far');
                star.classList.add('fas', 'active');
            } else {
                star.classList.remove('fas', 'active');
                star.classList.add('far');
            }
        });

        // Set the hidden input value
        document.getElementById('rating-input').value = rating;
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
                rating: parseInt(rating),
                comment
            });

            showAlert('Review submitted successfully!', 'success');

            // Reload item to show new review
            loadItem(itemId);

            // Clear form
            document.getElementById('review-comment').value = '';
            updateStarRating(5);
        } catch (error) {
            showAlert('Failed to submit review: ' + error.message, 'danger');
        }
    }

    // Purchase an item
    async function purchaseItem(itemId) {
        // Confirm the purchase
        if (!confirm('Are you sure you want to purchase this item?')) {
            return;
        }
        
        try {
            await apiRequest('/purchases', 'POST', { item_id: itemId });

            showAlert('Item purchased successfully!', 'success');

            // Navigate to profile/purchases
            navigateTo('profile');
            switchTab('purchases');
        } catch (error) {
            showAlert('Failed to purchase item: ' + error.message, 'danger');
        }
    }

    // Open set alert modal for an item
    function openSetAlertModal(itemId) {
        // First check if the user has already purchased this item
        if (state.user) {
            apiRequest('/purchases')
                .then(response => {
                    const purchases = response.purchases || response;
                    const alreadyPurchased = purchases.some(p => p.item_id === parseInt(itemId));
                    
                    if (alreadyPurchased) {
                        showAlert('You have already purchased this item, no need for alerts', 'info');
                        return;
                    }
                    
                    // Continue with opening the alert modal if not purchased
                    navigateTo('alerts');
                    
                    // Wait for page to load and then open modal
                    setTimeout(() => {
                        openNewAlertModal();
                        
                        // Pre-select item
                        const alertItemInput = document.getElementById('alert-item-input');
                        if (alertItemInput) {
                            alertItemInput.value = itemId;
                        }
                        
                        // Set alert type to Price Drop by default
                        const alertTypeInput = document.getElementById('alert-type-input');
                        if (alertTypeInput && alertTypeInput.options.length > 0) {
                            const priceDropOption = Array.from(alertTypeInput.options).find(opt => 
                                opt.textContent === 'Price Drop'
                            );
                            
                            if (priceDropOption) {
                                alertTypeInput.value = priceDropOption.value;
                                // Trigger change event to update form
                                const event = new Event('change');
                                alertTypeInput.dispatchEvent(event);
                            }
                        }
                    }, 500);
                })
                .catch(error => {
                    console.error('Error checking purchase status:', error);
                    
                    // Fall back to opening the modal anyway
                    navigateTo('alerts');
                    setTimeout(() => {
                        openNewAlertModal();
                        const alertItemInput = document.getElementById('alert-item-input');
                        if (alertItemInput) {
                            alertItemInput.value = itemId;
                        }
                    }, 500);
                });
        } else {
            // Just open the modal if not logged in (auth will be checked by the alerts page)
            navigateTo('alerts');
            setTimeout(() => {
                openNewAlertModal();
                const alertItemInput = document.getElementById('alert-item-input');
                if (alertItemInput) {
                    alertItemInput.value = itemId;
                }
            }, 500);
        }
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
            document.getElementById('profile-full-name').value = profile.full_name || '';

            // Update profile image
            const profileImage = document.getElementById('profile-image');
            profileImage.src = profile.profile_image || '/img/default-profile.png';
        } catch (error) {
            showAlert('Failed to load profile', 'danger');
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
            showAlert('Failed to update profile: ' + error.message, 'danger');
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
            showAlert('Failed to update profile image: ' + error.message, 'danger');
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
            const response = await apiRequest('/purchases');
            const purchases = response.purchases || response;

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
        }
    }

    // Load seller notifications
    async function loadSellerNotifications() {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const notifications = await apiRequest('/purchases/notifications');

            if (notifications.length === 0) {
                container.innerHTML = '<p class="no-items">No notifications yet</p>';
                return;
            }

            container.innerHTML = '';

            notifications.forEach(notification => {
                const notificationElement = createNotificationElement(notification);
                container.appendChild(notificationElement);
            });
            
            // Update notification count
            state.notificationCount = notifications.filter(notification => !notification.is_read).length;
            updateAuthUI();
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load notifications</p>';
        }
    }

    // Create notification element
    function createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = 'notification-card';
        
        if (!notification.is_read) {
            element.classList.add('unread');
        }
        
        element.dataset.id = notification.notification_id;
        
        const date = new Date(notification.created_at).toLocaleDateString();
        
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">Item Sold: ${notification.item_title}</div>
                <div class="notification-info">Purchased by ${notification.buyer_name} for $${parseFloat(notification.purchase_price).toFixed(2)}</div>
                <div class="notification-date">${date}</div>
            </div>
            <div class="notification-actions">
                ${!notification.is_read ? `<button class="btn btn-secondary" data-action="markNotificationRead">Mark as Read</button>` : ''}
            </div>
        `;
        
        return element;
    }

    // Create purchase element
    function createPurchaseElement(purchase) {
        const element = document.createElement('div');
        element.className = 'purchase-card';
        
        // Add class for deleted items
        if (purchase.is_deleted) {
            element.classList.add('item-deleted');
        }

        const date = new Date(purchase.purchase_date).toLocaleDateString();
        
        // Add message for deleted items
        const deletedNotice = purchase.is_deleted ? 
            '<div class="deleted-notice">(Item no longer listed)</div>' : '';
            //sanitized
        element.innerHTML = `
            <div class="purchase-image">
                <img src="${sanitize(purchase.thumbnail_path) || '/img/default-thumbnail.png'}" alt="${sanitize(purchase.title)}">
            </div>
            <div class="purchase-details">
                <div class="purchase-title">${sanitize(purchase.title)}</div>
                ${deletedNotice}
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
            const salesResponse = await apiRequest('/items?seller=' + state.user.user_id);
            const sales = salesResponse.items || salesResponse;

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
        }
    }

    // Create sale element
    function createSaleElement(sale) {
        const element = document.createElement('div');
        element.className = 'sale-card';
        
        // Add class for deleted items
        if (sale.is_deleted) {
            element.classList.add('item-deleted');
        }

        element.innerHTML = `
            <div class="sale-image">
                <img src="${sanitize(sale.thumbnail_path) || '/img/default-thumbnail.png'}" alt="${sanitize(sale.title)}">
            </div>
            <div class="sale-details">
                <div class="sale-title">${sanitize(sale.title)}</div>
                <div class="sale-price">$${parseFloat(sale.price).toFixed(2)}</div>
                <div class="sale-date">Listed on ${new Date(sale.created_at).toLocaleDateString()}</div>
                ${sale.is_deleted ? '<div class="deleted-notice">(No longer listed)</div>' : ''}
            </div>
            <div class="sale-actions">
                ${!sale.is_deleted ? `
                    <button class="btn btn-secondary" data-action="editItem" data-id="${sale.item_id}">
                        <i class="fas fa-edit"></i> Edit Price
                    </button>
                ` : ''}
                <button class="btn btn-danger" data-action="deleteItem" data-id="${sale.item_id}">
                    <i class="fas fa-trash"></i> Delete
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
            // Sell an item  (replace the whole previous function)
        async function sellItem () {
            const form = document.getElementById('sell-form');
            clearFieldErrors(form);
        
            // --- grab fields -------------------------------
            const titleEl = document.getElementById('item-title-input');
            const descEl  = document.getElementById('item-description-input');
            const priceEl = document.getElementById('item-price-input');
            const catEl   = document.getElementById('item-category-input');
            const fileEl  = document.getElementById('item-file-input');
            const thumbEl = document.getElementById('item-thumbnail-input');
        
            const title = titleEl.value.trim();
            const description = descEl.value.trim();
            const price = parseFloat(priceEl.value);
            const categoryId = catEl.value;
        
            // --- client‑side validation --------------------
            let bad = false;
        
            const titleOk = /^[\w\s\-&'!.:,()]{3,60}$/.test(title);
            if (!titleOk) {
            showFieldError(titleEl, '3‑60 letters/numbers & punctuation only');
            bad = true;
            }
            if (!description) {
            showFieldError(descEl, 'Description is required');
            bad = true;
            }
            if (isNaN(price) || price < 0.25) {
            showFieldError(priceEl, 'Price must be at least $0.25');
            bad = true;
            }
            if (!categoryId) {
            showFieldError(catEl, 'Choose a category');
            bad = true;
            }
            if (bad) return;
        
            // --- build payload -----------------------------
            const formData = new FormData();
            formData.append('title',        sanitize(title));
            formData.append('description',  sanitize(description));
            formData.append('price',        price);
            formData.append('category_id',  categoryId);
            if (fileEl.files[0])  formData.append('file',      fileEl.files[0]);
            if (thumbEl.files[0]) formData.append('thumbnail', thumbEl.files[0]);
        
            // --- send to API -------------------------------
            try {
            const item = await apiRequest('/items', 'POST', formData);
            showAlert('Item listed successfully!', 'success');
            navigateTo('item', { itemId: item.item_id });
            } catch (err) {
            showAlert('Failed to list item: ' + err.message, 'danger');
            console.error(err);
            }
        }
  
  
    // Alerts Page Functions
    // Load user alerts
    async function loadAlerts() {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const alertsResponse = await apiRequest('/alerts');
            const alerts = alertsResponse.alerts || alertsResponse;

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
                if (alert.price_threshold) {
                    alertInfo += ` (threshold: $${parseFloat(alert.price_threshold).toFixed(2)})`;
                }
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
            //sanitized
        element.innerHTML = `
            <div class="alert-content">
                   <div class="alert-title">${sanitize(alertTitle)}</div>
                    <div class="alert-info">${sanitize(alertInfo)}</div>
                    <div class="alert-date">${sanitize(new Date(alert.created_at).toLocaleString())}</div>
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
        }
    }

    // Open new alert modal
    function openNewAlertModal() {
        const modal = document.getElementById('new-alert-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    // Close modal
    function closeModal() {
        const modal = document.getElementById('new-alert-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Update alert form based on selected alert type
    function updateAlertForm() {
        const alertTypeInput = document.getElementById('alert-type-input');
        if (!alertTypeInput) return;
        
        const alertType = alertTypeInput.value;
        const selectedIndex = alertTypeInput.selectedIndex;
        if (selectedIndex === -1) return;
        
        const alertTypeText = alertTypeInput.options[selectedIndex].text;

        // Show/hide fields based on alert type
        const itemGroup = document.getElementById('alert-item-group');
        const categoryGroup = document.getElementById('alert-category-group');
        const priceGroup = document.getElementById('alert-price-group');
        
        if (itemGroup) itemGroup.classList.add('hidden');
        if (categoryGroup) categoryGroup.classList.add('hidden');
        if (priceGroup) priceGroup.classList.add('hidden');

        if (!alertType) return;

        switch (alertTypeText) {
            case 'Price Drop':
                if (itemGroup) itemGroup.classList.remove('hidden');
                if (priceGroup) priceGroup.classList.remove('hidden');
                break;
            case 'New Item':
                if (categoryGroup) categoryGroup.classList.remove('hidden');
                break;
            case 'Back in Stock':
            case 'Seller Update':
                if (itemGroup) itemGroup.classList.remove('hidden');
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
            const response = await apiRequest('/items');
            const items = response.items || response;

            // Keep the first option
            const firstOption = itemInput.options[0];
            itemInput.innerHTML = '';
            itemInput.appendChild(firstOption);

            // If user is logged in, filter out items they've already purchased
            let purchasedItemIds = [];
            if (state.user) {
                try {
                    const purchasesResponse = await apiRequest('/purchases');
                    const purchases = purchasesResponse.purchases || purchasesResponse;
                    purchasedItemIds = purchases.map(p => p.item_id);
                } catch (error) {
                    console.error('Error fetching purchases:', error);
                }
            }

            // Filter out items the user already owns or has purchased
            const filteredItems = items.filter(item => {
                // Skip user's own items
                if (state.user && item.seller_id === state.user.user_id) {
                    return false;
                }
                
                // Skip purchased items
                if (purchasedItemIds.includes(item.item_id)) {
                    return false;
                }
                
                return true;
            });

            filteredItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.item_id;
                option.textContent = item.title;
                itemInput.appendChild(option);
            });

            // If current item is set, select it
            if (state.currentItemId) {
                // Only select if it's in the options (not purchased)
                const exists = Array.from(itemInput.options).some(opt => 
                    opt.value === state.currentItemId.toString()
                );
                
                if (exists) {
                    itemInput.value = state.currentItemId;
                }
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }

    // Create a new alert
    async function createAlert() {
        const alertTypeInput = document.getElementById('alert-type-input');
        const itemInput = document.getElementById('alert-item-input');
        const categoryInput = document.getElementById('alert-category-input');
        const priceInput = document.getElementById('alert-price-input');
        
        if (!alertTypeInput) return;
        
        const alertTypeId = alertTypeInput.value;
        const itemId = itemInput ? itemInput.value : null;
        const categoryId = categoryInput ? categoryInput.value : null;
        const priceThreshold = priceInput ? priceInput.value : null;

        if (!alertTypeId) {
            showAlert('Please select an alert type', 'warning');
            return;
        }

        // Check required fields based on alert type
        const selectedIndex = alertTypeInput.selectedIndex;
        if (selectedIndex === -1) {
            showAlert('Please select a valid alert type', 'warning');
            return;
        }
        
        const alertTypeText = alertTypeInput.options[selectedIndex].text;

        switch (alertTypeText) {
            case 'Price Drop':
                if (!itemId) {
                    showAlert('Please select an item', 'warning');
                    return;
                }
                
                if (!priceThreshold || parseFloat(priceThreshold) <= 0) {
                    showAlert('Please enter a valid price threshold', 'warning');
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
            // For price drop alerts, check if threshold is below current price
            if (alertTypeText === 'Price Drop' && itemId) {
                try {
                    const item = await apiRequest(`/items/${itemId}`);
                    const currentPrice = parseFloat(item.price);
                    const threshold = parseFloat(priceThreshold);
                    
                    if (threshold >= currentPrice) {
                        showAlert(`Price threshold must be below the current price ($${currentPrice.toFixed(2)})`, 'warning');
                        return;
                    }
                } catch (error) {
                    console.error('Error checking item price:', error);
                    // Continue anyway
                }
            }
            
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
            showAlert('Failed to create alert: ' + error.message, 'danger');
        }
    }

    // Add CSS for price edit dialog
    const style = document.createElement('style');
    style.textContent = `
        #price-edit-dialog {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }
        
        #price-edit-dialog .modal-content {
            background-color: #fff;
            margin: 15% auto;
            padding: 20px;
            border-radius: 5px;
            max-width: 400px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        #price-edit-dialog h3 {
            margin-top: 0;
        }
        
        #price-edit-dialog .close-button {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        #price-edit-dialog .close-button:hover {
            color: #333;
        }
    `;
    document.head.appendChild(style);

    // Utility Functions
    // Show alert message
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;

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