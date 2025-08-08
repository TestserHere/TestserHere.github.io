class P2PMessagingApp {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.roomId = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.peerId = this.generatePeerId();
        this.signalingData = [];
        this.messages = [];

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.roomIdInput = document.getElementById('roomId');
        this.joinRoomIdInput = document.getElementById('joinRoomId');
        this.startChatBtn = document.getElementById('startChat');
        this.joinChatBtn = document.getElementById('joinChat');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatTitle = document.getElementById('chatTitle');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusDiv = document.getElementById('status');
        this.qrSection = document.getElementById('qrSection');
        this.qrCode = document.getElementById('qrCode');
        this.qrRoomId = document.getElementById('qrRoomId');
        this.manualSignaling = document.getElementById('manualSignaling');
        this.signalingDataDiv = document.getElementById('signalingData');
    }

    attachEventListeners() {
        this.startChatBtn.addEventListener('click', () => this.startChat());
        this.joinChatBtn.addEventListener('click', () => this.joinChat());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    generatePeerId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    async startChat() {
        try {
            this.showStatus('Creating chat session...', 'connecting');
            this.isInitiator = true;
            this.roomId = this.generateRoomId();
            this.roomIdInput.value = this.roomId;

            await this.createPeerConnection();
            this.createDataChannel();
            this.startSignaling();

            this.showStatus(`Chat session created! Room ID: ${this.roomId}`, 'connected');
            this.updateButtonStates(true);
            this.showQRCode();
            this.showManualSignaling();
            this.updateChatTitle(`Chat Room: ${this.roomId}`);
            this.updateConnectionStatus('Waiting for peer...');
        } catch (error) {
            this.showStatus(`Error creating chat: ${error.message}`, 'error');
            console.error('Error starting chat:', error);
        }
    }

    async joinChat() {
        try {
            this.showStatus('Joining chat...', 'connecting');
            this.isInitiator = false;
            this.roomId = this.joinRoomIdInput.value.trim();

            if (!this.roomId) {
                throw new Error('Please enter a room ID');
            }

            await this.createPeerConnection();
            this.startSignaling();

            this.showStatus(`Joined chat: ${this.roomId}`, 'connected');
            this.updateButtonStates(true);
            this.showManualSignaling();
            this.updateChatTitle(`Chat Room: ${this.roomId}`);
            this.updateConnectionStatus('Connecting...');
        } catch (error) {
            this.showStatus(`Error joining chat: ${error.message}`, 'error');
            console.error('Error joining chat:', error);
        }
    }

    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        this.peerConnection.ondatachannel = (event) => {
            console.log('Data channel received:', event.channel);
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const message = {
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: this.peerId,
                    roomId: this.roomId,
                    timestamp: Date.now()
                };
                this.signalingData.push(message);
                this.updateSignalingDisplay();
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state changed:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.isConnected = true;
                this.showStatus('Connected!', 'connected');
                this.updateConnectionStatus('Connected');
            } else if (this.peerConnection.connectionState === 'disconnected') {
                this.isConnected = false;
                this.showStatus('Disconnected', 'error');
                this.updateConnectionStatus('Disconnected');
            } else if (this.peerConnection.connectionState === 'failed') {
                this.isConnected = false;
                this.showStatus('Connection failed', 'error');
                this.updateConnectionStatus('Connection failed');
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                this.showStatus('ICE connection failed', 'error');
            }
        };
    }

    createDataChannel() {
        if (this.isInitiator) {
            try {
                this.dataChannel = this.peerConnection.createDataChannel('messaging', {
                    ordered: true
                });
                this.setupDataChannel();
            } catch (error) {
                console.error('Error creating data channel:', error);
                this.showStatus('Failed to create data channel', 'error');
            }
        }
    }

    setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.updateConnectionStatus('Connected');
            this.showStatus('Peer connected!', 'connected');
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.updateConnectionStatus('Disconnected');
            this.showStatus('Peer disconnected', 'error');
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showStatus('Connection error', 'error');
        };

        this.dataChannel.onmessage = (event) => {
            console.log('Message received:', event.data);
            this.handleReceivedMessage(event.data);
        };
    }

    handleReceivedMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.type === 'chat') {
                this.addMessage(message.content, message.timestamp, false);
            }
        } catch (error) {
            console.error('Error parsing received message:', error);
            // Handle plain text messages as fallback
            this.addMessage(data, Date.now(), false);
        }
    }

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) {
            return;
        }

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.showStatus('Not connected to peer', 'error');
            return;
        }

        const timestamp = Date.now();
        const message = {
            type: 'chat',
            content: content,
            timestamp: timestamp
        };

        try {
            this.dataChannel.send(JSON.stringify(message));
            this.addMessage(content, timestamp, true);
            this.messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            this.showStatus('Failed to send message', 'error');
        }
    }

    addMessage(content, timestamp, isSent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date(timestamp).toLocaleTimeString();

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);

        // Remove empty chat message if it exists
        const emptyChat = this.chatMessages.querySelector('.empty-chat');
        if (emptyChat) {
            emptyChat.remove();
        }

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Store message
        this.messages.push({
            content: content,
            timestamp: timestamp,
            isSent: isSent
        });
    }

    startSignaling() {
        if (this.isInitiator) {
            setTimeout(async () => {
                try {
                    const offer = await this.peerConnection.createOffer();
                    await this.peerConnection.setLocalDescription(offer);
                    
                    const message = {
                        type: 'offer',
                        offer: offer,
                        from: this.peerId,
                        roomId: this.roomId,
                        timestamp: Date.now()
                    };
                    this.signalingData.push(message);
                    this.updateSignalingDisplay();
                } catch (error) {
                    console.error('Error creating offer:', error);
                    this.showStatus('Failed to create connection offer', 'error');
                }
            }, 1000);
        }
    }

    updateSignalingDisplay() {
        if (this.signalingData.length > 0) {
            const latestData = this.signalingData[this.signalingData.length - 1];
            this.signalingDataDiv.textContent = JSON.stringify(latestData, null, 2);
        }
    }

    showManualSignaling() {
        this.manualSignaling.style.display = 'block';
    }

    async processSignalingData(data) {
        try {
            const message = JSON.parse(data);
            if (message.roomId === this.roomId && message.from !== this.peerId) {
                await this.handleSignalingMessage(message);
            } else if (message.roomId !== this.roomId) {
                this.showStatus('Room ID mismatch', 'error');
            }
        } catch (error) {
            console.error('Error processing signaling data:', error);
            this.showStatus('Invalid signaling data format', 'error');
        }
    }

    async handleSignalingMessage(message) {
        try {
            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message.offer);
                    break;
                case 'answer':
                    await this.handleAnswer(message.answer);
                    break;
                case 'ice-candidate':
                    await this.handleIceCandidate(message.candidate);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling signaling message:', error);
            this.showStatus('Failed to process signaling data', 'error');
        }
    }

    async handleOffer(offer) {
        try {
            console.log('Handling offer:', offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            const message = {
                type: 'answer',
                answer: answer,
                from: this.peerId,
                roomId: this.roomId,
                timestamp: Date.now()
            };
            this.signalingData.push(message);
            this.updateSignalingDisplay();
        } catch (error) {
            console.error('Error handling offer:', error);
            this.showStatus('Failed to handle connection offer', 'error');
        }
    }

    async handleAnswer(answer) {
        try {
            console.log('Handling answer:', answer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
            this.showStatus('Failed to handle connection answer', 'error');
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                console.log('Cannot add ICE candidate - no remote description or peer connection');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    showQRCode() {
        const url = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        this.qrRoomId.textContent = this.roomId;
        
        if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
            try {
                QRCode.toCanvas(this.qrCode, url, {
                    width: 150,
                    margin: 2
                }, (error) => {
                    if (error) {
                        console.error('Error generating QR code:', error);
                        this.showQRCodeFallback();
                    }
                });
            } catch (error) {
                console.error('Error with QR code generation:', error);
                this.showQRCodeFallback();
            }
        } else {
            this.showQRCodeFallback();
        }
        
        this.qrSection.style.display = 'block';
    }

    showQRCodeFallback() {
        this.qrCode.innerHTML = `
            <div style="text-align: center; padding: 15px;">
                <h4>Room ID: ${this.roomId}</h4>
                <p>Share this room ID with others to join your chat</p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin: 8px 0;">
                    <strong>Direct Link:</strong><br>
                    <a href="${window.location.origin}${window.location.pathname}?room=${this.roomId}" target="_blank">
                        ${window.location.origin}${window.location.pathname}?room=${this.roomId}
                    </a>
                </div>
            </div>
        `;
    }

    updateChatTitle(title) {
        this.chatTitle.textContent = title;
    }

    updateConnectionStatus(status) {
        this.connectionStatus.textContent = status;
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.style.display = 'block';
    }

    updateButtonStates(inChat) {
        this.startChatBtn.disabled = inChat;
        this.joinChatBtn.disabled = inChat;
        this.messageInput.disabled = !inChat;
        this.sendMessageBtn.disabled = !inChat;
    }

    endChat() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.dataChannel = null;
        this.peerConnection = null;
        this.isConnected = false;
        this.roomId = null;

        this.roomIdInput.value = '';
        this.joinRoomIdInput.value = '';
        this.qrSection.style.display = 'none';
        this.manualSignaling.style.display = 'none';
        this.showStatus('Chat ended', 'error');
        this.updateButtonStates(false);
        this.updateChatTitle('P2P Messaging');
        this.updateConnectionStatus('Not connected');
    }
}

// Global functions for manual signaling
function copySignalingData() {
    const signalingData = document.getElementById('signalingData').textContent;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(signalingData).then(() => {
            alert('Signaling data copied to clipboard!');
        }).catch(() => {
            copySignalingDataFallback(signalingData);
        });
    } else {
        copySignalingDataFallback(signalingData);
    }
}

function copySignalingDataFallback(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        alert('Signaling data copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy signaling data. Please copy it manually.');
    }
    document.body.removeChild(textArea);
}

function processSignalingData() {
    const data = document.getElementById('pasteSignalingData').value.trim();
    if (data) {
        app.processSignalingData(data);
        document.getElementById('pasteSignalingData').value = '';
    } else {
        alert('Please paste signaling data first.');
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new P2PMessagingApp();
    
    // Check for room parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
        document.getElementById('joinRoomId').value = roomId;
    }
}); 