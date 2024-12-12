
function check() {
    var promoCode = document.getElementById("input").value
    if (promoCode == "Minecraft") {
        console.log("code Minecraft!")
        window.open("https://testserhere.github.io/Minecraft_Recipe/index.html",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Youtube") {
        console.log("code Youtube!");
        window.open("https://youtube.com",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Spotify") {
        console.log("code Spotify!");
        window.open("https://spotify.com",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Roblox") {
        console.log("code Roblox!");
        window.open("https://roblox.com",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "BPScompass") {
        console.log("code BPScompass!");
        window.open("https://balwynps-vic.compass.education/login.aspx?sessionstate=disabled",'_blank');        
        document.getElementById("input").value = "";
    } else if (promoCode == "BHScompass") {
        console.log("code BHScompass!");
        window.open("https://balwynhs-vic.compass.education/login.aspx?sessionstate=disabled",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Gimkit") {
        console.log("code Gimkit!");
        window.open("https://gimkit.com", '_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "GimkitCode") {
        console.log("code GimkitCode!");
        window.open("https://www.gimkit.com/join",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Blooket") {
        console.log("code Blooket!");
        window.open("https://www.blooket.com",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "BlooketCode") {
        console.log("code BlooketCode!");
        window.open("https://play.blooket.com/play",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "Kahoot") {
        console.log("code Kahoot!");
        window.open("https://kahoot.com",'_blank');
        document.getElementById("input").value = "";
    } else if (promoCode == "KahootCode") {
        console.log("code KahootCode!");
        window.open("https://kahoot.it",'_blank');
        document.getElementById("input").value = "";
    } else if(promoCode == "3D") {
        console.log("code 3D!");
        window.open("https://testserhere.github.io/3D_object.html", '_blank');
        document.getElementById("input").value = "";
    } else if(promoCode == "OpenApp") {
        console.log("code OpenApp!");
        window.open("https://testserhere.github.io/openApp/openApp.html", '_blank');
        document.getElementById("input").value = "";        
    } else if(promoCode == "Logo") {
        console.log("logo");
        window.open("https://www.hubspot.com/brand-kit-generator/final/7defe3cf-d527-459d-beab-7ffaf8824bb3?hubs_content=www.hubspot.com%2Fbrand-kit-generator%2Ficon-maker&hubs_content-cta=cta_form&company=TestserHere", '_blank');
        document.getElementById("input").value = "";
    } else if(promoCode == "Old Page") {
        console.log("code Old Page");
        window.open("/old-page.html");
        document.getElementById("input").value = "";
    } else if(promoCode == "Song Player") {
        console.log("code Song Player");
        window.open("/Song_player/index.html");
        document.getElementById("input").value = "";
    }
    
    
    else if(promoCode == "ALLCODES") {
        console.log ("code allcode!");
        window.open("https://testserhere.github.io/codes.html", '_blank');
        document.getElementById("input").value = "";
    } 
    
    
     
    
    
    
    else {
        document.getElementById("wrongCode").style.visibility = "visible";
        setTimeout(function () {
            document.getElementById("wrongCode").style.visibility = "hidden";           
        },1000)
        document.getElementById("input").value = "";
    } 

}
