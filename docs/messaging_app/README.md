# P2P Messaging App

A secure peer-to-peer messaging application built with WebRTC that allows users to send text messages directly between devices without requiring a backend server.

## Features

- 🔐 **Secure**: End-to-end encrypted messaging using WebRTC
- 🌐 **No Backend**: Works entirely in the browser using peer-to-peer connections
- 📱 **Cross-Platform**: Works on desktop and mobile browsers
- 🎯 **Easy to Use**: Simple room-based connection system
- 📊 **Real-time**: Instant message delivery
- 🎨 **Modern UI**: Beautiful, responsive design

## How to Use

### Starting a Chat

1. Open the messaging app in your browser
2. Click "Start Chat" to create a new chat session
3. A room ID will be generated (e.g., "ABC123")
4. Share the room ID or QR code with the person you want to chat with

### Joining a Chat

1. Open the messaging app in your browser
2. Enter the room ID provided by the chat initiator
3. Click "Join Chat" to connect to the existing chat session

### Cross-Device Messaging

For messaging between different devices or networks, you may need to manually share signaling data:

1. Copy the signaling data from the "Manual Signaling Data" section
2. Share this data with the other person (via email, text, etc.)
3. They should paste the data in the "Paste signaling data" field
4. Click "Process Data" to establish the connection

## Technical Details

### WebRTC Implementation

The app uses WebRTC's `RTCPeerConnection` and `RTCDataChannel` for:
- **Peer Discovery**: ICE (Interactive Connectivity Establishment) protocol
- **Connection Establishment**: SDP (Session Description Protocol) exchange
- **Data Transfer**: Reliable data channels for message transmission

### Signaling

Since WebRTC requires signaling for peer discovery and connection establishment, the app implements:
- **Manual Signaling**: Copy/paste signaling data between devices
- **Room-based System**: Simple room ID for connection identification
- **QR Code Support**: Easy sharing via QR codes

### Security

- **End-to-End Encryption**: All messages are encrypted between peers
- **No Server Storage**: Messages never pass through a central server
- **Peer-to-Peer**: Direct connection between devices

## Browser Compatibility

The app works in modern browsers that support WebRTC:
- Chrome 56+
- Firefox 52+
- Safari 11+
- Edge 79+

## File Structure

```
messaging_app/
├── index.html          # Main application interface
├── messaging.js        # WebRTC and messaging logic
└── README.md          # This file
```

## Troubleshooting

### Connection Issues

1. **Check Browser Support**: Ensure your browser supports WebRTC
2. **Network Restrictions**: Some networks may block WebRTC connections
3. **Firewall**: Ensure your firewall allows WebRTC traffic
4. **Manual Signaling**: Try using manual signaling for cross-device connections

### Message Delivery

1. **Connection Status**: Check if the connection status shows "Connected"
2. **Data Channel**: Ensure the data channel is open before sending messages
3. **Network Issues**: Poor network conditions may affect message delivery

## Development

To modify or extend the app:

1. **Add Features**: Extend the `P2PMessagingApp` class
2. **UI Changes**: Modify the CSS in `index.html`
3. **Signaling**: Implement a custom signaling server for automatic connection
4. **Encryption**: Add additional encryption layers if needed

## License

This project is open source and available under the MIT License. 