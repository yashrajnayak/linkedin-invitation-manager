# LinkedIn Invitation Manager

A powerful Chromium extension that transforms your LinkedIn connection request management with a beautiful, swipe-based interface.

<img width="1510" alt="image" src="https://github.com/user-attachments/assets/e2d27539-0e05-4730-b1aa-0298a2e58e94" />

### Features
- 🎯 Launches immediately with an overlay interface - no waiting!
- 💳 Beautiful card-based design with smooth animations
- 🎨 Swipe gestures with real-time card movement and visual feedback
- 👤 Shows profile pictures, names, taglines, and mutual connections
- ⚡ Swipe or click to Accept, Ignore, or Skip connections
- 🌙 Modern overlay design that doesn't interfere with LinkedIn
- 📱 Works perfectly on different screen sizes
- 🔄 Intelligently loads connections in small batches

### Quick Start
1. Follow the installation steps below to install the extension
2. Navigate to your [LinkedIn Invitation Manager](https://www.linkedin.com/mynetwork/invitation-manager/received/)
3. Click the 🔥 fire icon next to the settings button
4. Start swiping through your connection requests with confidence!

## 💾 Installation

[![Download Extension](https://img.shields.io/badge/Download-Extension-success?style=for-the-badge&logo=download)](https://github.com/yashrajnayak/linkedin-invitation-manager/archive/refs/heads/main.zip)

1. Download the repository as a ZIP file
2. Extract the ZIP file to a folder on your computer
3. Open your browser and navigate to the extensions page:
     - **Chrome**: `chrome://extensions/`
     - **Edge**: `edge://extensions/`
     - **Brave**: `brave://extensions/`
     - **Opera**: `opera://extensions/`
4. Enable "Developer mode" by toggling the switch, then click "Load unpacked" button and select the extracted extension folder
5. The extension icon should appear in your browser toolbar

## 📱 Usage

### Using the Connection Request Swiper
1. Navigate to [LinkedIn Invitation Manager](https://www.linkedin.com/mynetwork/invitation-manager/received/)
2. Look for the 🔥 fire icon next to the settings gear icon
3. Click the fire icon to instantly launch the swipe overlay
4. Use touch/mouse gestures or buttons to Accept, Ignore, or Skip requests
5. Press ESC or click the × to close the overlay

## 🔧 Troubleshooting

### Extension Not Loading
- Make sure Developer mode is enabled
- Check that you selected the correct folder (the entire repository folder)
- Try refreshing the extensions page

### Fire Icon Not Appearing  
- Make sure you're on the LinkedIn invitation manager page
- Refresh the page and wait a few seconds
- Check browser console for any error messages

### Cards Not Loading
- The extension loads available requests immediately for instant access
- Additional requests load automatically in smart batches as you swipe
- Never shows blank screens - always provides loading feedback
- If no cards appear, try refreshing the LinkedIn page

### Need Help?
- Look at browser console (F12) for error messages
- Make sure LinkedIn hasn't changed their interface

## 🔧 Technical Details

- **Permissions**: Only accesses LinkedIn pages (`activeTab`, `scripting`)
- **Host Permissions**: Limited to `https://www.linkedin.com/*`
- **Privacy**: No data is collected or transmitted - everything stays local
- **Performance**: Minimal impact on browser performance
- **Smart Loading**: Batch-loads connections and uses randomized intervals to mimic natural user behavior
- **Gesture Support**: Full touch and mouse swipe gesture support
- **Overlay Interface**: Non-intrusive full-screen overlay

## 📁 Project Structure

```
LinkedIn-Invitation-Manager/
├── README.md           # Project documentation
├── manifest.json       # Extension configuration
├── content.js          # Main extension logic with smart batch loading
├── background.js       # Background service worker
├── popup.html          # Extension popup interface
├── popup.js            # Popup functionality
├── images/             # Extension icons
```

## 📄 License

MIT License - Feel free to modify and distribute as needed.

## 🤝 Contributing

Want to improve the LinkedIn Invitation Manager? Pull requests are welcome!

---

**Note**: This extension enhances LinkedIn's interface while respecting LinkedIn's terms of service. Use responsibly and be mindful of daily usage limits.
