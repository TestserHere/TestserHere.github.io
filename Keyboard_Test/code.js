function keyUpdate() {
    document.addEventListener("keyUp", (e) => {
        if (e.code == "ArrowUp") {
            alert("Test");
            document.getElementById("keyboard_1").style.color = "Black";
        } else {
            keyUpdate();
        }
        
    })
}