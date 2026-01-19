// Staff dashboard functionality
class StaffDashboard {
    constructor() {
        this.staffId = null;
        this.staffRole = null;
        this.assignedTasks = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadStaffOrders();
        this.loadStaffRequests();
        this.setupRealtimeListeners();
    }

    async checkAuth() {
        // Simple staff authentication (in production, implement proper auth)
        const staffId = localStorage.getItem('staffId');
        const staffRole = localStorage.getItem('staffRole');
        
        if (!staffId) {
            // Redirect to staff login
            window.location.href = 'index.html';
            return;
        }
        
        this.staffId = staffId;
        this.staffRole = staffRole;
        document.getElementById('staffRole').textContent = 
            staffRole ? staffRole.charAt(0).toUpperCase() + staffRole.slice(1) : 'Staff';
    }

    async loadStaffOrders() {
        try {
            const ordersSnapshot = await ordersRef
                .where('status', 'in', ['pending', 'preparing', 'ready'])
                .orderBy('createdAt', 'desc')
                .get();
            
            this.renderStaffOrders(ordersSnapshot.docs);
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    renderStaffOrders(orderDocs) {
        const ordersGrid = document.getElementById('staffOrdersGrid');
        ordersGrid.innerHTML = '';
        
        orderDocs.forEach(doc => {
            const order = doc.data();
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            orderCard.onclick = () => this.openOrderDetail(doc.id, order);
            
            const itemsPreview = order.items?.slice(0, 2).map(item => 
                `${item.name} × ${item.quantity}`
            ).join(', ');
            
            const moreItems = order.items?.length > 2 ? 
                ` +${order.items.length - 2} more items` : '';
            
            orderCard.innerHTML = `
                <div class="order-card-header">
                    <h3>Table ${order.tableNumber}</h3>
                    <span class="order-status-badge ${order.status}">
                        ${order.status}
                    </span>
                </div>
                <div class="order-items-preview">
                    ${itemsPreview}${moreItems}
                </div>
                <div class="order-card-footer">
                    <div class="order-total">$${order.total?.toFixed(2) || '0.00'}</div>
                    <div class="order-time">
                        ${order.createdAt ? 
                          this.formatTimeAgo(order.createdAt.toDate()) : 'Just now'}
                    </div>
                </div>
            `;
            ordersGrid.appendChild(orderCard);
        });
    }

    async loadStaffRequests() {
        try {
            const requestsSnapshot = await requestsRef
                .where('status', 'in', ['pending', 'in_progress'])
                .orderBy('createdAt', 'desc')
                .get();
            
            this.renderStaffRequests(requestsSnapshot.docs);
        } catch (error) {
            console.error('Error loading requests:', error);
        }
    }

    renderStaffRequests(requestDocs) {
        const requestsGrid = document.getElementById('staffRequestsGrid');
        requestsGrid.innerHTML = '';
        
        requestDocs.forEach(doc => {
            const request = doc.data();
            const requestCard = document.createElement('div');
            requestCard.className = 'request-card';
            requestCard.onclick = () => this.openRequestDetail(doc.id, request);
            
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
            
            requestCard.innerHTML = `
                <div class="request-card-header">
                    <i class="fas ${icons[request.serviceType] || 'fa-bell'}"></i>
                    <h3>${this.getServiceTypeDisplay(request.serviceType)}</h3>
                </div>
                <div class="request-card-body">
                    <p><strong>Table:</strong> ${request.tableNumber}</p>
                    ${request.message ? 
                      `<p class="request-message">${request.message}</p>` : ''}
                </div>
                <div class="request-card-footer">
                    <span class="request-status ${request.status}">
                        ${request.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                    <span class="request-time">
                        ${request.createdAt ? 
                          this.formatTimeAgo(request.createdAt.toDate()) : 'Just now'}
                    </span>
                </div>
            `;
            requestsGrid.appendChild(requestCard);
        });
        
        // Update notification count
        const pendingCount = requestDocs.filter(doc => 
            doc.data().status === 'pending'
        ).length;
        document.getElementById('notificationCount').textContent = pendingCount;
    }

    getServiceTypeDisplay(serviceType) {
        const displays = {
            waiter: 'Waiter Request',
            waitress: 'Waitress Request',
            bartender: 'Bartender Request',
            security: 'Security Assistance',
            medical: 'Medical Emergency',
            pos: 'POS/Receipt Request',
            special: 'Special Request',
            specific_staff: 'Specific Staff Call'
        };
        return displays[serviceType] || serviceType;
    }

    async openOrderDetail(orderId, order) {
        this.currentOrderId = orderId;
        this.currentOrder = order;
        
        document.getElementById('modalTableNumber').textContent = order.tableNumber;
        document.getElementById('updateOrderStatus').value = order.status;
        
        // Render order items
        const orderItems = document.getElementById('modalOrderItems');
        orderItems.innerHTML = '';
        
        if (order.items) {
            order.items.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'order-detail-item';
                itemElement.innerHTML = `
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>$${item.price.toFixed(2)} × ${item.quantity}</p>
                    </div>
                    <div class="item-total">
                        $${(item.price * item.quantity).toFixed(2)}
                    </div>
                `;
                orderItems.appendChild(itemElement);
            });
        }
        
        // Show modal
        document.getElementById('orderDetailModal').classList.add('active');
    }

    async openRequestDetail(requestId, request) {
        this.currentRequestId = requestId;
        this.currentRequest = request;
        
        document.getElementById('modalRequestTitle').textContent = 
            this.getServiceTypeDisplay(request.serviceType);
        document.getElementById('modalRequestTable').textContent = request.tableNumber;
        document.getElementById('modalRequestTime').textContent = 
            request.createdAt ? request.createdAt.toDate().toLocaleTimeString() : '';
        document.getElementById('modalRequestDescription').textContent = 
            request.message || 'No additional details';
        
        // Show modal
        document.getElementById('requestDetailModal').classList.add('active');
    }

    async updateOrderStatus() {
        const newStatus = document.getElementById('updateOrderStatus').value;
        const estimatedTime = document.getElementById('estimatedTime').value;
        
        try {
            await ordersRef.doc(this.currentOrderId).update({
                status: newStatus,
                estimatedTime: parseInt(estimatedTime),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showNotification('Order status updated!');
            this.closeOrderModal();
        } catch (error) {
            console.error('Error updating order:', error);
            this.showError('Failed to update order status');
        }
    }

    async acceptRequest() {
        try {
            await requestsRef.doc(this.currentRequestId).update({
                status: 'in_progress',
                assignedTo: this.staffId,
                assignedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showNotification('Request accepted!');
            this.closeRequestModal();
        } catch (error) {
            console.error('Error accepting request:', error);
            this.showError('Failed to accept request');
        }
    }

    async completeRequest() {
        try {
            await requestsRef.doc(this.currentRequestId).update({
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showNotification('Request completed!');
            this.closeRequestModal();
        } catch (error) {
            console.error('Error completing request:', error);
            this.showError('Failed to complete request');
        }
    }

    // Tab navigation
    showStaffTab(tabId) {
        // Hide all tabs
        document.querySelectorAll('.staff-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabId}Tab`).classList.add('active');
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    // Filter methods
    filterStaffOrders() {
        const filter = document.getElementById('orderStatusFilter').value;
        // Implement filtering logic
    }

    filterStaffRequests() {
        const filter = document.getElementById('requestTypeFilter').value;
        // Implement filtering logic
    }

    // Utility methods
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hr ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days ago`;
    }

    closeOrderModal() {
        document.getElementById('orderDetailModal').classList.remove('active');
    }

    closeRequestModal() {
        document.getElementById('requestDetailModal').classList.remove('active');
    }

    showNotification(message) {
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
        // Real-time orders
        ordersRef
            .where('status', 'in', ['pending', 'preparing', 'ready'])
            .onSnapshot(snapshot => {
                this.renderStaffOrders(snapshot.docs);
            });
        
        // Real-time requests
        requestsRef
            .where('status', 'in', ['pending', 'in_progress'])
            .onSnapshot(snapshot => {
                this.renderStaffRequests(snapshot.docs);
            });
    }

    setupEventListeners() {
        // Add any additional event listeners
    }

    toggleNotifications() {
        // Implement notifications panel
        console.log('Toggle notifications');
    }

    staffLogout() {
        localStorage.removeItem('staffId');
        localStorage.removeItem('staffRole');
        window.location.href = 'index.html';
    }
}

// Initialize staff dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.staffDashboard = new StaffDashboard();
});
