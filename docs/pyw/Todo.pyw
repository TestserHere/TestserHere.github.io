import tkinter as tk
from tkinter import messagebox, simpledialog
from datetime import datetime
import json
import os

TODO_FILE = "todos.json"
REMINDER_FILE = "reminders.json"

class DailyPlanner(tk.Tk):
    def __init__(self):
        super().__init__()
        self.overrideredirect(True)  # Frameless
        self.configure(bg="#0d1b2a")
        self.geometry("350x500")
        self.resizable(False, False)
        self.bind("<Escape>", lambda e: self.destroy())

        self.todos = []
        self.reminders = []
        self.timer_seconds = 0
        self.timer_running = False

        self.setup_ui()
        self.load_todos()
        self.load_reminders()
        self.check_reminders_loop()

        # Drag support
        self.bind("<ButtonPress-1>", self.start_move)
        self.bind("<B1-Motion>", self.do_move)

    def start_move(self, event):
        self._x = event.x
        self._y = event.y

    def do_move(self, event):
        x = self.winfo_pointerx() - self._x
        y = self.winfo_pointery() - self._y
        self.geometry(f"+{x}+{y}")

    def style_button(self, btn):
        btn.configure(
            bg="#1e90ff",
            fg="white",
            activebackground="#007acc",
            activeforeground="white",
            relief="flat",
            bd=0,
            padx=10,
            pady=5,
            font=("Helvetica", 10, "bold"),
            cursor="hand2"
        )

    def setup_ui(self):
        # Title
        tk.Label(self, text="🗓 Daily Planner", font=("Helvetica", 16, "bold"),
                 fg="white", bg="#0d1b2a").pack(pady=5)

        # Date
        date_str = datetime.now().strftime("%Y-%m-%d")
        tk.Label(self, text=f"📅 Date: {date_str}", font=("Helvetica", 12),
                 fg="lightblue", bg="#0d1b2a").pack()

        # To-Do Section
        tk.Label(self, text="✅ To-Dos:", font=("Helvetica", 13, "bold"),
                 fg="#1e90ff", bg="#0d1b2a").pack(pady=(10, 0))
        self.todo_frame = tk.Frame(self, bg="#0d1b2a")
        self.todo_frame.pack(pady=5)
        btn_task = tk.Button(self, text="+ Add New Task", command=self.add_task)
        self.style_button(btn_task)
        btn_task.pack()

        # Timer Section
        tk.Label(self, text="⏱ Timer:", font=("Helvetica", 13, "bold"),
                 fg="#1e90ff", bg="#0d1b2a").pack(pady=(15, 0))
        self.timer_label = tk.Label(self, text="00:00:00", font=("Helvetica", 20),
                                    fg="white", bg="#0d1b2a")
        self.timer_label.pack()
        btn_start = tk.Button(self, text="Start", command=self.start_timer)
        self.style_button(btn_start)
        btn_start.pack(pady=1)
        btn_stop = tk.Button(self, text="Stop", command=self.stop_timer)
        self.style_button(btn_stop)
        btn_stop.pack()

        # Reminders
        tk.Label(self, text="🔔 Reminders:", font=("Helvetica", 13, "bold"),
                 fg="#1e90ff", bg="#0d1b2a").pack(pady=(15, 0))
        self.reminder_frame = tk.Frame(self, bg="#0d1b2a")
        self.reminder_frame.pack()
        btn_reminder = tk.Button(self, text="+ Add Reminder", command=self.add_reminder)
        self.style_button(btn_reminder)
        btn_reminder.pack(pady=5)

    # ---------------- To-Dos ---------------- #
    def add_task(self):
        task = simpledialog.askstring("New Task", "What task do you want to add?")
        if task:
            self.todos.append({"task": task, "done": False})
            self.save_todos()
            self.refresh_todos()

    def toggle_task(self, index):
        self.todos[index]["done"] = not self.todos[index]["done"]
        self.save_todos()
        self.refresh_todos()

    def refresh_todos(self):
        for widget in self.todo_frame.winfo_children():
            widget.destroy()
        for i, todo in enumerate(self.todos):
            var = tk.BooleanVar(value=todo["done"])
            cb = tk.Checkbutton(self.todo_frame, text=todo["task"],
                                variable=var, command=lambda i=i: self.toggle_task(i),
                                fg="white", bg="#0d1b2a", selectcolor="#0d1b2a",
                                activebackground="#0d1b2a", activeforeground="white")
            cb.pack(anchor="w")

    def load_todos(self):
        if os.path.exists(TODO_FILE):
            with open(TODO_FILE, "r") as f:
                self.todos = json.load(f)
        self.refresh_todos()

    def save_todos(self):
        with open(TODO_FILE, "w") as f:
            json.dump(self.todos, f)

    # ---------------- Timer ---------------- #
    def start_timer(self):
        if not self.timer_running:
            try:
                input_str = simpledialog.askstring("Set Timer", "Enter time (HH:MM:SS, MM:SS or SS):")
                if not input_str:
                    return
                parts = list(map(int, input_str.strip().split(":")))
                if len(parts) == 3:
                    self.timer_seconds = parts[0]*3600 + parts[1]*60 + parts[2]
                elif len(parts) == 2:
                    self.timer_seconds = parts[0]*60 + parts[1]
                elif len(parts) == 1:
                    self.timer_seconds = parts[0]
                else:
                    raise ValueError
            except:
                messagebox.showerror("Error", "Invalid time format.")
                return
            self.timer_running = True
            self.countdown()

    def stop_timer(self):
        self.timer_running = False
        self.timer_label.config(text="00:00:00")

    def countdown(self):
        if self.timer_running and self.timer_seconds > 0:
            self.timer_label.config(text=self.format_time(self.timer_seconds))
            self.timer_seconds -= 1
            self.after(1000, self.countdown)
        elif self.timer_running:
            self.timer_label.config(text="DONE")
            messagebox.showinfo("Timer Done!", "Time's up!")
            self.timer_running = False

    def format_time(self, sec):
        h = sec // 3600
        m = (sec % 3600) // 60
        s = sec % 60
        return f"{h:02}:{m:02}:{s:02}"

    # ---------------- Reminders ---------------- #
    def add_reminder(self):
        time_str = simpledialog.askstring("Reminder Time", "Enter time (HH:MM):")
        msg = simpledialog.askstring("Reminder Message", "Enter message:")
        try:
            h, m = map(int, time_str.strip().split(":"))
            formatted = f"{h:02}:{m:02}"
            self.reminders.append({"time": formatted, "msg": msg})
            self.save_reminders()
            self.refresh_reminders()
        except:
            messagebox.showerror("Error", "Invalid time format.")

    def refresh_reminders(self):
        for widget in self.reminder_frame.winfo_children():
            widget.destroy()
        for reminder in self.reminders:
            lbl = tk.Label(self.reminder_frame,
                           text=f"{reminder['time']} – {reminder['msg']}",
                           fg="white", bg="#0d1b2a", anchor="w", justify="left")
            lbl.pack(anchor="w")

    def check_reminders_loop(self):
        now = datetime.now().strftime("%H:%M")
        for r in self.reminders[:]:
            if r["time"] == now:
                messagebox.showinfo("🔔 Reminder", r["msg"])
                self.reminders.remove(r)
                self.save_reminders()
                self.refresh_reminders()
        self.after(60 * 1000, self.check_reminders_loop)

    def save_reminders(self):
        with open(REMINDER_FILE, "w") as f:
            json.dump(self.reminders, f)

    def load_reminders(self):
        if os.path.exists(REMINDER_FILE):
            with open(REMINDER_FILE, "r") as f:
                self.reminders = json.load(f)
        self.refresh_reminders()

if __name__ == "__main__":
    DailyPlanner().mainloop()
