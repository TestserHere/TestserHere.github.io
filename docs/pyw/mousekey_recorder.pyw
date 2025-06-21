import time
import threading
from pynput.mouse import Listener as MouseListener, Controller as MouseController, Button
from pynput.keyboard import Listener as KeyboardListener, Key

actions = []
recording = False
start_time = None

def on_click(x, y, button, pressed):
    if recording:
        now = time.time()
        actions.append((now, 'mouse', x, y, button.name, pressed))

def on_press(key):
    global recording, start_time
    if key == Key.f9:
        if not recording:
            actions.clear()
            start_time = time.time()
        recording = not recording
        print("Recording started." if recording else "Recording stopped.")
        if not recording:
            save_macro()
    elif key == Key.f10:
        threading.Thread(target=play_macro).start()
    elif key == Key.esc:
        return False  # Exit keyboard listener

def save_macro():
    with open("macro.txt", "w") as f:
        for action in actions:
            delay = action[0] - start_time
            f.write(f"{delay},{action[1]},{action[2]},{action[3]},{action[4]},{action[5]}\n")

def play_macro():
    mouse = MouseController()
    try:
        with open("macro.txt", "r") as f:
            last_delay = 0
            for line in f:
                parts = line.strip().split(',')
                if len(parts) != 6:
                    continue  # Skip malformed lines
                delay, _, x, y, btn, pressed = parts
                delay = float(delay)
                x, y = int(x), int(y)
                time.sleep(delay - last_delay)
                last_delay = delay
                button = Button.left if btn == 'left' else Button.right
                mouse.position = (x, y)
                if pressed == 'True':
                    mouse.press(button)
                else:
                    mouse.release(button)
    except Exception as e:
        print(f"Error playing macro: {e}")

print("🎬 Press F9 to start/stop recording, F10 to play, ESC to quit.")
with MouseListener(on_click=on_click) as mouse_listener, KeyboardListener(on_press=on_press) as keyboard_listener:
    mouse_listener.join()
    keyboard_listener.join()
