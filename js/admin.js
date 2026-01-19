// Admin dashboard functionality
class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadDashboardData();
        this.setupRealtimeListeners();
    }

    async checkAuth() {
        try {
            // Listen for auth state changes
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    await this.loadAdminData();
                } else {
                    // Redirect to login
                    window.location.href = 'index.html';
                }
            });
        } catch (error) {
            console.error('Auth error:', error);
        }
    }

    async loadAdminData() {
        document.getElementById('adminName').textContent = 
            this.currentUser.displayName || this.currentUser.email;
    }

    async loadDashboardData() {
        await this.loadStats();
        await this.loadRecentOrders();
        await this.loadPopularItems();
        await this.loadMenuCategories();
        await this.loadMenuItems();
    }

    async loadStats() {
        try {
            // Total orders
            const ordersSnapshot = await ordersRef.get();
            document.getElementById('totalOrders').textContent = ordersSnapshot.size;
            
            // Pending orders
            const pendingOrders = ordersSnapshot.docs.filter(doc => 
                doc.data().status === 'pending'
            ).length;
            document.getElementById('pendingOrders').textContent = pendingOrders;
            
            // Active requests
            const requestsSnapshot = await requestsRef.where('status', 'in', ['pending', 'in_progress']).get();
            document.getElementById('activeRequests').textContent = requestsSnapshot.size;
            
            // Active tables (tables with pending orders or requests)
            const activeTables = new Set();
            ordersSnapshot.docs.forEach(doc => {
                if (doc.data().status !== 'completed') {
                    activeTables.add(doc.data().tableNumber);
                }
            });
            requestsSnapshot.docs.forEach(doc => {
                activeTables.add(doc.data().tableNumber);
            });
            document.getElementById('activeTables').textContent = activeTables.size;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadRecentOrders() {
        try {
            const ordersSnapshot = await ordersRef
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
            
            const recentOrdersList = document.getElementById('recentOrdersList');
            recentOrdersList.innerHTML = '';
            
            ordersSnapshot.docs.forEach(doc => {
                const order = doc.data();
                const orderElement = document.createElement('div');
                orderElement.className = 'recent-order-item';
                orderElement.innerHTML = `
                    <div class="order-info">
                        <strong>Table ${order.tableNumber}</strong>
                        <span class="order-status">${order.status}</span>
                    </div>
                    <div class="order-time">
                        ${order.createdAt ? order.createdAt.toDate().toLocaleTimeString() : ''}
                    </div>
                    <div class="order-total">$${order.total?.toFixed(2) || '0.00'}</div>
                `;
                recentOrdersList.appendChild(orderElement);
            });
        } catch (error) {
            console.error('Error loading recent orders:', error);
        }
    }

    async loadPopularItems() {
        try {
            // Aggregate popular items from orders
            const ordersSnapshot = await ordersRef.get();
            const itemCounts = {};
            
            ordersSnapshot.docs.forEach(doc => {
                const order = doc.data();
                if (order.items) {
                    order.items.forEach(item => {
                        if (!itemCounts[item.name]) {
                            itemCounts[item.name] = 0;
                        }
                        itemCounts[item.name] += item.quantity;
                    });
                }
            });
            
            // Sort by count
            const popularItems = Object.entries(itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const popularItemsList = document.getElementById('popularItemsList');
            popularItemsList.innerHTML = '';
            
            popularItems.forEach(([itemName, count]) => {
                const itemElement = document.createElement('div');
                itemElement.className = 'popular-item';
                itemElement.innerHTML = `
                    <span class="item-name">${itemName}</span>
                    <span class="item-count">${count} orders</span>
                `;
                popularItemsList.appendChild(itemElement);
            });
        } catch (error) {
            console.error('Error loading popular items:', error);
        }
    }

    async loadMenuCategories() {
        try {
            const categoriesSnapshot = await db.collection('menuCategories').get();
            const categoriesSelect = document.getElementById('itemCategory');
            categoriesSelect.innerHTML = '<option value="">Select Category</option>';
            
            categoriesSnapshot.docs.forEach(doc => {
                const category = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = category.name;
                categoriesSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadMenuItems() {
        try {
            const menuSnapshot = await menuRef.get();
            const menuItemsTable = document.getElementById('menuItemsTable');
            menuItemsTable.innerHTML = '';
            
            menuSnapshot.docs.forEach(doc => {
                const item = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        ${item.image ? 
                            `<img src="${item.image}" alt="${item.name}" class="item-thumbnail">` : 
                            `<i class="fas fa-utensils"></i>`
                        }
                    </td>
                    <td>${item.name}</td>
                    <td>${item.description || ''}</td>
                    <td>${item.category}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>
                        <span class="status-badge ${item.available ? 'active' : 'inactive'}">
                            ${item.available ? 'Available' : 'Unavailable'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-edit" onclick="adminDashboard.editMenuItem('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete" onclick="adminDashboard.deleteMenuItem('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                menuItemsTable.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading menu items:', error);
        }
    }

    async addMenuItem(event) {
        event.preventDefault();
        
        const item = {
            name: document.getElementById('itemName').value,
            description: document.getElementById('itemDescription').value,
            category: document.getElementById('itemCategory').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            image: document.getElementById('itemImage').value,
            available: document.getElementById('itemAvailable').checked,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await menuRef.add(item);
            this.showNotification('Menu item added successfully!');
            this.closeAddItemModal();
            this.loadMenuItems();
        } catch (error) {
            console.error('Error adding menu item:', error);
            this.showError('Failed to add menu item');
        }
    }

    editMenuItem(itemId) {
        // Implement edit functionality
        console.log('Edit item:', itemId);
    }

    async deleteMenuItem(itemId) {
        if (confirm('Are you sure you want to delete this menu item?')) {
            try {
                await menuRef.doc(itemId).delete();
                this.showNotification('Menu item deleted successfully!');
                this.loadMenuItems();
            } catch (error) {
                console.error('Error deleting menu item:', error);
                this.showError('Failed to delete menu item');
            }
        }
    }

    // Navigation methods
    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(`${sectionId}Section`).classList.add('active');
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update section title
        const titles = {
            dashboard: 'Dashboard',
            menu: 'Menu Management',
            orders: 'Order Management',
            requests: 'Service Requests',
            tables: 'Table Management',
            staff: 'Staff Management',
            analytics: 'Analytics',
            settings: 'Settings'
        };
        document.getElementById('sectionTitle').textContent = titles[sectionId];
    }

    // Modal control methods
    openAddItemModal() {
        document.getElementById('addItemModal').classList.add('active');
    }

    closeAddItemModal() {
        document.getElementById('addItemModal').classList.remove('active');
        document.getElementById('addItemForm').reset();
    }

    // Utility methods
    showNotification(message) {
        // Similar to client notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'notification error';
        error.textContent = message;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
        `;
        document.body.appendChild(error);
        setTimeout(() => error.remove(), 3000);
    }

    setupRealtimeListeners() {
        // Real-time updates for orders
        ordersRef.onSnapshot(() => {
            this.loadStats();
            this.loadRecentOrders();
            this.loadPopularItems();
        });
        
        // Real-time updates for requests
        requestsRef.onSnapshot(() => {
            this.loadStats();
        });
    }

    setupEventListeners() {
        // Add any additional event listeners here
    }

    logout() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
