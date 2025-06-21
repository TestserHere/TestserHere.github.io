# Import necessary modules
import tkinter as tk
from tkinter import ttk
import psutil
import threading
import time
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import pynput

# Set up a class for the real-time graphing application
class RealTimeMonitorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("📈 Real-Time Monitor")
        self.geometry("800x600")
        self.configure(bg="#0d1b2a")

        # Tabs for each graph
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill='both', expand=True)

        self.cpu_frame = self.create_tab("CPU Usage")
        self.typing_frame = self.create_tab("Typing Speed")
        self.net_frame = self.create_tab("Network Speed")

        # Initialize graphing
        self.cpu_data = []
        self.typing_data = []
        self.net_data = []

        self.start_time = time.time()
        self.last_keys = 0
        self.key_count = 0
        self.prev_sent = psutil.net_io_counters().bytes_sent
        self.prev_recv = psutil.net_io_counters().bytes_recv

        self.create_cpu_graph()
        self.create_typing_graph()
        self.create_net_graph()

        self.update_graphs()
        self.start_typing_listener()

    def create_tab(self, name):
        frame = tk.Frame(self.notebook, bg="#0d1b2a")
        self.notebook.add(frame, text=name)
        return frame

    def create_cpu_graph(self):
        self.cpu_fig, self.cpu_ax = plt.subplots()
        self.cpu_canvas = FigureCanvasTkAgg(self.cpu_fig, master=self.cpu_frame)
        self.cpu_canvas.get_tk_widget().pack(fill='both', expand=True)

    def create_typing_graph(self):
        self.typing_fig, self.typing_ax = plt.subplots()
        self.typing_canvas = FigureCanvasTkAgg(self.typing_fig, master=self.typing_frame)
        self.typing_canvas.get_tk_widget().pack(fill='both', expand=True)

    def create_net_graph(self):
        self.net_fig, self.net_ax = plt.subplots()
        self.net_canvas = FigureCanvasTkAgg(self.net_fig, master=self.net_frame)
        self.net_canvas.get_tk_widget().pack(fill='both', expand=True)

    def update_graphs(self):
        # Time axis
        elapsed = time.time() - self.start_time

        # CPU usage
        cpu = psutil.cpu_percent()
        self.cpu_data.append((elapsed, cpu))
        self.cpu_data = self.cpu_data[-60:]  # Keep last 60 seconds
        x_cpu, y_cpu = zip(*self.cpu_data)
        self.cpu_ax.clear()
        self.cpu_ax.plot(x_cpu, y_cpu, color='skyblue')
        self.cpu_ax.set_title("CPU Usage (%)")
        self.cpu_ax.set_ylim(0, 100)
        self.cpu_canvas.draw()

        # Typing WPM
        wpm = (self.key_count / 5) / (max(elapsed / 60, 1e-6))
        self.typing_data.append((elapsed, wpm))
        self.typing_data = self.typing_data[-60:]
        x_typ, y_typ = zip(*self.typing_data)
        self.typing_ax.clear()
        self.typing_ax.plot(x_typ, y_typ, color='lightgreen')
        self.typing_ax.set_title("Typing Speed (WPM)")
        self.typing_canvas.draw()

        # Network speed
        net = psutil.net_io_counters()
        sent_speed = (net.bytes_sent - self.prev_sent) / 1024
        recv_speed = (net.bytes_recv - self.prev_recv) / 1024
        self.prev_sent = net.bytes_sent
        self.prev_recv = net.bytes_recv
        self.net_data.append((elapsed, sent_speed, recv_speed))
        self.net_data = self.net_data[-60:]
        x_net, sent_vals, recv_vals = zip(*self.net_data)
        self.net_ax.clear()
        self.net_ax.plot(x_net, sent_vals, label="Upload KB/s", color='orange')
        self.net_ax.plot(x_net, recv_vals, label="Download KB/s", color='cyan')
        self.net_ax.set_title("Network Speed")
        self.net_ax.legend()
        self.net_canvas.draw()

        self.after(1000, self.update_graphs)

    def start_typing_listener(self):
        def on_press(key):
            self.key_count += 1
        listener = pynput.keyboard.Listener(on_press=on_press)
        listener.daemon = True
        listener.start()

# Run the app
RealTimeMonitorApp().mainloop()

