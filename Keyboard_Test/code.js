function keyUpdate() {
    document.addEventListener("keydown", (e) => {
        console.log(e.key, e.code);

        let id = "keyboard_" + e.key.toLowerCase()

        if (e.key == "Backspace") {
            id = "keyboard_Backspace";
        } else if (e.code == "CapsLock") {
            id = "keyboard_Caps";
        } else if (e.code == "LeftShift") {
            id = "keyboard_Shift1";
        } else if (e.code == "RightShift") {
            id = "keyboard_Shift2";
        }



        document.getElementById(id).style.color = "black";
    })

    document.addEventListener("keyup", (e) => {
        console.log(e.key, e.code);

        let id = "keyboard_" + e.key.toLowerCase()

        if (e.key == "Backspace") {
            id = "keyboard_Backspace"
        } else if (e.code == "CapsLock") {
            id = "keyboard_Caps";
        }


        document.getElementById(id).style.color = "white";
    })



}




window.onload = keyUpdate;