class P2PVideoCall {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionPanel = document.getElementById('connectionPanel');
        this.videoPanel = document.getElementById('videoPanel');
        
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.audioOnlyMode = false;
        
        // Real connection properties
        this.isInitiator = false;
        this.remotePeerId = null;
        this.localPeerId = this.generatePeerId();
        this.signalingData = null;
        this.signalingInterval = null;
        this.iceCandidates = [];
        
        this.initializeEventListeners();
        this.getLocalIP();
        this.checkDeviceAvailability();
        this.startSignalingPolling();
    }

    generatePeerId() {
        return 'peer_' + Math.random().toString(36).substr(2, 9);
    }

    startSignalingPolling() {
        // Poll for signaling messages every 1 second
        this.signalingInterval = setInterval(() => {
            this.checkForSignalingMessages();
        }, 1000);
    }

    stopSignalingPolling() {
        if (this.signalingInterval) {
            clearInterval(this.signalingInterval);
            this.signalingInterval = null;
        }
    }

    checkForSignalingMessages() {
        try {
            const messages = JSON.parse(localStorage.getItem('webrtc_signaling') || '[]');
            console.log('Checking for signaling messages. Total messages:', messages.length);
            console.log('Local peer ID:', this.localPeerId);
            console.log('Remote peer ID:', this.remotePeerId);
            
            const relevantMessages = messages.filter(msg => 
                (msg.to === this.localPeerId && msg.from === this.remotePeerId) ||
                (msg.to === this.remotePeerId && msg.from === this.localPeerId)
            );
            
            console.log('Relevant messages found:', relevantMessages.length);
            relevantMessages.forEach(message => {
                console.log('Processing message:', message);
                this.handleSignalingMessage(message);
                // Remove processed message
                const updatedMessages = messages.filter(m => m !== message);
                localStorage.setItem('webrtc_signaling', JSON.stringify(updatedMessages));
            });
        } catch (error) {
            console.error('Error checking signaling messages:', error);
        }
    }

    sendSignalingMessage(message) {
        try {
            const messages = JSON.parse(localStorage.getItem('webrtc_signaling') || '[]');
            const messageWithMetadata = {
                ...message,
                timestamp: Date.now(),
                id: Math.random().toString(36).substr(2, 9)
            };
            messages.push(messageWithMetadata);
            localStorage.setItem('webrtc_signaling', JSON.stringify(messages));
            console.log('Sent signaling message:', messageWithMetadata);
            console.log('Total messages in storage:', messages.length);
        } catch (error) {
            console.error('Error sending signaling message:', error);
        }
    }

    handleSignalingMessage(message) {
        console.log('Received signaling message:', message);
        
        switch (message.type) {
            case 'offer':
                this.handleRemoteOffer(message);
                break;
            case 'answer':
                this.handleRemoteAnswer(message);
                break;
            case 'ice-candidate':
                this.handleRemoteIceCandidate(message);
                break;
        }
    }

    initializeEventListeners() {
        document.getElementById('startCall').addEventListener('click', () => this.startCall());
        document.getElementById('joinCall').addEventListener('click', () => this.joinCall());
        document.getElementById('endCall').addEventListener('click', () => this.endCall());
        document.getElementById('toggleVideo').addEventListener('click', () => this.toggleVideo());
        document.getElementById('toggleAudio').addEventListener('click', () => this.toggleAudio());
        document.getElementById('requestPermissions').addEventListener('click', () => this.requestPermissions());
        document.getElementById('noCamera').addEventListener('click', () => this.enableAudioOnlyMode());
        document.getElementById('testSignaling').addEventListener('click', () => this.testSignaling());
    }

    async getLocalIP() {
        try {
            // First try to get IP from an external service
            const response = await fetch('https://api.ipify.org?format=json');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('localIP').value = data.ip;
                return;
            }
        } catch (error) {
            console.log('Could not fetch external IP, trying local detection...');
        }

        try {
            // Fallback: Try to get local IP using WebRTC
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });
            
            pc.createDataChannel('');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            let localIP = null;
            
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const candidate = event.candidate.candidate;
                    // Look for IP addresses in the candidate
                    const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        // Filter out private IPs and prefer public ones
                        if (!ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('127.')) {
                            localIP = ip;
                        } else if (!localIP) {
                            // Store the first private IP as fallback
                            localIP = ip;
                        }
                    }
                }
            };
            
            // Wait for ICE candidates and then close
            setTimeout(() => {
                pc.close();
                if (localIP) {
                    document.getElementById('localIP').value = localIP;
                } else {
                    // If still no IP, try another method
                    this.getLocalIPFromNetwork();
                }
            }, 2000);
            
        } catch (error) {
            console.log('WebRTC method failed, trying network method...');
            this.getLocalIPFromNetwork();
        }
    }

    async getLocalIPFromNetwork() {
        try {
            // Try to get IP from multiple sources
            const ipSources = [
                'https://api.ipify.org?format=json',
                'https://api.myip.com',
                'https://ipapi.co/json/'
            ];
            
            for (const source of ipSources) {
                try {
                    const response = await fetch(source, { 
                        method: 'GET',
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        let ip = data.ip || data.query || data.ipAddress;
                        
                        if (ip) {
                            document.getElementById('localIP').value = ip;
                            return;
                        }
                    }
                } catch (e) {
                    console.log(`Failed to fetch from ${source}:`, e);
                    continue;
                }
            }
            
            // If all external methods fail, show a message
            document.getElementById('localIP').value = 'IP detection failed - use manual input below';
            
        } catch (error) {
            console.error('All IP detection methods failed:', error);
            document.getElementById('localIP').value = 'IP detection failed - use manual input below';
        }
    }

    getEffectiveLocalIP() {
        // Get the IP address to use - prefer manual input if available
        const manualIP = document.getElementById('manualIP').value.trim();
        const detectedIP = document.getElementById('localIP').value.trim();
        
        // If manual IP is provided and valid, use it
        if (manualIP && manualIP !== 'IP detection failed - use manual input below' && manualIP !== 'Detecting IP address...') {
            return manualIP;
        }
        
        // If detected IP is available and valid, use it
        if (detectedIP && detectedIP !== 'IP detection failed - use manual input below' && detectedIP !== 'Detecting IP address...') {
            return detectedIP;
        }
        
        // If no valid IP found, return a default for local testing
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'localhost';
        }
        
        return null;
    }

    async startCall() {
        console.log('Start call button clicked');
        const remoteIP = document.getElementById('remoteIP').value.trim();
        const port = document.getElementById('port').value;
        const localIP = this.getEffectiveLocalIP();
        
        console.log('Remote IP:', remoteIP);
        console.log('Local IP:', localIP);
        console.log('Port:', port);
        
        if (!remoteIP) {
            alert('Please enter the remote IP address');
            return;
        }

        if (!localIP) {
            alert('Please ensure your IP address is detected or manually entered');
            return;
        }

        try {
            console.log('Starting real call process...');
            this.isInitiator = true;
            // Use the remote IP as the peer ID for now
            this.remotePeerId = 'peer_' + remoteIP.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Check if permissions are already granted, if not request them
            if (!this.localStream) {
                console.log('Requesting permissions...');
                await this.requestPermissions();
            }
            
            console.log('Initializing media...');
            await this.initializeMedia();
            console.log('Creating peer connection...');
            await this.createPeerConnection();
            this.showVideoPanel();
            this.updateConnectionStatus('Creating offer...', 'connecting');
            
            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send the offer to the remote peer
            this.sendSignalingMessage({
                type: 'offer',
                sdp: offer.sdp,
                from: this.localPeerId,
                to: this.remotePeerId
            });
            
            console.log('Offer sent, waiting for answer...');
            this.updateConnectionStatus('Waiting for answer...', 'connecting');
            
        } catch (error) {
            console.error('Error starting call:', error);
            alert('Failed to start call: ' + error.message);
        }
    }

    async joinCall() {
        console.log('Join call button clicked');
        const remoteIP = document.getElementById('remoteIP').value.trim();
        const port = document.getElementById('port').value;
        const localIP = this.getEffectiveLocalIP();
        
        console.log('Remote IP:', remoteIP);
        console.log('Local IP:', localIP);
        console.log('Port:', port);
        
        if (!remoteIP) {
            alert('Please enter the remote IP address');
            return;
        }

        if (!localIP) {
            alert('Please ensure your IP address is detected or manually entered');
            return;
        }

        try {
            console.log('Joining real call...');
            this.isInitiator = false;
            // Use the remote IP as the peer ID for now
            this.remotePeerId = 'peer_' + remoteIP.replace(/[^a-zA-Z0-9]/g, '_');
            
            // Check if permissions are already granted, if not request them
            if (!this.localStream) {
                console.log('Requesting permissions...');
                await this.requestPermissions();
            }
            
            console.log('Initializing media...');
            await this.initializeMedia();
            console.log('Creating peer connection...');
            await this.createPeerConnection();
            this.showVideoPanel();
            this.updateConnectionStatus('Waiting for offer...', 'connecting');
            
            // Wait for an offer from the remote peer
            // The offer will be handled by the signaling polling system
            
        } catch (error) {
            console.error('Error joining call:', error);
            alert('Failed to join call: ' + error.message);
        }
    }

    async initializeMedia() {
        try {
            let mediaConstraints = {
                video: !this.audioOnlyMode,
                audio: true
            };

            // If no camera is available, force audio-only mode
            if (this.audioOnlyMode) {
                mediaConstraints.video = false;
            }

            this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
            
            if (this.localStream) {
                // Only set video source if video is available and not in audio-only mode
                if (!this.audioOnlyMode && this.localStream.getVideoTracks().length > 0) {
                    this.localVideo.srcObject = this.localStream;
                    this.localVideo.play().catch(e => console.log('Video play failed:', e));
                } else {
                    // Create a placeholder for audio-only mode
                    this.createAudioOnlyPlaceholder();
                }
            }
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera and microphone permissions were denied. Please allow permissions in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera or microphone found. Please check your device connections.');
            } else {
                throw new Error('Could not access camera and microphone: ' + error.message);
            }
        }
    }

    createAudioOnlyPlaceholder() {
        // Create a canvas-based placeholder for audio-only mode
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // Draw a user icon and "Audio Only" text
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a simple user icon
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2 - 50, 80, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw body
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2 + 50, 120, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add text
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Audio Only Mode', canvas.width/2, canvas.height/2 + 200);
        
        // Convert canvas to video stream
        const stream = canvas.captureStream(1);
        this.localVideo.srcObject = stream;
        this.localVideo.play().catch(e => console.log('Audio-only placeholder play failed:', e));
    }

    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Add local stream to peer connection
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        // Handle incoming remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream:', event.streams[0]);
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
            this.remoteVideo.play().catch(e => console.log('Remote video play failed:', e));
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state changed:', this.peerConnection.connectionState);
            switch(this.peerConnection.connectionState) {
                case 'connected':
                    this.updateConnectionStatus('Connected (Real WebRTC)', 'connected');
                    break;
                case 'disconnected':
                    this.updateConnectionStatus('Disconnected', 'disconnected');
                    break;
                case 'failed':
                    this.updateConnectionStatus('Connection Failed', 'failed');
                    break;
                case 'connecting':
                    this.updateConnectionStatus('Connecting...', 'connecting');
                    break;
            }
        };

        // Handle ICE candidate events
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate);
                // Send the ICE candidate to the remote peer
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: this.localPeerId,
                    to: this.remotePeerId
                });
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        };
    }

    simulateConnection() {
        // This method is no longer needed with real signaling
        console.log('Simulation method called - should not happen with real signaling');
    }

    simulateReceivingOffer() {
        // This method is no longer needed with real signaling
        console.log('Simulation method called - should not happen with real signaling');
    }

    simulateRealConnection() {
        // This method is no longer needed with real signaling
        console.log('Simulation method called - should not happen with real signaling');
    }

    async handleRemoteOffer(offer) {
        try {
            console.log('Handling remote offer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Process any stored ICE candidates
            while (this.iceCandidates.length > 0) {
                const candidate = this.iceCandidates.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Stored ICE candidate added');
                } catch (error) {
                    console.error('Error adding stored ICE candidate:', error);
                }
            }
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send the answer to the remote peer
            this.sendSignalingMessage({
                type: 'answer',
                sdp: answer.sdp,
                from: this.localPeerId,
                to: this.remotePeerId
            });
            
            console.log('Answer created and sent');
            this.updateConnectionStatus('Connected (Real WebRTC)', 'connected');
            
        } catch (error) {
            console.error('Error handling remote offer:', error);
            this.updateConnectionStatus('Connection failed', 'failed');
        }
    }

    async handleRemoteAnswer(answer) {
        try {
            console.log('Handling remote answer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Process any stored ICE candidates
            while (this.iceCandidates.length > 0) {
                const candidate = this.iceCandidates.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Stored ICE candidate added');
                } catch (error) {
                    console.error('Error adding stored ICE candidate:', error);
                }
            }
            
            console.log('Remote answer processed');
            this.updateConnectionStatus('Connected (Real WebRTC)', 'connected');
        } catch (error) {
            console.error('Error handling remote answer:', error);
            this.updateConnectionStatus('Connection failed', 'failed');
        }
    }

    async handleRemoteIceCandidate(message) {
        try {
            console.log('Handling remote ICE candidate...');
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
                console.log('Remote ICE candidate added');
            } else {
                // Store the candidate for later if remote description isn't set yet
                this.iceCandidates.push(message.candidate);
            }
        } catch (error) {
            console.error('Error handling remote ICE candidate:', error);
        }
    }

    createRealRemoteStream() {
        // This method is no longer needed since we'll get real video from the remote peer
        console.log('Real remote stream method called - should not happen with real signaling');
    }

    toggleVideo() {
        if (this.audioOnlyMode) {
            // In audio-only mode, show a message
            alert('Video is disabled in audio-only mode');
            return;
        }
        
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoEnabled = videoTrack.enabled;
                
                const btn = document.getElementById('toggleVideo');
                if (this.isVideoEnabled) {
                    btn.innerHTML = '<i class="fas fa-video"></i>';
                    btn.classList.remove('muted');
                } else {
                    btn.innerHTML = '<i class="fas fa-video-slash"></i>';
                    btn.classList.add('muted');
                }
            }
        }
    }

    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioEnabled = audioTrack.enabled;
                
                const btn = document.getElementById('toggleAudio');
                if (this.isAudioEnabled) {
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                    btn.classList.remove('muted');
                } else {
                    btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                    btn.classList.add('muted');
                }
            }
        }
    }

    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Stop signaling polling
        this.stopSignalingPolling();
        
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        
        this.showConnectionPanel();
        this.updateConnectionStatus('Disconnected', 'disconnected');
    }

    showVideoPanel() {
        this.connectionPanel.style.display = 'none';
        this.videoPanel.style.display = 'block';
        
        // Handle audio-only mode display
        if (this.audioOnlyMode) {
            document.getElementById('audioOnlyIndicator').style.display = 'flex';
            document.getElementById('toggleVideo').style.display = 'none';
        } else {
            document.getElementById('audioOnlyIndicator').style.display = 'none';
            document.getElementById('toggleVideo').style.display = 'flex';
        }
    }

    showConnectionPanel() {
        this.connectionPanel.style.display = 'block';
        this.videoPanel.style.display = 'none';
    }

    updateConnectionStatus(status, className) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.parentElement.className = `connection-status ${className}`;
    }

    async checkDeviceAvailability() {
        const cameraStatus = document.getElementById('cameraStatus');
        const micStatus = document.getElementById('micStatus');
        const cameraIcon = document.getElementById('cameraIcon');
        const micIcon = document.getElementById('micIcon');

        try {
            // Check if devices are available
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            const audioDevices = devices.filter(device => device.kind === 'audioinput');

            // Update camera status
            if (videoDevices.length > 0) {
                cameraStatus.textContent = 'Camera available';
                cameraStatus.parentElement.className = 'status-item available';
                cameraIcon.className = 'fas fa-video';
            } else {
                cameraStatus.textContent = 'No camera found';
                cameraStatus.parentElement.className = 'status-item unavailable';
                cameraIcon.className = 'fas fa-video-slash';
            }

            // Update microphone status
            if (audioDevices.length > 0) {
                micStatus.textContent = 'Microphone available';
                micStatus.parentElement.className = 'status-item available';
                micIcon.className = 'fas fa-microphone';
            } else {
                micStatus.textContent = 'No microphone found';
                micStatus.parentElement.className = 'status-item unavailable';
                micIcon.className = 'fas fa-microphone-slash';
            }

        } catch (error) {
            console.error('Error checking device availability:', error);
            cameraStatus.textContent = 'Could not check camera';
            micStatus.textContent = 'Could not check microphone';
            cameraStatus.parentElement.className = 'status-item checking';
            micStatus.parentElement.className = 'status-item checking';
        }
    }

    async requestPermissions() {
        const cameraStatus = document.getElementById('cameraStatus');
        const micStatus = document.getElementById('micStatus');
        const cameraIcon = document.getElementById('cameraIcon');
        const micIcon = document.getElementById('micIcon');

        try {
            // Request permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Update status
            cameraStatus.textContent = 'Camera connected';
            micStatus.textContent = 'Microphone connected';
            cameraStatus.parentElement.className = 'status-item available';
            micStatus.parentElement.className = 'status-item available';
            cameraIcon.className = 'fas fa-video';
            micIcon.className = 'fas fa-microphone';

            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());

            // Hide permission buttons
            document.getElementById('requestPermissions').style.display = 'none';
            document.getElementById('noCamera').style.display = 'none';

        } catch (error) {
            console.error('Permission denied or device not available:', error);
            
            if (error.name === 'NotAllowedError') {
                cameraStatus.textContent = 'Permission denied';
                micStatus.textContent = 'Permission denied';
                alert('Camera and microphone permissions were denied. Please allow permissions in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                cameraStatus.textContent = 'No camera found';
                micStatus.textContent = 'No microphone found';
                alert('No camera or microphone found. You can still use audio-only mode.');
            } else {
                cameraStatus.textContent = 'Error accessing devices';
                micStatus.textContent = 'Error accessing devices';
                alert('Error accessing camera and microphone: ' + error.message);
            }

            cameraStatus.parentElement.className = 'status-item unavailable';
            micStatus.parentElement.className = 'status-item unavailable';
            cameraIcon.className = 'fas fa-video-slash';
            micIcon.className = 'fas fa-microphone-slash';
        }
    }

    async enableAudioOnlyMode() {
        try {
            // Request only audio permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });

            // Update status
            const micStatus = document.getElementById('micStatus');
            const micIcon = document.getElementById('micIcon');
            micStatus.textContent = 'Microphone connected (Audio only)';
            micStatus.parentElement.className = 'status-item available';
            micIcon.className = 'fas fa-microphone';

            const cameraStatus = document.getElementById('cameraStatus');
            const cameraIcon = document.getElementById('cameraIcon');
            cameraStatus.textContent = 'Audio only mode';
            cameraStatus.parentElement.className = 'status-item unavailable';
            cameraIcon.className = 'fas fa-user';

            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());

            // Hide permission buttons
            document.getElementById('requestPermissions').style.display = 'none';
            document.getElementById('noCamera').style.display = 'none';

            // Set audio only mode
            this.audioOnlyMode = true;

        } catch (error) {
            console.error('Error enabling audio-only mode:', error);
            alert('Error accessing microphone: ' + error.message);
        }
    }

    testSignaling() {
        console.log('=== SIGNALING TEST ===');
        console.log('Local Peer ID:', this.localPeerId);
        console.log('Remote Peer ID:', this.remotePeerId);
        
        // Clear old messages for testing
        localStorage.removeItem('webrtc_signaling');
        
        // Send a test message
        this.sendSignalingMessage({
            type: 'test',
            message: 'Hello from ' + this.localPeerId,
            from: this.localPeerId,
            to: this.remotePeerId || 'test_peer'
        });
        
        // Check for messages
        this.checkForSignalingMessages();
        
        // Show all messages in storage
        try {
            const messages = JSON.parse(localStorage.getItem('webrtc_signaling') || '[]');
            console.log('All messages in storage:', messages);
        } catch (error) {
            console.error('Error reading messages:', error);
        }
    }
}

// Utility function to copy IP to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const value = element.value.trim();
    
    if (!value || value === 'Detecting IP address...' || value === 'IP detection failed - use manual input below') {
        alert('No valid IP address to copy. Please wait for detection or enter manually.');
        return;
    }
    
    element.select();
    element.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        const btn = element.parentElement.querySelector('.copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for modern browsers
        if (navigator.clipboard) {
            navigator.clipboard.writeText(value).then(() => {
                const btn = element.parentElement.querySelector('.copy-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            });
        }
    }
}

// Function to manually detect IP address
async function detectIP() {
    const detectBtn = document.querySelector('.detect-btn');
    const localIPInput = document.getElementById('localIP');
    
    // Show loading state
    detectBtn.classList.add('loading');
    localIPInput.value = 'Detecting IP address...';
    
    try {
        // Create a new instance to use its methods
        const videoCall = new P2PVideoCall();
        await videoCall.getLocalIP();
    } catch (error) {
        console.error('IP detection failed:', error);
        localIPInput.value = 'IP detection failed - use manual input below';
    } finally {
        // Remove loading state
        detectBtn.classList.remove('loading');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new P2PVideoCall();
}); 