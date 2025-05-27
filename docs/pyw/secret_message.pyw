import tkinter as tk
from tkinter import ttk
from tkinter import messagebox

def caesar_cipher(text, shift, mode):
    result = ""
    shift = int(shift)
    if mode == "Decode":
        shift = -shift
    for char in text:
        if char.isalpha():
            offset = ord('A') if char.isupper() else ord('a')
            result += chr((ord(char) - offset + shift) % 26 + offset)
        else:
            result += char
    return result

def process_text():
    text = input_text.get("1.0", tk.END).strip()
    shift = shift_entry.get()
    mode = mode_var.get()
    if not shift.isdigit():
        messagebox.showerror("Error", "Shift must be a number.")
        return
    result = caesar_cipher(text, int(shift), mode)
    output_text.config(state="normal")
    output_text.delete("1.0", tk.END)
    output_text.insert(tk.END, result)
    output_text.config(state="disabled")

def copy_result():
    result = output_text.get("1.0", tk.END).strip()
    if result:
        root.clipboard_clear()
        root.clipboard_append(result)
        messagebox.showinfo("Copied", "Result copied to clipboard!")

# GUI Setup
root = tk.Tk()
root.title("🔐 Caesar Cipher Tool")
root.geometry("400x400")
root.resizable(False, False)

tk.Label(root, text="Enter Message:").pack(pady=5)
input_text = tk.Text(root, height=4, width=40)
input_text.pack()

tk.Label(root, text="Shift:").pack(pady=5)
shift_entry = tk.Entry(root)
shift_entry.pack()

mode_var = tk.StringVar(value="Encode")
ttk.Radiobutton(root, text="Encode", variable=mode_var, value="Encode").pack()
ttk.Radiobutton(root, text="Decode", variable=mode_var, value="Decode").pack()

ttk.Button(root, text="Process", command=process_text).pack(pady=10)

tk.Label(root, text="Result:").pack()
output_text = tk.Text(root, height=4, width=40, state="disabled")
output_text.pack()

ttk.Button(root, text="📋 Copy Result", command=copy_result).pack(pady=10)

root.mainloop()
