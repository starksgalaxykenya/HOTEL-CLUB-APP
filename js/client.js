// Client-side functionality
class ClientApp {
    constructor() {
        this.tableNumber = this.getTableNumber();
        this.cart = [];
        this.totalAmount = 0;
        this.menuItems = [];
        this.categories = [];
        this.currentCategory = 'all';
        
        this.init();
    }

    init() {
        this.displayTableNumber();
        this.loadMenu();
        this.setupEventListeners();
        this.listenForOrderUpdates();
        this.listenForRequestUpdates();
        this.setupRealtimeConnection();
    }

    getTableNumber() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('table') || '1';
    }

    displayTableNumber() {
        document.getElementById('tableNumber').textContent = this.tableNumber;
    }

    async loadMenu() {
        try {
            // Load categories
            const categoriesSnapshot = await db.collection('menuCategories').get();
            this.categories = categoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Load menu items
            const menuSnapshot = await menuRef.get();
            this.menuItems = menuSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderCategories();
            this.renderMenuItems();
        } catch (error) {
            console.error('Error loading menu:', error);
            this.showError('Failed to load menu. Please try again.');
        }
    }

    renderCategories() {
        const categoriesNav = document.getElementById('categoriesNav');
        categoriesNav.innerHTML = '';
        
        // Add "All" category
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active';
        allBtn.textContent = 'All Items';
        allBtn.onclick = () => this.filterByCategory('all');
        categoriesNav.appendChild(allBtn);
        
        // Add other categories
        this.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = category.name;
            btn.onclick = () => this.filterByCategory(category.id);
            categoriesNav.appendChild(btn);
        });
    }

    renderMenuItems(filteredItems = null) {
        const itemsToRender = filteredItems || this.menuItems;
        const menuGrid = document.getElementById('menuItems');
        menuGrid.innerHTML = '';
        
        itemsToRender.forEach(item => {
            if (!item.available) return;
            
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <div class="item-image">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : 
                      `<i class="fas fa-utensils"></i>`}
                </div>
                <h3>${item.name}</h3>
                <p class="item-description">${item.description || ''}</p>
                <div class="item-footer">
                    <span class="item-price">$${item.price.toFixed(2)}</span>
                    <div class="item-controls">
                        <div class="quantity-controls">
                            <button class="qty-btn minus" onclick="clientApp.decreaseQuantity('${item.id}')">-</button>
                            <span class="qty-display" id="qty-${item.id}">0</span>
                            <button class="qty-btn plus" onclick="clientApp.increaseQuantity('${item.id}')">+</button>
                        </div>
                        <button class="btn-add" onclick="clientApp.addToCart('${item.id}')">
                            <i class="fas fa-cart-plus"></i> Add
                        </button>
                    </div>
                </div>
            `;
            menuGrid.appendChild(menuItem);
        });
    }

    filterByCategory(categoryId) {
        this.currentCategory = categoryId;
        
        // Update active category button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Filter items
        let filteredItems;
        if (categoryId === 'all') {
            filteredItems = this.menuItems;
            document.getElementById('currentCategory').textContent = 'All Items';
        } else {
            filteredItems = this.menuItems.filter(item => item.category === categoryId);
            const category = this.categories.find(c => c.id === categoryId);
            document.getElementById('currentCategory').textContent = category?.name || 'Category';
        }
        
        this.renderMenuItems(filteredItems);
    }

    addToCart(itemId) {
        const item = this.menuItems.find(i => i.id === itemId);
        if (!item) return;
        
        const existingItem = this.cart.find(i => i.id === itemId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...item,
                quantity: 1
            });
        }
        
        this.updateCartDisplay();
        this.showNotification(`${item.name} added to cart!`);
    }

    increaseQuantity(itemId) {
        const qtyDisplay = document.getElementById(`qty-${itemId}`);
        let currentQty = parseInt(qtyDisplay.textContent) || 0;
        qtyDisplay.textContent = currentQty + 1;
    }

    decreaseQuantity(itemId) {
        const qtyDisplay = document.getElementById(`qty-${itemId}`);
        let currentQty = parseInt(qtyDisplay.textContent) || 0;
        if (currentQty > 0) {
            qtyDisplay.textContent = currentQty - 1;
        }
    }

    updateCartDisplay() {
        const cartCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        document.getElementById('cartCount').textContent = cartCount;
        
        this.totalAmount = this.cart.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0);
        
        document.getElementById('cartTotal').textContent = this.totalAmount.toFixed(2);
        
        this.renderCartItems();
    }

    renderCartItems() {
        const cartItems = document.getElementById('cartItems');
        cartItems.innerHTML = '';
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            return;
        }
        
        this.cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>$${item.price.toFixed(2)} × ${item.quantity}</p>
                </div>
                <div class="cart-item-controls">
                    <span class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</span>
                    <button class="btn-remove" onclick="clientApp.removeFromCart('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });
    }

    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.updateCartDisplay();
    }

    async placeOrder() {
        if (this.cart.length === 0) {
            this.showError('Your cart is empty');
            return;
        }

        const order = {
            tableNumber: this.tableNumber,
            items: this.cart,
            total: this.totalAmount,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            estimatedTime: 15 // Default 15 minutes
        };

        try {
            await ordersRef.add(order);
            
            // Clear cart
            this.cart = [];
            this.updateCartDisplay();
            this.toggleCart();
            
            this.showNotification('Order placed successfully!');
            
            // Reset quantities display
            this.menuItems.forEach(item => {
                const qtyDisplay = document.getElementById(`qty-${item.id}`);
                if (qtyDisplay) {
                    qtyDisplay.textContent = '0';
                }
            });
        } catch (error) {
            console.error('Error placing order:', error);
            this.showError('Failed to place order. Please try again.');
        }
    }

    async requestService(serviceType) {
        const request = {
            tableNumber: this.tableNumber,
            serviceType: serviceType,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            assignedTo: null
        };

        try {
            await requestsRef.add(request);
            this.showNotification(`${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} requested!`);
            this.closeServiceModal();
        } catch (error) {
            console.error('Error requesting service:', error);
            this.showError('Failed to request service. Please try again.');
        }
    }

    async sendSpecialRequest() {
        const message = document.getElementById('specialMessage').value.trim();
        if (!message) {
            this.showError('Please enter a message');
            return;
        }

        const request = {
            tableNumber: this.tableNumber,
            serviceType: 'special',
            message: message,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await requestsRef.add(request);
            this.showNotification('Special request sent!');
            this.closeSpecialRequest();
        } catch (error) {
            console.error('Error sending special request:', error);
            this.showError('Failed to send request. Please try again.');
        }
    }

    async callSpecificStaff() {
        const name = document.getElementById('staffName').value.trim();
        const type = document.getElementById('staffType').value;
        const message = document.getElementById('staffMessage').value.trim();

        if (!name) {
            this.showError('Please enter staff name');
            return;
        }

        const request = {
            tableNumber: this.tableNumber,
            serviceType: 'specific_staff',
            staffName: name,
            staffType: type,
            message: message,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await requestsRef.add(request);
            this.showNotification(`Calling ${name}...`);
            this.closeStaffCall();
        } catch (error) {
            console.error('Error calling staff:', error);
            this.showError('Failed to call staff. Please try again.');
        }
    }

    listenForOrderUpdates() {
        ordersRef
            .where('tableNumber', '==', this.tableNumber)
            .where('status', 'in', ['pending', 'preparing', 'ready', 'served'])
            .onSnapshot(snapshot => {
                this.renderCurrentOrders(snapshot.docs);
            }, error => {
                console.error('Error listening to orders:', error);
            });
    }

    renderCurrentOrders(orderDocs) {
        const ordersList = document.getElementById('currentOrders');
        
        if (orderDocs.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-orders">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No active orders</p>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = '';
        
        orderDocs.forEach(doc => {
            const order = doc.data();
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            
            const itemsList = order.items.map(item => 
                `${item.name} × ${item.quantity}`
            ).join(', ');
            
            const statusColors = {
                pending: '#ff9800',
                preparing: '#2196F3',
                ready: '#4CAF50',
                served: '#009688'
            };
            
            orderCard.innerHTML = `
                <div class="order-header">
                    <span class="order-status" style="color: ${statusColors[order.status] || '#666'}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <span class="order-time">${this.formatTime(order.createdAt)}</span>
                </div>
                <p class="order-items">${itemsList}</p>
                <div class="order-footer">
                    <span class="order-total">$${order.total.toFixed(2)}</span>
                    ${order.estimatedTime ? 
                      `<span class="order-eta">ETA: ${order.estimatedTime} min</span>` : ''}
                </div>
            `;
            ordersList.appendChild(orderCard);
        });
    }

    listenForRequestUpdates() {
        requestsRef
            .where('tableNumber', '==', this.tableNumber)
            .where('status', 'in', ['pending', 'in_progress'])
            .onSnapshot(snapshot => {
                this.renderActiveRequests(snapshot.docs);
            });
    }

    renderActiveRequests(requestDocs) {
        const requestsList = document.getElementById('activeRequests');
        
        if (requestDocs.length === 0) {
            requestsList.innerHTML = '<p class="no-requests">No active requests</p>';
            return;
        }

        requestsList.innerHTML = '';
        
        requestDocs.forEach(doc => {
            const request = doc.data();
            const requestElement = document.createElement('div');
            requestElement.className = 'request-item';
            
            const icons = {
                waiter: 'fa-user-tie',
                waitress: 'fa-user-female',
                bartender: 'fa-glass-cheers',
                security: 'fa-shield-alt',
                medical: 'fa-ambulance',
                pos: 'fa-receipt',
                special: 'fa-envelope',
                specific_staff: 'fa-microphone'
            };
            
            requestElement.innerHTML = `
                <div class="request-icon">
                    <i class="fas ${icons[request.serviceType] || 'fa-bell'}"></i>
                </div>
                <div class="request-info">
                    <h4>${this.getServiceTypeName(request.serviceType)}</h4>
                    <p>Status: <span class="request-status">${request.status === 'in_progress' ? 'In Progress' : 'Pending'}</span></p>
                    ${request.message ? `<p class="request-message">${request.message}</p>` : ''}
                </div>
            `;
            requestsList.appendChild(requestElement);
        });
    }

    getServiceTypeName(serviceType) {
        const names = {
            waiter: 'Waiter Request',
            waitress: 'Waitress Request',
            bartender: 'Bartender Request',
            security: 'Security Request',
            medical: 'Medical Emergency',
            pos: 'POS/Receipt Request',
            special: 'Special Request',
            specific_staff: 'Staff Call'
        };
        return names[serviceType] || serviceType;
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    setupRealtimeConnection() {
        const connectionStatus = document.getElementById('connectionStatus');
        const statusDot = document.querySelector('.status-dot');
        
        // Monitor connection status
        firebase.firestore().enableNetwork().then(() => {
            connectionStatus.textContent = 'Connected';
            statusDot.style.background = '#4CAF50';
        });
        
        firebase.firestore().disableNetwork().then(() => {
            connectionStatus.textContent = 'Disconnected';
            statusDot.style.background = '#f44336';
        });
    }

    // Modal control methods
    toggleCart() {
        const modal = document.getElementById('cartModal');
        modal.classList.toggle('active');
        this.updateCartDisplay();
    }

    openServiceModal() {
        document.getElementById('serviceModal').classList.add('active');
    }

    closeServiceModal() {
        document.getElementById('serviceModal').classList.remove('active');
    }

    openSpecialRequest() {
        this.closeServiceModal();
        document.getElementById('specialRequestModal').classList.add('active');
    }

    closeSpecialRequest() {
        document.getElementById('specialRequestModal').classList.remove('active');
        document.getElementById('specialMessage').value = '';
    }

    openStaffCall() {
        this.closeServiceModal();
        document.getElementById('staffCallModal').classList.add('active');
    }

    closeStaffCall() {
        document.getElementById('staffCallModal').classList.remove('active');
        document.getElementById('staffName').value = '';
        document.getElementById('staffMessage').value = '';
    }

    // Utility methods
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    showError(message) {
        // Similar to showNotification but with error styling
        const error = document.createElement('div');
        error.className = 'notification error';
        error.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(error);
            }, 300);
        }, 3000);
    }

    setupEventListeners() {
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.clientApp = new ClientApp();
});
