class ExpiringPhotosApp {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeCamera();
        this.loadPhotos();
        
        // Add visibility change and blur handlers
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('blur', () => this.stopCamera());
        window.addEventListener('focus', () => this.handleFocus());
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
        this.checkUpdateButton = document.getElementById('checkUpdateButton');

        // Camera elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.captureButton = document.getElementById('captureButton');
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
        this.expirySelect.addEventListener('change', () => this.handleExpiryChange());

        // Info popup handlers
        this.infoButton.addEventListener('click', () => this.openInfoPopup());
        this.closeInfoButton.addEventListener('click', () => this.closeInfoPopup());
        this.checkUpdateButton.addEventListener('click', () => this.checkForUpdates());

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
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 2560 },  
                    height: { ideal: 1440 }  
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            this.stream = stream;
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    }

    switchView(view) {
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
            this.loadPhotos();
        }
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

    capturePhoto() {
        // Set canvas size to match video dimensions
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Draw the video frame to the canvas
        const context = this.canvas.getContext('2d');
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to high quality JPEG
        const imageData = this.canvas.toDataURL('image/jpeg', 0.95);  

        const expiryDate = this.getExpiryDate();

        const photo = {
            id: Date.now().toString(),
            data: imageData,
            timestamp: Date.now(),
            expiryDate: expiryDate
        };

        this.savePhoto(photo);
        this.switchView('gallery');
    }

    async savePhoto(photo) {
        let photos = await this.getPhotos();
        photos.push(photo);
        localStorage.setItem('expiring-photos', JSON.stringify(photos));
    }

    async getPhotos() {
        const photos = JSON.parse(localStorage.getItem('expiring-photos') || '[]');
        const now = Date.now();
        const validPhotos = photos.filter(photo => photo.expiryDate > now);
        
        if (validPhotos.length !== photos.length) {
            localStorage.setItem('expiring-photos', JSON.stringify(validPhotos));
        }
        
        return validPhotos;
    }

    async loadPhotos() {
        const photos = await this.getPhotos();
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
        downloadBtn.innerHTML = '<span class="material-icons">download</span> Download';
        downloadBtn.onclick = () => this.downloadPhoto(photo);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<span class="material-icons">delete</span> Delete';
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

    async deletePhoto(photoId) {
        if (confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
            let photos = await this.getPhotos();
            photos = photos.filter(photo => photo.id !== photoId);
            localStorage.setItem('expiring-photos', JSON.stringify(photos));
            this.loadPhotos();
        }
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

    async checkForUpdates() {
        if ('serviceWorker' in navigator) {
            try {
                // Show loading state
                const updateButton = document.getElementById('checkUpdateButton');
                const originalText = updateButton.innerHTML;
                updateButton.innerHTML = '<span class="material-icons rotating">sync</span> Checking...';
                updateButton.disabled = true;

                // Get all service worker registrations
                const registrations = await navigator.serviceWorker.getRegistrations();
                
                // Unregister all existing service workers
                await Promise.all(registrations.map(registration => registration.unregister()));
                
                // Clear all caches
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));

                // Register new service worker
                const newRegistration = await navigator.serviceWorker.register('service-worker.js');
                await newRegistration.update();

                // Show success message
                updateButton.innerHTML = '<span class="material-icons">check</span> Updated!';
                setTimeout(() => {
                    alert('App updated successfully! The page will reload.');
                    window.location.reload(true);
                }, 500);
            } catch (error) {
                console.error('Error updating app:', error);
                alert('Failed to update app. Please try again later.');
                
                // Reset button state
                updateButton.innerHTML = originalText;
                updateButton.disabled = false;
            }
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpiringPhotosApp();
});
