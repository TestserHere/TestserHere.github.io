document.getElementById('openApp').addEventListener('click', function() {
    var appUrl = 'myapp://'; // Replace with your app's URL scheme
    var fallbackUrl = 'https://apps.apple.com/us/app/roblox/id431946152';
    
    var timeout = setTimeout(function() {
        window.location.href = fallbackUrl; // Redirect to App Store after a delay
    }, 2000); // Delay in milliseconds

    window.location.href = appUrl;

    // Clear timeout if the app is opened successfully
    window.addEventListener('pagehide', function() {
        clearTimeout(timeout);
    });
});
