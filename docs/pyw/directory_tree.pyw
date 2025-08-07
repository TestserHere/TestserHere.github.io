import os
import tkinter as tk
from tkinter import ttk, filedialog

class DirectoryTreeApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Directory Tree Visualizer")
        self.geometry("600x400")
        self.configure(bg="#1e1e1e")

        self.tree = ttk.Treeview(self)
        self.tree.pack(fill=tk.BOTH, expand=True)

        self.menu = tk.Menu(self, tearoff=0)
        self.menu.add_command(label="Open Folder", command=self.open_folder)
        self.bind("<Button-1>", self.show_menu)

    def show_menu(self, event):
        self.menu.post(event.x_root, event.y_root)

    def open_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.tree.delete(*self.tree.get_children())
            self.insert_node('', folder)

    def insert_node(self, parent, path):
        node = self.tree.insert(parent, 'end', text=os.path.basename(path), open=True)
        if os.path.isdir(path):
            for item in os.listdir(path):
                full_path = os.path.join(path, item)
                self.insert_node(node, full_path)

if __name__ == "__main__":
    app = DirectoryTreeApp()
    app.mainloop()