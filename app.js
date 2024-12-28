class ExpiringPhotosApp {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeCamera();
        this.loadPhotos();
    }

    initializeElements() {
        // Navigation elements
        this.cameraButton = document.getElementById('cameraButton');
        this.galleryButton = document.getElementById('galleryButton');
        this.cameraView = document.getElementById('cameraView');
        this.galleryView = document.getElementById('galleryView');

        // Camera elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.captureButton = document.getElementById('captureButton');
        this.expirySelect = document.getElementById('expirySelect');
        this.customExpiryContainer = document.getElementById('customExpiryContainer');
        this.customExpiry = document.getElementById('customExpiry');

        // Gallery elements
        this.photoGallery = document.getElementById('photoGallery');
    }

    initializeEventListeners() {
        this.cameraButton.addEventListener('click', () => this.switchView('camera'));
        this.galleryButton.addEventListener('click', () => this.switchView('gallery'));
        this.captureButton.addEventListener('click', () => this.capturePhoto());
        this.expirySelect.addEventListener('change', () => this.handleExpiryChange());

        // Set minimum date-time for custom expiry
        const now = new Date();
        this.customExpiry.min = now.toISOString().slice(0, 16);
    }

    async initializeCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, 
                audio: false 
            });
            this.video.srcObject = stream;
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
            if (this.video.srcObject) {
                const tracks = this.video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                this.video.srcObject = null;
            }
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

    async capturePhoto() {
        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        const photoData = this.canvas.toDataURL('image/jpeg');
        const expiryDate = this.getExpiryDate();

        const photo = {
            id: Date.now().toString(),
            data: photoData,
            timestamp: Date.now(),
            expiryDate: expiryDate
        };

        await this.savePhoto(photo);
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
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpiringPhotosApp();
});
