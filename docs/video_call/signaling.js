// Simple signaling service for video calls
class SignalingService {
    constructor() {
        this.messages = [];
        this.listeners = [];
    }

    // Add a message to the signaling service
    addMessage(message) {
        this.messages.push({
            ...message,
            timestamp: Date.now()
        });
        
        // Notify listeners
        this.listeners.forEach(listener => {
            listener(message);
        });
    }

    // Get all messages since a specific timestamp
    getMessages(since = 0) {
        return this.messages.filter(msg => msg.timestamp > since);
    }

    // Subscribe to new messages
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // Clear all messages
    clear() {
        this.messages = [];
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignalingService;
} 