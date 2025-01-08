function keyUpdate() {
    document.addEventListener("keydown", (e) => {
        console.log(e.key, e.code);

        let id = "keyboard_" + e.key.toLowerCase()

        if (e.key == "Backspace") {
            id = "keyboard_Backspace";
        } else if (e.code == "CapsLock") {
            id = "keyboard_Caps";
        } else if (e.code == "Backslash") {
            id = "keyboard_backslash";
        } else if (e.code == "ShiftLeft") {
            id = "keyboard_Shift1";
        } else if (e.code == "ShiftRight") {
            id = "keyboard_Shift2";
        } else if (e.code == "ControlLeft") {
            id = "keyboard_Control1";
        } else if (e.code == "MetaLeft") {
            id = "keyboard_Option1";
        } else if (e.code == "AltLeft") {
            id = "keyboard_Command1";
        } else if (e.code == "Space") {
            id = "keyboard_Space"
        } else if (e.code == "AltRight") {
            id = "keyboard_Command2";
        } else if (e.code == "MetaRight") {
            id = "keyboard_Option2";
        } else if (e.code == "ControlRight") {
            id = "keyboard_Control2";
        } else if (e.code == "ArrowUp") {
            id = "keyboard_ArrowUp";
        } else if (e.code == "ArrowDown") {
            id = "keyboard_ArrowDown";
        } else if (e.code == "ArrowLeft") {
            id = "keyboard_ArrowLeft";
        } else if (e.code == "ArrowRight") {
            id = "keyboard_ArrowRight";
        }


        document.getElementById(id).style.color = "white";
        document.getElementById(id).style.backgroundColor = "black";
    })

    document.addEventListener("keyup", (e) => {
        console.log(e.key, e.code);

        let id = "keyboard_" + e.key.toLowerCase()

        if (e.key == "Backspace") {
            id = "keyboard_Backspace"
        } else if (e.code == "CapsLock") {
            id = "keyboard_Caps";
        } else if (e.code == "Backslash") {
            id = "keyboard_backslash";
        } else if (e.code == "ShiftLeft") {
            id = "keyboard_Shift1";
        } else if (e.code == "ShiftRight") {
            id = "keyboard_Shift2";
        } else if (e.code == "ControlLeft") {
            id = "keyboard_Control1";
        } else if (e.code == "MetaLeft") {
            id = "keyboard_Option1";
        } else if (e.code == "AltLeft") {
            id = "keyboard_Command1";
        } else if (e.code == "Space") {
            id = "keyboard_Space"
        } else if (e.code == "AltRight") {
            id = "keyboard_Command2"; 
        } else if (e.code == "MetaRight") {
            id = "keyboard_Option2";
        } else if (e.code == "ControlRight") {
            id = "keyboard_Control2";
        } else if (e.code == "ArrowUp") {
            id = "keyboard_ArrowUp";
        } else if (e.code == "ArrowDown") {
            id = "keyboard_ArrowDown";
        } else if (e.code == "ArrowLeft") {
            id = "keyboard_ArrowLeft";
        } else if (e.code == "ArrowRight") {
            id = "keyboard_ArrowRight";
        }




        document.getElementById(id).style.color = "black";
        document.getElementById(id).style.backgroundColor = "transparent";
    })



}




window.onload = keyUpdate;