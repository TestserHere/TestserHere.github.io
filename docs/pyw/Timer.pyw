import time
import tkinter as tk
from tkinter import simpledialog, messagebox
import time
import threading
from plyer import notification
import winsound

class FloatingTimer(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Floating Timer")
        self.geometry("280x80")
        self.configure(bg="#0d1b2a")
        self.overrideredirect(True)
        self.attributes("-topmost", True)

        # Position for dragging
        self.offset_x = 0
        self.offset_y = 0

        # Store original dimensions
        self.original_geometry = "280x80"
        self.is_fullscreen = False
        self.original_font = ("Helvetica", 24, "bold")
        self.fullscreen_font = ("Helvetica", 48, "bold")

        # Canvas setup
        self.canvas = tk.Canvas(self, width=280, height=80, highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)
        self.canvas.configure(bg="#0d1b2a")

        # Progress bar
        self.progress_rect = self.canvas.create_rectangle(0, 0, 0, 80, fill="#1e90ff", width=0)

        # Time label
        self.time_label = self.canvas.create_text(140, 40, text="00:00:00", font=self.original_font, fill="white")

        # Bindings
        self.canvas.bind("<Button-1>", self.start_move)
        self.canvas.bind("<B1-Motion>", self.do_move)
        self.canvas.bind("<Button-3>", self.set_time_prompt)
        self.canvas.bind("<Double-Button-1>", self.toggle_fullscreen)  # Double-click to toggle fullscreen
        self.bind("<Button-2>", lambda e: self.destroy())  # Middle-click to close
        self.bind("<Escape>", lambda e: self.destroy())    # Esc key to close

        self.remaining = 0
        self.total_time = 0
        self.running = False

    def start_move(self, event):
        self.offset_x = event.x
        self.offset_y = event.y

    def do_move(self, event):
        if not self.is_fullscreen:  # Only allow dragging when not in fullscreen
            x = event.x_root - self.offset_x
            y = event.y_root - self.offset_y
            self.geometry(f'+{x}+{y}')

    def toggle_fullscreen(self, event=None):
        if self.is_fullscreen:
            # Exit fullscreen
            self.attributes("-fullscreen", False)
            self.overrideredirect(True)
            self.geometry(self.original_geometry)
            self.canvas.config(width=280, height=80)
            self.canvas.coords(self.time_label, 140, 40)
            self.canvas.itemconfig(self.time_label, font=self.original_font)
            self.is_fullscreen = False
        else:
            # Enter fullscreen
            self.overrideredirect(False)
            self.attributes("-fullscreen", True)
            screen_width = self.winfo_screenwidth()
            screen_height = self.winfo_screenheight()
            self.canvas.config(width=screen_width, height=screen_height)
            self.canvas.coords(self.time_label, screen_width/2, screen_height/2)
            self.canvas.itemconfig(self.time_label, font=self.fullscreen_font)
            self.is_fullscreen = True

        # Update progress bar to match new canvas size
        progress = (self.total_time - self.remaining) / self.total_time if self.total_time > 0 else 0
        bar_width = int(self.canvas.winfo_width() * progress)
        self.canvas.coords(self.progress_rect, 0, 0, bar_width, self.canvas.winfo_height())

    def parse_time(self, time_str):
        """Parses input like HH:MM:SS, MM:SS, or SS"""
        parts = list(map(int, time_str.strip().split(":")))
        if len(parts) == 1:
            return parts[0]
        elif len(parts) == 2:
            minutes, seconds = parts
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = parts
            return hours * 3600 + minutes * 60 + seconds
        else:
            raise ValueError("Invalid time format")

    def set_time_prompt(self, event=None):
        user_input = simpledialog.askstring("Set Timer", "Enter time (HH:MM:SS or MM:SS or SS):")
        if user_input:
            try:
                seconds = self.parse_time(user_input)
                self.start_timer(seconds)
            except Exception as e:
                messagebox.showerror("Invalid Input", "Please enter a valid time format.\nExamples: 30, 1:30, 0:05:00")

    def start_timer(self, seconds):
        self.remaining = seconds
        self.total_time = seconds
        if not self.running:
            threading.Thread(target=self.countdown, daemon=True).start()

    def format_time(self, total_seconds):
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02}:{minutes:02}:{seconds:02}"

    def notify_done(self):
        try:
            notification.notify(
                title="Timer Done",
                message="Time's up!",
                timeout=5
            )
        except Exception as e:
            print("Notification failed:", e)

    def countdown(self):
        self.running = True
        while self.remaining > 0:
            # Update display
            time_str = self.format_time(self.remaining)
            self.canvas.itemconfig(self.time_label, text=time_str)

            # Update background and progress bar
            if self.remaining <= 5:
                self.canvas.configure(bg="#f5ad42")  # Orange
                self.canvas.itemconfig(self.progress_rect, fill="#FFD700")
            else:
                self.canvas.configure(bg="#0d1b2a")  # Blue
                self.canvas.itemconfig(self.progress_rect, fill="#1e90ff")

            progress = (self.total_time - self.remaining) / self.total_time
            bar_width = int(self.canvas.winfo_width() * progress)
            self.canvas.coords(self.progress_rect, 0, 0, bar_width, self.canvas.winfo_height())

            time.sleep(1)
            self.remaining -= 1

        # Timer done
        self.canvas.itemconfig(self.time_label, text="DONE")
        self.canvas.configure(bg="#0d1b2a")
        self.canvas.itemconfig(self.progress_rect, fill="#1e90ff")
        self.canvas.coords(self.progress_rect, 0, 0, self.canvas.winfo_width(), self.canvas.winfo_height())
        self.notify_done()
        time.sleep(2) 
        winsound.PlaySound("alert.wav", winsound.SND_FILENAME | winsound.SND_ASYNC)
        self.running = False

if __name__ == "__main__":
    app = FloatingTimer()
    app.mainloop()