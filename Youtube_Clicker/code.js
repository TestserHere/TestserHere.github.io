window.onload = function() {
    console.log("onload");
    document.getElementById("button").addEventListener("click", function() {
        console.log("Clicked");
        document.getElementById("1Point").style.visibility = "visible";
        let clone = Object.create(Object.getPrototypeOf("1Point"), Object.getOwnPropertyDescriptors("1Point"));
        document.getElementById("clone").style.visibility = "visible";
        document.getElementById("1Point").style.visibility = "hidden"
    })

}

