import tkinter as tk
from tkinter import filedialog, messagebox
import os
import threading
import fnmatch
import subprocess
import platform
import ctypes

class FileSearchTool(tk.Tk):
    def __init__(self):
        super().__init__()

        # Make sure it shows in Alt+Tab even when borderless (Windows only)
        if platform.system() == "Windows":
            self.after(10, self.set_alt_tab_visible)

        # Make it frameless
        self.overrideredirect(True)
        self.geometry("600x400")
        self.configure(bg="#0d1b2a")
        self.bind("<Escape>", lambda e: self.destroy())
        self.bind("<ButtonPress-1>", self.start_move)
        self.bind("<B1-Motion>", self.do_move)

        self.search_path = ""
        self.results = []

        self.build_ui()

    def set_alt_tab_visible(self):
        HWND = ctypes.windll.user32.GetParent(self.winfo_id())
        GWL_EXSTYLE = -20
        WS_EX_TOOLWINDOW = 0x00000080
        WS_EX_APPWINDOW = 0x00040000

        style = ctypes.windll.user32.GetWindowLongW(HWND, GWL_EXSTYLE)
        style = style & ~WS_EX_TOOLWINDOW | WS_EX_APPWINDOW
        ctypes.windll.user32.SetWindowLongW(HWND, GWL_EXSTYLE, style)

        # Re-show window to update style
        self.withdraw()
        self.after(10, self.deiconify)

    def start_move(self, event):
        self._x = event.x
        self._y = event.y

    def do_move(self, event):
        x = self.winfo_pointerx() - self._x
        y = self.winfo_pointery() - self._y
        self.geometry(f"+{x}+{y}")

    def build_ui(self):
        tk.Label(self, text="🔍 File Search Tool", bg="#0d1b2a", fg="white",
                 font=("Helvetica", 16, "bold")).pack(pady=5)

        self.dir_label = tk.Label(self, text="📁 No folder selected", fg="lightgray", bg="#0d1b2a", wraplength=580)
        self.dir_label.pack(pady=(5, 2))

        browse_btn = tk.Button(self, text="Choose Folder", command=self.choose_folder)
        self.style_button(browse_btn)
        browse_btn.pack(pady=2)

        self.pattern_entry = tk.Entry(self, font=("Helvetica", 12))
        self.pattern_entry.insert(0, "*.txt")
        self.pattern_entry.pack(pady=10, padx=20, fill="x")

        search_btn = tk.Button(self, text="Search", command=self.start_search)
        self.style_button(search_btn)
        search_btn.pack(pady=5)

        self.results_frame = tk.Frame(self, bg="#0d1b2a")
        self.results_frame.pack(pady=10, fill="both", expand=True)

        self.scrollbar = tk.Scrollbar(self.results_frame)
        self.scrollbar.pack(side="right", fill="y")

        self.result_list = tk.Listbox(self.results_frame, yscrollcommand=self.scrollbar.set,
                                      font=("Courier", 10), bg="#1e2a38", fg="white", selectbackground="#007acc")
        self.result_list.pack(fill="both", expand=True, padx=5, pady=5)
        self.scrollbar.config(command=self.result_list.yview)

        self.result_list.bind("<Double-Button-1>", self.open_file)

    def style_button(self, btn):
        btn.configure(
            bg="#1e90ff", fg="white",
            activebackground="#007acc",
            activeforeground="white",
            font=("Helvetica", 10, "bold"),
            relief="flat", padx=10, pady=5,
            cursor="hand2"
        )

    def choose_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.search_path = folder
            self.dir_label.config(text=f"📁 {folder}")

    def start_search(self):
        if not self.search_path:
            messagebox.showwarning("No folder", "Please choose a folder first.")
            return

        pattern = self.pattern_entry.get().strip()
        if not pattern:
            messagebox.showwarning("No pattern", "Enter a file name or pattern (e.g., *.txt).")
            return

        self.result_list.delete(0, tk.END)
        threading.Thread(target=self.search_files, args=(pattern,), daemon=True).start()

    def search_files(self, pattern):
        for root, _, files in os.walk(self.search_path):
            for filename in fnmatch.filter(files, pattern):
                full_path = os.path.join(root, filename)
                self.results.append(full_path)
                self.result_list.insert(tk.END, full_path)

    def open_file(self, event):
        selection = self.result_list.curselection()
        if selection:
            path = self.result_list.get(selection[0])
            try:
                if platform.system() == "Windows":
                    os.startfile(path)
                elif platform.system() == "Darwin":
                    subprocess.run(["open", path])
                else:
                    subprocess.run(["xdg-open", path])
            except Exception as e:
                messagebox.showerror("Error", f"Could not open file: {e}")

if __name__ == "__main__":
    FileSearchTool().mainloop()
