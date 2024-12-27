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

## Technical Details

- Uses the MediaDevices API for camera access
- Stores photos in localStorage (with base64 encoding)
- Implements PWA features for offline use
- Built with vanilla JavaScript, HTML, and CSS
