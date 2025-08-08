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
        this.iceCandidateQueue = []; // Queue for ICE candidates that arrive before remote description
        this.connectionMonitor = null; // For monitoring connection status

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
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.indicatorText = document.getElementById('indicatorText');
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
            this.updateConnectionStatus('Creating session...');
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
            this.updateConnectionStatus('Error');
            console.error('Error starting chat:', error);
        }
    }

    async joinChat() {
        try {
            this.showStatus('Joining chat...', 'connecting');
            this.updateConnectionStatus('Joining...');
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
            this.updateConnectionStatus('Error');
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

    startConnectionMonitoring() {
        // Clear any existing monitoring
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
        }
        
        // Start monitoring connection status
        this.connectionMonitor = setInterval(() => {
            if (this.checkConnectionStatus()) {
                // Connection is established, stop monitoring
                clearInterval(this.connectionMonitor);
                this.connectionMonitor = null;
                console.log('Connection monitoring stopped - connection established');
            }
        }, 1000);
        
        // Stop monitoring after 30 seconds to avoid infinite monitoring
        setTimeout(() => {
            if (this.connectionMonitor) {
                clearInterval(this.connectionMonitor);
                this.connectionMonitor = null;
                console.log('Connection monitoring stopped - timeout reached');
            }
        }, 30000);
    }

    setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.updateConnectionStatus('Connected');
            this.showStatus('Peer connected! You can now send messages.', 'connected');
            // Enable message input when data channel is open
            this.messageInput.disabled = false;
            this.sendMessageBtn.disabled = false;
            
            // Stop connection monitoring if it's running
            if (this.connectionMonitor) {
                clearInterval(this.connectionMonitor);
                this.connectionMonitor = null;
            }
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.updateConnectionStatus('Disconnected');
            this.showStatus('Peer disconnected', 'error');
            // Disable message input when data channel is closed
            this.messageInput.disabled = true;
            this.sendMessageBtn.disabled = true;
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showStatus('Connection error occurred', 'error');
            this.updateConnectionStatus('Error');
        };

        this.dataChannel.onmessage = (event) => {
            console.log('Message received:', event.data);
            this.handleReceivedMessage(event.data);
        };

        // Check if data channel is already open
        if (this.dataChannel.readyState === 'open') {
            console.log('Data channel already open');
            this.updateConnectionStatus('Connected');
            this.showStatus('Peer connected! You can now send messages.', 'connected');
            this.messageInput.disabled = false;
            this.sendMessageBtn.disabled = false;
        }
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

        // Check connection status first
        if (!this.checkConnectionStatus()) {
            this.showStatus('Not connected to peer. Please wait for connection to be established.', 'error');
            return;
        }

        if (!this.dataChannel) {
            this.showStatus('No data channel available. Please wait for connection to be established.', 'error');
            return;
        }

        if (this.dataChannel.readyState !== 'open') {
            this.showStatus(`Data channel not ready. Current state: ${this.dataChannel.readyState}`, 'error');
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
            this.showStatus('Failed to send message: ' + error.message, 'error');
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
            console.log('Processing signaling data:', message.type, 'from:', message.from, 'room:', message.roomId);
            
            if (message.roomId === this.roomId && message.from !== this.peerId) {
                this.showStatus('Processing signaling data...', 'connecting');
                await this.handleSignalingMessage(message);
                this.showStatus('Signaling data processed successfully', 'connected');
                // Only clear the input after successful processing
                document.getElementById('pasteSignalingData').value = '';
            } else if (message.roomId !== this.roomId) {
                this.showStatus(`Room ID mismatch. Expected: ${this.roomId}, Got: ${message.roomId}`, 'error');
            } else if (message.from === this.peerId) {
                this.showStatus('This is your own signaling data', 'error');
            }
        } catch (error) {
            console.error('Error processing signaling data:', error);
            this.showStatus('Invalid signaling data format. Please check the data and try again.', 'error');
        }
    }

    checkConnectionStatus() {
        if (this.peerConnection) {
            console.log('Connection state:', this.peerConnection.connectionState);
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            console.log('Data channel state:', this.dataChannel ? this.dataChannel.readyState : 'No data channel');
            
            // Check if we have a data channel and it's open
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.updateConnectionStatus('Connected');
                this.messageInput.disabled = false;
                this.sendMessageBtn.disabled = false;
                this.showStatus('Peer connected! You can now send messages.', 'connected');
                return true;
            }
            
            // Check if peer connection is connected but data channel isn't ready yet
            if (this.peerConnection.connectionState === 'connected') {
                this.updateConnectionStatus('Establishing data channel...');
                this.showStatus('Peer connection established, waiting for data channel...', 'connecting');
                return false;
            }
            
            // Check if we're in the process of connecting
            if (this.peerConnection.connectionState === 'connecting' || this.peerConnection.iceConnectionState === 'checking') {
                this.updateConnectionStatus('Connecting...');
                this.showStatus('Establishing connection...', 'connecting');
                return false;
            }
            
            // Check if connection failed
            if (this.peerConnection.connectionState === 'failed' || this.peerConnection.iceConnectionState === 'failed') {
                this.updateConnectionStatus('Connection failed');
                this.showStatus('Connection failed. Please try again.', 'error');
                return false;
            }
        }
        return false;
    }

    async handleSignalingMessage(message) {
        try {
            console.log('Processing signaling message:', message.type);
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
                    this.showStatus(`Unknown message type: ${message.type}`, 'error');
            }
            
            // Start connection monitoring after processing signaling
            this.startConnectionMonitoring();
            
            // Check connection status after processing signaling with a longer delay
            setTimeout(() => {
                this.checkConnectionStatus();
            }, 2000);
        } catch (error) {
            console.error('Error handling signaling message:', error);
            this.showStatus('Failed to process signaling data: ' + error.message, 'error');
        }
    }

    async processQueuedIceCandidates() {
        if (this.iceCandidateQueue.length > 0 && this.peerConnection && this.peerConnection.remoteDescription) {
            console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates`);
            while (this.iceCandidateQueue.length > 0) {
                const candidate = this.iceCandidateQueue.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Queued ICE candidate added successfully');
                } catch (error) {
                    console.error('Error adding queued ICE candidate:', error);
                }
            }
            this.showStatus('Queued ICE candidates processed', 'connected');
            
            // Check connection status again after processing candidates
            setTimeout(() => {
                this.checkConnectionStatus();
            }, 1000);
        }
    }

    async handleOffer(offer) {
        try {
            console.log('Handling offer:', offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Process any queued ICE candidates
            await this.processQueuedIceCandidates();
            
            const message = {
                type: 'answer',
                answer: answer,
                from: this.peerId,
                roomId: this.roomId,
                timestamp: Date.now()
            };
            this.signalingData.push(message);
            this.updateSignalingDisplay();
            this.showStatus('Connection offer processed. Answer generated.', 'connected');
        } catch (error) {
            console.error('Error handling offer:', error);
            this.showStatus('Failed to handle connection offer: ' + error.message, 'error');
        }
    }

    async handleAnswer(answer) {
        try {
            console.log('Handling answer:', answer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Process any queued ICE candidates
            await this.processQueuedIceCandidates();
            
            this.showStatus('Connection answer processed successfully', 'connected');
        } catch (error) {
            console.error('Error handling answer:', error);
            this.showStatus('Failed to handle connection answer: ' + error.message, 'error');
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('ICE candidate added successfully');
            } else {
                // Queue the candidate for later when remote description is set
                console.log('Queueing ICE candidate - no remote description yet');
                this.iceCandidateQueue.push(candidate);
                this.showStatus('ICE candidate queued, waiting for remote description', 'connecting');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            this.showStatus('Failed to add ICE candidate: ' + error.message, 'error');
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
        this.updateConnectionIndicator(status);
    }

    updateConnectionIndicator(status) {
        if (!this.connectionIndicator || !this.indicatorText) return;

        const indicatorDot = this.connectionIndicator.querySelector('.indicator-dot');
        
        switch (status.toLowerCase()) {
            case 'connected':
                this.connectionIndicator.style.display = 'flex';
                indicatorDot.className = 'indicator-dot connected';
                this.indicatorText.textContent = 'Connected';
                break;
            case 'connecting':
            case 'waiting for peer...':
                this.connectionIndicator.style.display = 'flex';
                indicatorDot.className = 'indicator-dot';
                this.indicatorText.textContent = status;
                break;
            case 'disconnected':
            case 'connection failed':
            case 'error':
                this.connectionIndicator.style.display = 'flex';
                indicatorDot.className = 'indicator-dot error';
                this.indicatorText.textContent = status;
                break;
            default:
                this.connectionIndicator.style.display = 'none';
        }
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

    clearIceCandidateQueue() {
        this.iceCandidateQueue = [];
        console.log('ICE candidate queue cleared');
    }

    endChat() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Clear connection monitoring
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }

        this.dataChannel = null;
        this.peerConnection = null;
        this.isConnected = false;
        this.roomId = null;
        this.clearIceCandidateQueue();

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
        try {
            // Validate JSON format first
            JSON.parse(data);
            app.processSignalingData(data);
        } catch (error) {
            alert('Invalid JSON format. Please check the signaling data and try again.');
        }
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