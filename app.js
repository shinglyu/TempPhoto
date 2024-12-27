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
        } else {
            this.cameraView.classList.remove('active');
            this.galleryView.classList.add('active');
            this.cameraButton.classList.remove('active');
            this.galleryButton.classList.add('active');
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

    createPhotoCard(photo) {
        const card = document.createElement('div');
        card.className = 'photo-card';

        const img = document.createElement('img');
        img.src = photo.data;
        img.alt = 'Captured photo';

        const info = document.createElement('div');
        info.className = 'photo-info';
        
        const expiryDate = new Date(photo.expiryDate);
        info.innerHTML = `
            <p>Expires: ${expiryDate.toLocaleString()}</p>
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
        let photos = await this.getPhotos();
        photos = photos.filter(photo => photo.id !== photoId);
        localStorage.setItem('expiring-photos', JSON.stringify(photos));
        this.loadPhotos();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpiringPhotosApp();
});
