class ExpiringPhotosApp {
    constructor() {
        this.DB_NAME = 'TempPhotoDB';
        this.STORE_NAME = 'photos';
        this.db = null;
        this.autoReturnTimeout = null;
        this.galleryLoaded = false;
        
        // Camera toggle state: 'standard', 'wide', 'front'
        this.currentCameraMode = 'standard';
        this.cameraModes = ['standard', 'wide', 'front'];
        this.currentModeIndex = 0;
        
        // Initialize critical path immediately (non-blocking)
        this.initializeElements();
        this.initializeEventListeners();
        
        // Start camera immediately for fastest time-to-camera
        this.initializeCamera();
        
        // Initialize database in parallel (non-blocking)
        this.initializeDB().catch(error => {
            console.error('Failed to initialize database:', error);
            // Don't block the camera with an alert, just log the error
            console.warn('Database unavailable - photos will not be saved');
        });
        
        // Add visibility change and blur handlers
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('blur', () => this.stopCamera());
        window.addEventListener('focus', () => this.handleFocus());
    }

    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('expiryDate', 'expiryDate');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
        });
    }

    async savePhoto(photo) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            
            transaction.onerror = (event) => {
                console.error('Transaction error:', event.target.error);
                if (event.target.error.name === 'QuotaExceededError') {
                    reject(new Error('Not enough storage space. Please delete some photos and try again.'));
                } else {
                    reject(event.target.error);
                }
            };

            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.add(photo);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async capturePhoto() {
        try {
            // Ensure database is ready before saving
            if (!this.db) {
                try {
                    await this.initializeDB();
                } catch (dbError) {
                    console.error('Database initialization failed during capture:', dbError);
                    alert('Unable to save photo - database not available. Please try again.');
                    return;
                }
            }

            // Set canvas size to match video dimensions
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Draw the video frame to the canvas
            const context = this.canvas.getContext('2d');
            context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to high quality JPEG
            const imageData = this.canvas.toDataURL('image/jpeg', 0.95);

            const photo = {
                id: Date.now().toString(),
                data: imageData,
                timestamp: Date.now(),
                expiryDate: this.getExpiryDate()
            };

            await this.savePhoto(photo);
            this.switchView('gallery', false);
            
            // Automatically return to camera view after 3 seconds
            this.autoReturnTimeout = setTimeout(() => {
                this.switchView('camera', false);
            }, 3000);
        } catch (error) {
            console.error('Error saving photo:', error);
            alert(error.message || 'Failed to save photo. Please delete some photos and try again.');
        }
    }

    async loadPhotos() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const photos = request.result;
                this.displayPhotos(photos);
                this.checkExpiredPhotos(photos);
                resolve(photos);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async deletePhotoFromDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                this.loadPhotos();
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    async deletePhoto(id) {
        if (confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
            try {
                await this.deletePhotoFromDB(id);
            } catch (error) {
                console.error('Error deleting photo:', error);
                alert('Failed to delete photo. Please try again.');
            }
        }
    }

    async checkExpiredPhotos(photos) {
        const now = Date.now();
        const expired = photos.filter(photo => photo.expiryDate <= now);
        
        for (const photo of expired) {
            try {
                await this.deletePhotoFromDB(photo.id);
            } catch (error) {
                console.error('Error deleting expired photo:', error);
            }
        }
    }

    initializeElements() {
        // Navigation elements
        this.cameraButton = document.getElementById('cameraButton');
        this.galleryButton = document.getElementById('galleryButton');
        this.cameraView = document.getElementById('cameraView');
        this.galleryView = document.getElementById('galleryView');
        this.infoButton = document.getElementById('infoButton');
        this.infoPopup = document.getElementById('infoPopup');
        this.closeInfoButton = document.getElementById('closeInfoButton');

        // Camera elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.captureButton = document.getElementById('captureButton');
        this.cameraToggleButton = document.getElementById('cameraToggleButton');
        this.expirySelect = document.getElementById('expirySelect');
        this.customExpiryContainer = document.getElementById('customExpiryContainer');
        this.customExpiry = document.getElementById('customExpiry');

        // Gallery elements
        this.photoGallery = document.getElementById('photoGallery');

        // Initialize fullscreen viewer elements if they exist
        this.fullscreenViewer = document.getElementById('fullscreenViewer');
        this.fullscreenImage = document.getElementById('fullscreenImage');
        this.closeViewer = document.getElementById('closeViewer');
    }

    initializeEventListeners() {
        this.cameraButton.addEventListener('click', () => this.switchView('camera'));
        this.galleryButton.addEventListener('click', () => this.switchView('gallery'));
        this.captureButton.addEventListener('click', () => this.capturePhoto());
        this.cameraToggleButton.addEventListener('click', () => this.toggleCamera());
        this.expirySelect.addEventListener('change', () => this.handleExpiryChange());

        // Info popup handlers
        this.infoButton.addEventListener('click', () => this.openInfoPopup());
        this.closeInfoButton.addEventListener('click', () => this.closeInfoPopup());

        // Close popup when clicking outside
        this.infoPopup.addEventListener('click', (e) => {
            if (e.target === this.infoPopup) {
                this.closeInfoPopup();
            }
        });

        // Handle escape key for info popup
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.infoPopup.classList.contains('active')) {
                    this.closeInfoPopup();
                }
                if (this.fullscreenViewer && this.fullscreenViewer.classList.contains('active')) {
                    this.closeFullscreenViewer();
                }
            }
        });

        // Only add fullscreen viewer listeners if elements exist
        if (this.fullscreenViewer && this.closeViewer) {
            this.closeViewer.addEventListener('click', () => this.closeFullscreenViewer());

            // Close viewer when clicking outside the image
            this.fullscreenViewer.addEventListener('click', (e) => {
                if (e.target === this.fullscreenViewer) {
                    this.closeFullscreenViewer();
                }
            });

            // Handle escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.fullscreenViewer.classList.contains('active')) {
                    this.closeFullscreenViewer();
                }
            });
        }

        // Set minimum date-time for custom expiry
        const now = new Date();
        this.customExpiry.min = now.toISOString().slice(0, 16);
    }

    async initializeCamera() {
        try {
            // Stop current camera stream before switching
            this.stopCamera();
            
            // Get constraints based on current camera mode
            const constraints = this.getCameraConstraints();
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            this.stream = stream;
            
            // Update button text after successful camera initialization
            this.updateCameraToggleButton();
            
            // Schedule service worker registration after camera is ready
            this.scheduleServiceWorkerRegistration();
        } catch (error) {
            console.error('Error accessing camera with high resolution:', error);
            
            // Try fallback with lower resolution if high-res fails
            try {
                console.log('Trying fallback resolution...');
                const fallbackConstraints = this.getFallbackConstraints();
                const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                this.video.srcObject = stream;
                this.stream = stream;
                this.updateCameraToggleButton();
                this.scheduleServiceWorkerRegistration();
                console.log('Fallback camera initialized successfully');
            } catch (fallbackError) {
                console.error('Fallback camera also failed:', fallbackError);
                // Try switching camera mode if current mode fails
                if (this.currentCameraMode !== 'standard') {
                    console.log('Falling back to standard camera mode');
                    this.currentCameraMode = 'standard';
                    this.currentModeIndex = 0;
                    this.initializeCamera();
                } else {
                    alert('Unable to access camera. Please ensure you have granted camera permissions.');
                }
            }
        }
    }

    getCameraConstraints() {
        const baseConstraints = {
            video: {
                width: { ideal: 2560 },
                height: { ideal: 1440 }
            }
        };

        switch (this.currentCameraMode) {
            case 'standard':
                baseConstraints.video.facingMode = 'environment';
                break;
            case 'wide':
                baseConstraints.video.facingMode = 'environment';
                // Note: Wide-angle functionality can be enhanced in the future
                // by detecting multiple cameras and selecting ultra-wide if available
                break;
            case 'front':
                baseConstraints.video.facingMode = 'user';
                break;
        }

        return baseConstraints;
    }

    getFallbackConstraints() {
        const fallbackConstraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        switch (this.currentCameraMode) {
            case 'standard':
                fallbackConstraints.video.facingMode = 'environment';
                break;
            case 'wide':
                fallbackConstraints.video.facingMode = 'environment';
                break;
            case 'front':
                fallbackConstraints.video.facingMode = 'user';
                break;
        }

        return fallbackConstraints;
    }

    async toggleCamera() {
        // Cycle to next camera mode
        this.currentModeIndex = (this.currentModeIndex + 1) % this.cameraModes.length;
        this.currentCameraMode = this.cameraModes[this.currentModeIndex];
        
        // Reinitialize camera with new mode
        await this.initializeCamera();
    }

    updateCameraToggleButton() {
        if (!this.cameraToggleButton) return;
        
        const icon = this.cameraToggleButton.querySelector('.icon');
        if (!icon) return;

        switch (this.currentCameraMode) {
            case 'standard':
                icon.textContent = '1.0x';
                break;
            case 'wide':
                icon.textContent = '0.5x';
                break;
            case 'front':
                icon.textContent = '🤳';
                break;
        }
    }

    scheduleServiceWorkerRegistration() {
        // Register service worker after camera is ready to avoid blocking camera initialization
        if ('serviceWorker' in navigator) {
            setTimeout(() => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registered');
                        // Check for updates after camera is ready and service worker is registered
                        this.checkForUpdatesAfterCameraReady();
                    })
                    .catch(error => console.log('ServiceWorker registration failed:', error));
            }, 100);
        }
    }

    async checkForUpdatesAfterCameraReady() {
        // Wait a bit more to ensure camera is fully ready
        setTimeout(async () => {
            try {
                console.log('[App] Checking for PWA updates...');
                const hasUpdate = await this.checkForAppUpdate();
                if (hasUpdate) {
                    this.showUpdateNotification();
                }
            } catch (error) {
                console.error('[App] Error checking for updates:', error);
            }
        }, 2000); // 2 seconds after camera is ready
    }

    async checkForAppUpdate() {
        if (!('serviceWorker' in navigator)) {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                return false;
            }

            // Check if there's already a waiting service worker
            if (registration.waiting) {
                console.log('[App] Update available (waiting worker)');
                return true;
            }

            // Force check for updates
            await registration.update();
            
            if (registration.waiting) {
                console.log('[App] Update available after check');
                return true;
            }

            console.log('[App] No updates available');
            return false;
        } catch (error) {
            console.error('[App] Error checking for updates:', error);
            return false;
        }
    }

    showUpdateNotification() {
        // Create a subtle notification that doesn't interrupt camera usage
        const notification = document.createElement('div');
        notification.id = 'updateNotification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 1rem;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 150, 255, 0.9);
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 1rem;
                font-size: 0.9rem;
                animation: slideDown 0.3s ease-out;
            ">
                <span>📱 App update available</span>
                <button onclick="window.app.applyUpdate()" style="
                    background: white;
                    color: #0096ff;
                    border: none;
                    padding: 0.4rem 0.8rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                ">Update</button>
                <button onclick="window.app.dismissUpdateNotification()" style="
                    background: none;
                    color: white;
                    border: none;
                    cursor: pointer;
                    opacity: 0.8;
                    padding: 0.4rem;
                ">✕</button>
            </div>
        `;

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            this.dismissUpdateNotification();
        }, 10000);
    }

    async applyUpdate() {
        try {
            console.log('[App] Applying update...');
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                // Tell the waiting service worker to skip waiting
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                
                // Listen for the new service worker to take control
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('[App] New service worker active, reloading...');
                    window.location.reload();
                });
            }
        } catch (error) {
            console.error('[App] Error applying update:', error);
            // Fallback: just reload the page
            window.location.reload();
        }
    }

    dismissUpdateNotification() {
        const notification = document.getElementById('updateNotification');
        if (notification) {
            notification.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    switchView(view, clearAutoReturn = true) {
        // Clear any pending auto-return timeout only if this is a manual switch
        if (clearAutoReturn && this.autoReturnTimeout) {
            clearTimeout(this.autoReturnTimeout);
            this.autoReturnTimeout = null;
        }

        if (view === 'camera') {
            this.cameraView.classList.add('active');
            this.galleryView.classList.remove('active');
            this.cameraButton.classList.add('active');
            this.galleryButton.classList.remove('active');
            // Reinitialize camera when switching back to camera view
            this.initializeCamera();
        } else {
            this.cameraView.classList.remove('active');
            this.galleryView.classList.add('active');
            this.cameraButton.classList.remove('active');
            this.galleryButton.classList.add('active');
            // Stop the camera stream when switching to gallery
            this.stopCamera();
            // Lazy load gallery content only when needed
            this.ensureGalleryLoaded();
        }
    }

    async ensureGalleryLoaded() {
        if (!this.galleryLoaded) {
            // Wait for database to be ready
            if (!this.db) {
                try {
                    await this.initializeDB();
                } catch (error) {
                    console.error('Database not available for gallery:', error);
                    this.photoGallery.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Unable to load photos - database unavailable</p>';
                    return;
                }
            }
            this.galleryLoaded = true;
        }
        this.loadPhotos();
    }

    handleExpiryChange() {
        const selectedValue = this.expirySelect.value;
        if (selectedValue === 'custom') {
            this.customExpiryContainer.style.display = 'block';
        } else {
            this.customExpiryContainer.style.display = 'none';
        }
    }

    getExpiryDate() {
        const selectedValue = this.expirySelect.value;
        if (selectedValue === 'custom') {
            return new Date(this.customExpiry.value).getTime();
        } else {
            return Date.now() + parseInt(selectedValue);
        }
    }

    displayPhotos(photos) {
        this.photoGallery.innerHTML = '';

        photos.sort((a, b) => b.timestamp - a.timestamp).forEach(photo => {
            const photoCard = this.createPhotoCard(photo);
            this.photoGallery.appendChild(photoCard);
        });
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = timestamp - now;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (years > 0) {
            return `${years} ${years === 1 ? 'year' : 'years'}`;
        } else if (months > 0) {
            return `${months} ${months === 1 ? 'month' : 'months'}`;
        } else if (days > 0) {
            return `${days} ${days === 1 ? 'day' : 'days'}`;
        } else if (hours > 0) {
            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        } else if (minutes > 0) {
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        } else {
            return `${Math.max(0, seconds)} seconds`;
        }
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    createPhotoCard(photo) {
        const card = document.createElement('div');
        card.className = 'photo-card';

        const img = document.createElement('img');
        img.src = photo.data;
        img.alt = 'Captured photo';
        if (this.fullscreenViewer) {
            img.addEventListener('click', () => this.openFullscreenViewer(photo.data));
        }

        const info = document.createElement('div');
        info.className = 'photo-info';
        
        const relativeTime = this.formatRelativeTime(photo.expiryDate);
        const creationTime = this.formatDateTime(photo.timestamp);
        info.innerHTML = `
            <div class="photo-time-info">
                <p class="expiry-time">Expires in: ${relativeTime}</p>
                <p class="creation-time">Taken: ${creationTime}</p>
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'photo-actions';

        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '<span class="icon">💾</span> Download';
        downloadBtn.onclick = () => this.downloadPhoto(photo);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<span class="icon">🗑️</span> Delete';
        deleteBtn.onclick = () => this.deletePhoto(photo.id);

        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(img);
        card.appendChild(info);
        card.appendChild(actions);

        return card;
    }

    async downloadPhoto(photo) {
        const link = document.createElement('a');
        link.href = photo.data;
        link.download = `photo-${new Date(photo.timestamp).toISOString()}.jpg`;
        link.click();
    }

    stopCamera() {
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.stopCamera();
        } else {
            // Only restart camera if we're in camera view
            if (this.cameraView.classList.contains('active')) {
                this.initializeCamera();
            }
        }
    }

    handleFocus() {
        // Only restart camera if we're in camera view
        if (this.cameraView.classList.contains('active')) {
            this.initializeCamera();
        }
    }

    openFullscreenViewer(imageData) {
        if (this.fullscreenImage) {
            this.fullscreenImage.src = imageData;
        }
        if (this.fullscreenViewer) {
            this.fullscreenViewer.classList.add('active');
        }
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    closeFullscreenViewer() {
        if (this.fullscreenViewer) {
            this.fullscreenViewer.classList.remove('active');
        }
        document.body.style.overflow = ''; // Restore scrolling
    }

    openInfoPopup() {
        this.infoPopup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeInfoPopup() {
        this.infoPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExpiringPhotosApp();
});
