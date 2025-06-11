# TempPhoto

A Progressive Web App that lets you take photos that automatically expire after a set time period. Features include:

- Take photos using your device camera
- Set expiration times (1 day, 1 week, 1 month, 1 year, or custom)
- View photos in a gallery
- Download photos
- Delete photos manually
- Automatic deletion of expired photos
- Works offline
- Installable as a PWA

## Setup

1. Host these files on a web server with HTTPS (required for PWA and camera access)
2. Access the website through a modern browser
3. Allow camera permissions when prompted
4. Optional: Install the PWA by clicking the install button in your browser

## Usage

1. Use the Camera tab to take photos
2. Select an expiration time before taking a photo
3. Switch to the Gallery tab to view, download, or delete your photos
4. Photos will automatically disappear when they expire

## Demo

Check out the live demo here: [Demo Link](https://shinglyu.com/TempPhoto/)

## Technical Details

- Uses the MediaDevices API for camera access
- Stores photos in IndexedDB (with base64 encoding)
- Implements PWA features for offline use
- Built with vanilla JavaScript, HTML, and CSS

## PWA Updates

This app implements a cache-first strategy with background updates for optimal performance:

### How Updates Work

1. **Fast Initial Load**: App loads instantly from cache (camera ready immediately)
2. **Background Update Check**: After camera is ready, checks for updates without blocking user
3. **Gentle Notification**: Shows subtle update notification if new version is available
4. **User Choice**: Users can continue using current version or apply updates when convenient

### For Developers

When deploying a new version:

1. Update the cache version in `service-worker.js`
1. Deploy the updated files to your server
1. Users will see update notifications after their camera loads

### Cache Strategy

- **Assets (CSS, JS, images)**: Cache-first for instant loading
- **HTML files**: Cache-first with background network check
- **Automatic Cache Cleanup**: Old cache versions are automatically removed
- **Fallback Support**: Works offline even during updates

The update system ensures users always get the latest features while maintaining fast, reliable performance.
