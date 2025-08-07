import tkinter as tk
import time

class StopwatchApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ViVi Stopwatch")
        self.geometry("280x80")
        self.overrideredirect(True)
        self.configure(bg="#0d1b2a")
        self.wm_attributes("-topmost", True)

        self.canvas = tk.Canvas(self, width=280, height=80, bg="#0d1b2a", highlightthickness=0)
        self.canvas.pack()

        self.time_label = self.canvas.create_text(140, 40, text="00:00:00", fill="white", font=("Helvetica", 32, "bold"))

        # Dragging support
        self.bind("<ButtonPress-1>", self.start_move)
        self.bind("<B1-Motion>", self.do_move)

        # Right-click opens control panel
        self.bind("<Button-3>", self.show_controls)

        # Esc to close
        self.bind("<Escape>", lambda e: self.destroy())

        # Stopwatch variables
        self.running = False
        self.start_time = None
        self.elapsed = 0

        self.update_time()

    def format_time(self, seconds):
        h = int(seconds) // 3600
        m = (int(seconds) % 3600) // 60
        s = int(seconds) % 60
        return f"{h:02}:{m:02}:{s:02}"

    def update_time(self):
        if self.running:
            current_time = time.time()
            total = self.elapsed + (current_time - self.start_time)
            self.canvas.itemconfig(self.time_label, text=self.format_time(total))
        else:
            self.canvas.itemconfig(self.time_label, text=self.format_time(self.elapsed))
        self.after(100, self.update_time)

    def start(self):
        if not self.running:
            self.start_time = time.time()
            self.running = True

    def stop(self):
        if self.running:
            self.elapsed += time.time() - self.start_time
            self.running = False

    def reset(self):
        self.running = False
        self.start_time = None
        self.elapsed = 0

    def show_controls(self, event=None):
        if hasattr(self, 'control_window') and self.control_window.winfo_exists():
            return  # Don't open more than one

        self.control_window = tk.Toplevel(self)
        self.control_window.title("Controls")
        self.control_window.geometry("+{}+{}".format(self.winfo_rootx() + 290, self.winfo_rooty()))
        self.control_window.attributes("-topmost", True)
        self.control_window.resizable(False, False)

        tk.Button(self.control_window, text="Start", width=10, command=self.start).pack(pady=2)
        tk.Button(self.control_window, text="Stop", width=10, command=self.stop).pack(pady=2)
        tk.Button(self.control_window, text="Reset", width=10, command=self.reset).pack(pady=2)

    def start_move(self, event):
        self._x = event.x
        self._y = event.y

    def do_move(self, event):
        x = self.winfo_pointerx() - self._x
        y = self.winfo_pointery() - self._y
        self.geometry(f"+{x}+{y}")

if __name__ == "__main__":
    app = StopwatchApp()
    app.mainloop()
