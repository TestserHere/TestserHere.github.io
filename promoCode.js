
function check() {
    var promoCode = document.getElementById("input").value
    if (promoCode == "Minecraft") {
        console.log("code Minecraft!")
        window.open("https://testserhere.github.io/Minecraft_Recipe/index.html",'_blank');
    } else if (promoCode == "Youtube") {
        console.log("code Youtube!")
        window.open("https://youtube.com",'_blank');
    } else if (promoCode == "Spotify") {
        console.log("code Youtube!")
        window.open("https://spotify.com",'_blank');
    } else if (promoCode == "Roblox") {
        console.log("code Youtube!")
        window.open("https://roblox.com",'_blank');
    }
    
    
     
    
    
    
    else {
        document.getElementById("wrongCode").style.visibility = "visible";
        setTimeout(function () {
            document.getElementById("wrongCode").style.visibility = "hidden";           
        },1000)
    } 

}
