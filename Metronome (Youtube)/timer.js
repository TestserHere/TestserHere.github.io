
function Timer(callback, timeInterval, options) {
    this.timeInterval = timeInterval;


    this.start = () => {
        this.expected = Data.now() + this.timeInterval;         
        
        this.theTimeout = null;

        if (options.immediate) {
            callback();
        }
        
        this.timeout = setTimeout(this.round, this.timeInterval)
        console.log('Timer started');
        
    }

    this.stop = () => {
        clearTimeout(this.timeout)
        console.log('Timer stopped');
    }

    this.round = () => {
        console.log('timeout', this.timeout);

        let drift = Date.now() - this.expected;

        if (drift > this.timeInterval) {
            if (options.errorCallback) {
                options.errorCallback();
            }
        }
    
        callback();

        this.expected += this.timeInterval;
        console.log('Drift', drift);
        console.log('Next round time interval:', this.timeInterval - drift);

        this.timeout = setTimeout(this.round, this.timeInterval - drift);
    }
}

export default Timer;