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
        
        this.initializeEventListeners();
        this.getLocalIP();
    }

    initializeEventListeners() {
        document.getElementById('startCall').addEventListener('click', () => this.startCall());
        document.getElementById('joinCall').addEventListener('click', () => this.joinCall());
        document.getElementById('endCall').addEventListener('click', () => this.endCall());
        document.getElementById('toggleVideo').addEventListener('click', () => this.toggleVideo());
        document.getElementById('toggleAudio').addEventListener('click', () => this.toggleAudio());
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
        
        if (manualIP && manualIP !== 'IP detection failed - use manual input below') {
            return manualIP;
        }
        
        if (detectedIP && detectedIP !== 'IP detection failed - use manual input below' && detectedIP !== 'Detecting IP address...') {
            return detectedIP;
        }
        
        return null;
    }

    async startCall() {
        const remoteIP = document.getElementById('remoteIP').value.trim();
        const port = document.getElementById('port').value;
        const localIP = this.getEffectiveLocalIP();
        
        if (!remoteIP) {
            alert('Please enter the remote IP address');
            return;
        }

        if (!localIP) {
            alert('Please ensure your IP address is detected or manually entered');
            return;
        }

        try {
            await this.initializeMedia();
            await this.createPeerConnection();
            this.showVideoPanel();
            this.updateConnectionStatus('Connecting...', 'connecting');
            
            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // In a real implementation, you would send this offer to the remote peer
            // For this demo, we'll simulate the connection
            this.simulateConnection();
            
        } catch (error) {
            console.error('Error starting call:', error);
            alert('Failed to start call: ' + error.message);
        }
    }

    async joinCall() {
        const remoteIP = document.getElementById('remoteIP').value.trim();
        const port = document.getElementById('port').value;
        const localIP = this.getEffectiveLocalIP();
        
        if (!remoteIP) {
            alert('Please enter the remote IP address');
            return;
        }

        if (!localIP) {
            alert('Please ensure your IP address is detected or manually entered');
            return;
        }

        try {
            await this.initializeMedia();
            await this.createPeerConnection();
            this.showVideoPanel();
            this.updateConnectionStatus('Connecting...', 'connecting');
            
            // In a real implementation, you would receive an offer from the remote peer
            // For this demo, we'll simulate the connection
            this.simulateConnection();
            
        } catch (error) {
            console.error('Error joining call:', error);
            alert('Failed to join call: ' + error.message);
        }
    }

    async initializeMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            this.localVideo.srcObject = this.localStream;
            this.localVideo.play().catch(e => console.log('Video play failed:', e));
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw new Error('Could not access camera and microphone. Please ensure you have granted permissions.');
        }
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
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
            this.remoteVideo.play().catch(e => console.log('Remote video play failed:', e));
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            switch(this.peerConnection.connectionState) {
                case 'connected':
                    this.updateConnectionStatus('Connected', 'connected');
                    break;
                case 'disconnected':
                    this.updateConnectionStatus('Disconnected', 'disconnected');
                    break;
                case 'failed':
                    this.updateConnectionStatus('Connection Failed', 'failed');
                    break;
            }
        };

        // Handle ICE candidate events
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // In a real implementation, you would send this candidate to the remote peer
                console.log('New ICE candidate:', event.candidate);
            }
        };
    }

    simulateConnection() {
        // Simulate connection establishment for demo purposes
        setTimeout(() => {
            this.updateConnectionStatus('Connected', 'connected');
            
            // Create a mock remote stream for demonstration
            this.createMockRemoteStream();
        }, 2000);
    }

    createMockRemoteStream() {
        // Create a canvas-based mock video stream for demonstration
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        // Draw a simple animation
        let frame = 0;
        const animate = () => {
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#3498db';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Remote User', canvas.width/2, canvas.height/2);
            
            ctx.fillStyle = '#e74c3c';
            ctx.font = '24px Arial';
            ctx.fillText(`Frame: ${frame++}`, canvas.width/2, canvas.height/2 + 50);
            
            requestAnimationFrame(animate);
        };
        animate();
        
        // Convert canvas to stream
        const stream = canvas.captureStream(30);
        this.remoteVideo.srcObject = stream;
        this.remoteVideo.play().catch(e => console.log('Mock video play failed:', e));
    }

    toggleVideo() {
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
        
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        
        this.showConnectionPanel();
        this.updateConnectionStatus('Disconnected', 'disconnected');
    }

    showVideoPanel() {
        this.connectionPanel.style.display = 'none';
        this.videoPanel.style.display = 'block';
    }

    showConnectionPanel() {
        this.connectionPanel.style.display = 'block';
        this.videoPanel.style.display = 'none';
    }

    updateConnectionStatus(status, className) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.parentElement.className = `connection-status ${className}`;
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