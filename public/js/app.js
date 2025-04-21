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
  
 
// Injects red text *and* adds a red border to the offending field
const showFieldError = (el, msg) => {
    // Remove any old message or error styling
    const oldMsg = el.nextElementSibling;
    if (oldMsg?.classList.contains('field-error')) oldMsg.remove();
    el.classList.remove('error');
  
    // Insert the new error message
    const err = document.createElement('div');
    err.className = 'field-error';
    err.textContent = msg;
    el.after(err);
  
    // Add visual cue to the input/select/textarea
    el.classList.add('error');
  };

  // Clears all inline messages and red borders from a form
const clearFieldErrors = formEl => {
    formEl.querySelectorAll('.field-error').forEach(e => e.remove());
    formEl.querySelectorAll('.error').forEach(input => input.classList.remove('error'));
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
            const parts = pageFromHash.split('/');
            if (parts[0] === 'item' && parts[1]) {
                // Handle deep link to item page
                navigateTo('item', { itemId: parts[1] });
            } else {
                navigateTo(pageFromHash);
            }
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

        // Handle direct price update button clicks
        document.addEventListener('click', function (e) {
            if (e.target && e.target.id === 'update-price-button') {
                submitPriceUpdate();
            }
        });

        // Handle close dialog button clicks
        document.addEventListener('click', function (e) {
            if (e.target && e.target.classList.contains('close-button')) {
                closePriceEditDialog();
            }
        });
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
                    const itemCardEl = e.target.closest('.item-card');
                    if (itemCardEl && itemCardEl.dataset.id) {
                        viewItem(itemCardEl.dataset.id);
                    }
                    break;
                case 'browseCategory':
                    const categoryCardEl = e.target.closest('.category-card');
                    if (categoryCardEl && categoryCardEl.dataset.id) {
                        navigateTo('browse', { categoryId: categoryCardEl.dataset.id });
                    }
                    break;
                case 'markRead':
                    const alertCardEl = e.target.closest('.alert-card');
                    if (alertCardEl && alertCardEl.dataset.id) {
                        markAlertAsRead(alertCardEl.dataset.id);
                    }
                    break;
                case 'markAllRead':
                    markAllAlertsAsRead();
                    break;
                case 'markNotificationRead':
                    const notificationCardEl = e.target.closest('.notification-card');
                    if (notificationCardEl && notificationCardEl.dataset.id) {
                        markNotificationAsRead(notificationCardEl.dataset.id);
                    }
                    break;
                case 'deleteAlert':
                    const alertToDeleteCardEl = e.target.closest('.alert-card');
                    if (alertToDeleteCardEl && alertToDeleteCardEl.dataset.id) {
                        deleteAlert(alertToDeleteCardEl.dataset.id);
                    }
                    break;
                case 'deleteItem':
                    if (e.target.dataset.id) {
                        const itemTitle = e.target.closest('.sale-card')?.querySelector('.sale-title')?.textContent || 'this item';
                        confirmDeleteItem(e.target.dataset.id, itemTitle);
                    }
                    break;
                case 'downloadItem':
                    if (e.target.dataset.id) {
                        downloadPurchasedItem(e.target.dataset.id);
                    }
                    break;
                case 'editItem':
                    const itemId = e.target.dataset.id || state.currentItemId;
                    if (itemId) {
                        showPriceEditDialog(itemId);
                    } else {
                        console.error('No item ID found for edit action');
                    }
                    break;
                case 'editReview':
                    if (e.target.dataset.id) {
                        const reviewElement = e.target.closest('.review');
                        editReview(e.target.dataset.id, reviewElement);
                    }
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

        // Save item ID in state if provided
        if (page === 'item' && params.itemId) {
            state.currentItemId = params.itemId;
            // Update URL hash with item ID for deep linking
            window.location.hash = `item/${params.itemId}`;
        } else {
            // Update URL hash
            window.location.hash = page;
        }

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
                if (searchButton) {
                    searchButton.addEventListener('click', () => {
                        const searchInput = document.getElementById('search-input');
                        if (searchInput) {
                            loadItems({ search: searchInput.value });
                        }
                    });
                }

                const categoryFilter = document.getElementById('category-filter');
                if (categoryFilter) {
                    categoryFilter.addEventListener('change', () => {
                        loadItems({ category: categoryFilter.value });
                    });
                }

                // Load items with initial params
                loadItems(params);
                break;

            case 'item':
                renderTemplate('item-detail-template', pageContent);
                if (params.itemId) {
                    loadItem(params.itemId);

                    // Set up back button
                    const backButton = document.getElementById('back-button');
                    if (backButton) {
                        backButton.addEventListener('click', () => {
                            navigateTo('browse');
                        });
                    }

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
                                const ratingInput = document.getElementById('rating-input');
                                if (ratingInput) {
                                    ratingInput.value = rating;
                                    updateStarRating(rating);
                                }
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
                if (loginForm) {
                    loginForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        login();
                    });
                }
                break;

            case 'register':
                if (state.user) {
                    navigateTo('profile');
                    return;
                }

                renderTemplate('register-template', pageContent);

                const registerForm = document.getElementById('register-form');
                if (registerForm) {
                    registerForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        register();
                    });
                }
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
                if (profileForm) {
                    profileForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        updateProfile();
                    });
                }

                // Set up profile image upload
                const profileImageUpload = document.getElementById('profile-image-upload');
                if (profileImageUpload) {
                    profileImageUpload.addEventListener('change', () => {
                        uploadProfileImage();
                    });
                }

                // Set up tabs
                const tabItems = document.querySelectorAll('.tab-item');
                tabItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const tab = item.dataset.tab;
                        if (tab) {
                            switchTab(tab);
                        }
                    });
                });

                // Load purchases and sales
                loadPurchases();
                loadSales();
                loadSellerNotifications();
                break;

            case 'sell':
                if (!state.user) {
                    navigateTo('login');
                    return;
                }

                renderTemplate('sell-template', pageContent);

                // Load categories
                await loadCategoriesForSell();

                // Add submit handler for form
                const sellForm = document.getElementById('sell-form');
                if (sellForm) {
                    sellForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        sellItem();
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
                if (newAlertButton) {
                    newAlertButton.addEventListener('click', () => {
                        openNewAlertModal();
                    });
                }

                // Set up mark all as read button
                const markAllReadButton = document.getElementById('mark-all-read-button');
                if (markAllReadButton) {
                    markAllReadButton.addEventListener('click', () => {
                        markAllAlertsAsRead();
                    });
                }

                // Set up modal close
                const closeModalBtn = document.querySelector('.close-modal');
                if (closeModalBtn) {
                    closeModalBtn.addEventListener('click', () => {
                        closeModal();
                    });
                }

                // Set up new alert form
                const newAlertForm = document.getElementById('new-alert-form');
                if (newAlertForm) {
                    newAlertForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        createAlert();
                    });
                }

                // Set up alert type change
                const alertTypeInput = document.getElementById('alert-type-input');
                if (alertTypeInput) {
                    alertTypeInput.addEventListener('change', () => {
                        updateAlertForm();
                    });
                }

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
                        <span class="close-button">&times;</span>
                        <h3>Edit Price for "${item.title}"</h3>
                        <div class="form-group">
                            <label for="edit-price-input">New Price ($)</label>
                            <input type="number" id="edit-price-input" min="0.01" step="0.01" value="${item.price}" required>
                        </div>
                        <input type="hidden" id="edit-item-id" value="${item.item_id}">
                        <button type="button" id="update-price-button" class="btn btn-primary">Update Price</button>
                    </div>
                `;

                // Add to the page
                document.body.appendChild(dialog);

                // Show the dialog
                dialog.style.display = 'block';

                // Set up direct event listeners without event delegation
                const updateButton = document.getElementById('update-price-button');
                if (updateButton) {
                    // Use a one-time event listener to prevent double-firing
                    updateButton.addEventListener('click', submitPriceUpdate, { once: true });
                }

                const closeButton = dialog.querySelector('.close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', closePriceEditDialog);
                }
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
    function submitPriceUpdate(e) {
        // Prevent any event bubbling
        if (e) e.stopPropagation();

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

        // Disable the button to prevent double-click
        const updateButton = document.getElementById('update-price-button');
        if (updateButton) updateButton.disabled = true;

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
                // Re-enable the button if there was an error
                if (updateButton) updateButton.disabled = false;
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
        const formEl        = document.getElementById('sell-form');
        const titleInput    = document.getElementById('item-title-input');
        const descInput     = document.getElementById('item-description-input');
        const priceInput    = document.getElementById('item-price-input');
        const categoryInput = document.getElementById('item-category-input');
        const fileInput     = document.getElementById('item-file-input');
        const thumbInput    = document.getElementById('item-thumbnail-input');
      
        clearFieldErrors(formEl);
      
        const title       = titleInput.value.trim();
        const description = descInput.value.trim();
        const price       = priceInput.value;
        const categoryId  = categoryInput.value;
      
        let hasError = false;
      
        // Title: required + pattern
        if (!title) {
          showFieldError(titleInput, 'Please enter a title');
          hasError = true;
        } else if (titleInput.validity.patternMismatch) {
          // Use the input’s title attribute to show a helpful message
          showFieldError(titleInput, titleInput.title);
          hasError = true;
        }
      
        // Description: required
        if (!description) {
          showFieldError(descInput, 'Please enter a description');
          hasError = true;
        }
      
        // Price: required + > 0 + respect min attribute
        if (!price) {
          showFieldError(priceInput, 'Please enter a price');
          hasError = true;
        } else if (parseFloat(price) <= 0) {
          showFieldError(priceInput, 'Enter a price above $0');
          hasError = true;
        } else if (priceInput.validity.rangeUnderflow) {
          showFieldError(priceInput, `Minimum price is $${priceInput.min}`);
          hasError = true;
        }
      
        // Category: required
        if (!categoryId) {
          showFieldError(categoryInput, 'Please select a category');
          hasError = true;
        }
      
                    // ── NEW: File‑size limits ──
            const MAX_FILE_SIZE   = 50 * 1024 * 1024;  // 50 MB
            const MAX_THUMB_SIZE  = 5  * 1024 * 1024;  // 5 MB

            if (fileInput.files[0] && fileInput.files[0].size > MAX_FILE_SIZE) {
                showFieldError(fileInput, 'Main file must be under 50 MB');
                hasError = true;
            }

            if (thumbInput.files[0] && thumbInput.files[0].size > MAX_THUMB_SIZE) {
                showFieldError(thumbInput, 'Thumbnail must be under 5 MB');
                hasError = true;
            }
      
        // If anything failed, bail out now
        if (hasError) return;
      
        // 4) If you reach here, all fields are valid—proceed as before
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('category_id', categoryId);
        if (fileInput.files[0])  formData.append('file', fileInput.files[0]);
        if (thumbInput.files[0]) formData.append('thumbnail', thumbInput.files[0]);
      
        try {
          const item = await apiRequest('/items', 'POST', formData);
          showAlert('Item listed successfully!', 'success');
          navigateTo(item.item_id ? 'item' : 'profile', item.item_id ? { itemId: item.item_id } : {});
        } catch (error) {
          showAlert('Failed to list item: ' + error.message, 'danger');
        }
      }
      

    // Edit a review
    function editReview(reviewId, reviewElement) {
        if (!reviewElement) return;

        // Store the original content to restore if canceled
        if (!reviewElement.dataset.originalRating) {
            const ratingStars = reviewElement.querySelector('.star-rating')?.innerHTML;
            const commentText = reviewElement.querySelector('.review-comment')?.textContent;

            if (!ratingStars || !commentText) return;

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
            const reviewCommentEl = reviewElement.querySelector('.review-comment');
            const starRatingEl = reviewElement.querySelector('.star-rating');

            if (reviewCommentEl) reviewCommentEl.style.display = 'none';
            if (starRatingEl) starRatingEl.style.display = 'none';

            reviewElement.appendChild(editForm);

            // Add star rating functionality
            const editStars = editForm.querySelectorAll('.edit-stars i');
            editStars.forEach(star => {
                star.addEventListener('click', () => {
                    const rating = star.dataset.rating;
                    const ratingInput = editForm.querySelector('.edit-rating-input');
                    if (ratingInput) {
                        ratingInput.value = rating;
                    }

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
        if (!reviewElement) return;

        const editForm = reviewElement.querySelector('.edit-review-form');
        if (!editForm) return;

        const ratingInput = editForm.querySelector('.edit-rating-input');
        const commentInput = editForm.querySelector('.edit-comment');

        if (!ratingInput || !commentInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

        const rating = ratingInput.value;
        const comment = commentInput.value;

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

            const starRatingEl = reviewElement.querySelector('.star-rating');
            const reviewCommentEl = reviewElement.querySelector('.review-comment');

            if (starRatingEl) starRatingEl.innerHTML = updatedStarRating;
            if (reviewCommentEl) reviewCommentEl.textContent = comment;

            // Remove form and show original content
            reviewElement.removeChild(editForm);

            if (starRatingEl) starRatingEl.style.display = 'block';
            if (reviewCommentEl) reviewCommentEl.style.display = 'block';

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
        if (!reviewElement) return;

        // Remove the edit form
        const editForm = reviewElement.querySelector('.edit-review-form');
        if (editForm) {
            reviewElement.removeChild(editForm);
        }

        // Show original content
        const reviewCommentEl = reviewElement.querySelector('.review-comment');
        const starRatingEl = reviewElement.querySelector('.star-rating');

        if (reviewCommentEl) reviewCommentEl.style.display = 'block';
        if (starRatingEl) starRatingEl.style.display = 'block';

        // Clear stored originals
        delete reviewElement.dataset.originalRating;
        delete reviewElement.dataset.originalComment;
        delete reviewElement.dataset.reviewId;
    }

    // Confirm delete item dialog
    function confirmDeleteItem(itemId, title) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

        if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
            deleteItem(itemId);
        }
    }

    // Delete an item
    async function deleteItem(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

        try {
            await apiRequest(`/items/${itemId}`, 'DELETE');

            showAlert('Item deleted successfully!', 'success');

            // If on item detail page, navigate back to profile
            if (state.currentPage === 'item') {
                navigateTo('profile');
                switchTab('sales');
            } else {
                // If on profile page, just reload sales
                loadSales();
            }
        } catch (error) {
            showAlert('Failed to delete item: ' + error.message, 'danger');
        }
    }

    /// Download a purchased item
    // Download a purchased item
    async function downloadPurchasedItem(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

        try {
            // Get the purchase ID from purchases data
            const purchasesResponse = await apiRequest('/purchases');
            const purchases = purchasesResponse.purchases || purchasesResponse;
            const purchase = purchases.find(p => p.item_id === parseInt(itemId));

            if (!purchase) {
                showAlert('Item not found in your purchases', 'danger');
                return;
            }

            showAlert('Starting download...', 'info');

            // Create a download token element to show download progress
            const downloadToken = document.createElement('div');
            downloadToken.className = 'download-token';
            downloadToken.innerHTML = `
            <div class="download-info">
                <span>Downloading "${purchase.title}"</span>
                <div class="download-progress">
                    <div class="progress-bar"></div>
                </div>
            </div>
        `;
            document.body.appendChild(downloadToken);

            try {
                // Use the Fetch API with proper authorization
                const response = await fetch(`/api/purchases/${purchase.purchase_id}/download`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${state.token}`
                    }
                });

                // Check if the response is successful
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                }

                // Get the filename from the content-disposition header if available
                let filename = purchase.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const contentDisposition = response.headers.get('content-disposition');
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"|filename=([^;]+)/);
                    if (filenameMatch) {
                        filename = filenameMatch[1] || filenameMatch[2];
                    }
                }

                // Get content type to determine extension if needed
                const contentType = response.headers.get('content-type');
                if (!filename.includes('.')) {
                    // Add extension based on content type
                    if (contentType === 'application/pdf') {
                        filename += '.pdf';
                    } else if (contentType === 'text/plain') {
                        filename += '.txt';
                    } else if (contentType === 'application/zip') {
                        filename += '.zip';
                    } else if (contentType === 'image/jpeg') {
                        filename += '.jpg';
                    } else if (contentType === 'image/png') {
                        filename += '.png';
                    } else {
                        // Default extension for unknown types
                        filename += '.bin';
                    }
                }

                // Convert response to blob
                const blob = await response.blob();

                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);

                // Trigger the download
                a.click();

                // Clean up
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Show success message
                showAlert('Download complete!', 'success');

                // Remove the download token after a delay
                setTimeout(() => {
                    if (downloadToken.parentNode) {
                        downloadToken.parentNode.removeChild(downloadToken);
                    }
                }, 2000);

            } catch (error) {
                console.error('Download error:', error);

                // Remove the download token
                if (downloadToken.parentNode) {
                    downloadToken.parentNode.removeChild(downloadToken);
                }

                // Show error message
                if (error.message.includes('401')) {
                    showAlert('Authentication failed. Please log in again.', 'danger');
                } else if (error.message.includes('404')) {
                    showAlert('File not found. The file may have been deleted.', 'danger');
                } else {
                    showAlert(`Download failed: ${error.message}`, 'danger');
                }
            }
        } catch (error) {
            console.error('Error initiating download:', error);
            showAlert('Failed to initiate download: ' + error.message, 'danger');
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
        // Check for valid endpoint
        if (!endpoint || endpoint.includes('/undefined') || endpoint.includes('/null')) {
            console.error('Invalid API endpoint:', endpoint);
            return Promise.reject(new Error('Invalid request parameters'));
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
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        if (!emailInput || !passwordInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;

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
        const usernameInput = document.getElementById('register-username');
        const emailInput = document.getElementById('register-email');
        const fullNameInput = document.getElementById('register-full-name');
        const passwordInput = document.getElementById('register-password');
        const confirmPasswordInput = document.getElementById('register-confirm-password');

        if (!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

        const username = usernameInput.value;
        const email = emailInput.value;
        const fullName = fullNameInput ? fullNameInput.value : '';
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

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

        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const response = await apiRequest('/items?limit=4');
            const items = response.items || response;

            if (!items || items.length === 0) {
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
                <i class="fas ${icon}"></i>
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

            if (!items || items.length === 0) {
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
            console.error('Error loading items:', error);
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
        if (!item || !item.item_id) return null;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.id = item.item_id;

        // Make entire card clickable
        card.addEventListener('click', () => {
            viewItem(item.item_id);
        });

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

            if (!item) {
                showAlert('Failed to load item details', 'danger');
                navigateTo('browse');
                return;
            }

            // Update item details
            const titleEl = document.getElementById('item-title');
            const descriptionEl = document.getElementById('item-description');
            const categoryEl = document.getElementById('item-category');
            const sellerEl = document.getElementById('item-seller');
            const priceEl = document.getElementById('item-price');

            if (titleEl) titleEl.textContent = item.title;
            if (descriptionEl) descriptionEl.textContent = item.description;
            if (categoryEl) categoryEl.textContent = item.category_name;
            if (sellerEl) sellerEl.textContent = item.seller_name;
            if (priceEl) priceEl.textContent = `$${parseFloat(item.price).toFixed(2)}`;

            // Set thumbnail
            const thumbnailImg = document.getElementById('item-thumbnail');
            if (thumbnailImg) {
                thumbnailImg.src = item.thumbnail_path || '/img/default-thumbnail.png';
                thumbnailImg.alt = item.title;
            }

            // Load reviews
            loadReviews(item.reviews);

            // Update purchase button and alert button
            const purchaseButton = document.getElementById('purchase-button');
            const setAlertButton = document.getElementById('set-alert-button');
            const itemActions = document.querySelector('.item-actions');

            if (!purchaseButton || !itemActions) return;

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
            navigateTo('browse');
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
            if (reviewElement) {
                container.appendChild(reviewElement);
            }
        });
    }

    // Create a review element
    function createReviewElement(review) {
        if (!review) return null;

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
                <span class="reviewer">${review.reviewer_name}</span>
                <span class="review-date">${date}</span>
                ${editButton}
            </div>
            <div class="star-rating">
                ${createStarRating(review.rating)}
            </div>
            <div class="review-comment">${review.comment || ''}</div>
        `;

        return reviewElement;
    }

    // Create star rating HTML
    function createStarRating(rating) {
        rating = parseInt(rating) || 0;
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
        rating = parseInt(rating) || 5;
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
        const ratingInput = document.getElementById('rating-input');
        if (ratingInput) {
            ratingInput.value = rating;
        }
    }

    // Submit a review
    async function submitReview(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

        const ratingInput = document.getElementById('rating-input');
        const commentInput = document.getElementById('review-comment');

        if (!ratingInput || !commentInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

        const rating = ratingInput.value;
        const comment = commentInput.value;

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
            commentInput.value = '';
            updateStarRating(5);
        } catch (error) {
            showAlert('Failed to submit review: ' + error.message, 'danger');
        }
    }

    // Purchase an item
    async function purchaseItem(itemId) {
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

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
        if (!itemId) {
            showAlert('Invalid item ID', 'danger');
            return;
        }

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
            const usernameInput = document.getElementById('profile-username');
            const emailInput = document.getElementById('profile-email');
            const fullNameInput = document.getElementById('profile-full-name');

            if (usernameInput) usernameInput.value = profile.username;
            if (emailInput) emailInput.value = profile.email;
            if (fullNameInput) fullNameInput.value = profile.full_name || '';

            // Update profile image
            const profileImage = document.getElementById('profile-image');
            if (profileImage) {
                profileImage.src = profile.profile_image || '/img/default-profile.png';
            }
        } catch (error) {
            showAlert('Failed to load profile', 'danger');
        }
    }

    // Update user profile
    async function updateProfile() {
        const usernameInput = document.getElementById('profile-username');
        const emailInput = document.getElementById('profile-email');
        const fullNameInput = document.getElementById('profile-full-name');
        const passwordInput = document.getElementById('profile-password');

        if (!usernameInput || !emailInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

        const username = usernameInput.value;
        const email = emailInput.value;
        const fullName = fullNameInput ? fullNameInput.value : '';
        const password = passwordInput ? passwordInput.value : '';

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
            if (passwordInput) {
                passwordInput.value = '';
            }
        } catch (error) {
            showAlert('Failed to update profile: ' + error.message, 'danger');
        }
    }

    // Upload profile image
    async function uploadProfileImage() {
        const fileInput = document.getElementById('profile-image-upload');
        if (!fileInput || !fileInput.files[0]) return;

        const file = fileInput.files[0];

        const formData = new FormData();
        formData.append('profile_image', file);

        try {
            const updatedProfile = await apiRequest('/users/profile', 'PUT', formData);

            // Update profile image
            const profileImage = document.getElementById('profile-image');
            if (profileImage && updatedProfile.profile_image) {
                profileImage.src = updatedProfile.profile_image;
            }

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

            if (!purchases || purchases.length === 0) {
                container.innerHTML = '<p class="no-items">No purchases yet</p>';
                return;
            }

            container.innerHTML = '';

            purchases.forEach(purchase => {
                const purchaseElement = createPurchaseElement(purchase);
                if (purchaseElement) {
                    container.appendChild(purchaseElement);
                }
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

            if (!notifications || notifications.length === 0) {
                container.innerHTML = '<p class="no-items">No notifications yet</p>';
                return;
            }

            container.innerHTML = '';

            notifications.forEach(notification => {
                const notificationElement = createNotificationElement(notification);
                if (notificationElement) {
                    container.appendChild(notificationElement);
                }
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
        if (!notification) return null;

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
        if (!purchase) return null;

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

        element.innerHTML = `
            <div class="purchase-image">
                <img src="${purchase.thumbnail_path || '/img/default-thumbnail.png'}" alt="${purchase.title}">
            </div>
            <div class="purchase-details">
                <div class="purchase-title">${purchase.title}</div>
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

            if (!sales || sales.length === 0) {
                container.innerHTML = '<p class="no-items">No sales yet</p>';
                return;
            }

            container.innerHTML = '';

            sales.forEach(sale => {
                const saleElement = createSaleElement(sale);
                if (saleElement) {
                    container.appendChild(saleElement);
                }
            });
        } catch (error) {
            container.innerHTML = '<p class="error">Failed to load sales</p>';
        }
    }

    // Create sale element
    function createSaleElement(sale) {
        if (!sale) return null;

        const element = document.createElement('div');
        element.className = 'sale-card';

        // Add class for deleted items
        if (sale.is_deleted) {
            element.classList.add('item-deleted');
        }

        element.innerHTML = `
            <div class="sale-image">
                <img src="${sale.thumbnail_path || '/img/default-thumbnail.png'}" alt="${sale.title}">
            </div>
            <div class="sale-details">
                <div class="sale-title">${sale.title}</div>
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

    // Alerts Page Functions
    // Load user alerts
    async function loadAlerts() {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const alertsResponse = await apiRequest('/alerts');
            const alerts = alertsResponse.alerts || alertsResponse;

            if (!alerts || alerts.length === 0) {
                container.innerHTML = '<p class="no-alerts">No alerts set</p>';
                return;
            }

            container.innerHTML = '';

            alerts.forEach(alert => {
                const alertElement = createAlertElement(alert);
                if (alertElement) {
                    container.appendChild(alertElement);
                }
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
        if (!alert) return null;

        const element = document.createElement('div');
        element.className = 'alert-card';

        if (!alert.is_read) {
            element.classList.add('unread');
        }

        element.dataset.id = alert.alert_id;

        // Store the item_id if available for navigation
        if (alert.item_id) {
            element.dataset.itemId = alert.item_id;
            // Add clickable cursor style
            element.style.cursor = 'pointer';
        }

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

        // Add click event listener to navigate to item page if item_id exists
        if (alert.item_id) {
            element.addEventListener('click', (e) => {
                // Prevent navigation if the click was on a button
                if (e.target.tagName === 'BUTTON' ||
                    e.target.closest('button') ||
                    e.target.tagName === 'I') {
                    return;
                }

                // Navigate to the item page
                navigateTo('item', { itemId: alert.item_id });

                // Mark the alert as read if it's not already read
                if (!alert.is_read) {
                    markAlertAsRead(alert.alert_id);
                }
            });
        }

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

        if (!alertTypeInput) {
            showAlert('Form elements not found', 'danger');
            return;
        }

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