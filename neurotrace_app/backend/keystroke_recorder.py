import ctypes
import ctypes.wintypes
import time
import json
import sys
import threading
from collections import defaultdict

# Windows API constants
WH_KEYBOARD_LL = 13
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

class KBDLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("vkCode", ctypes.wintypes.DWORD),
        ("scanCode", ctypes.wintypes.DWORD),
        ("flags", ctypes.wintypes.DWORD),
        ("time", ctypes.wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(ctypes.wintypes.ULONG)),
    ]

# Global variables for tracking
events = []
key_states = {} # vkCode -> press_timestamp_ns
last_release_ns = None # for flight time

# Low-level hook callback
def hook_callback(nCode, wParam, lParam):
    global last_release_ns
    
    if nCode >= 0:
        struct = ctypes.cast(lParam, ctypes.POINTER(KBDLLHOOKSTRUCT)).contents
        vk_code = struct.vkCode
        timestamp_ns = time.perf_counter_ns()
        
        # Check if it's a key down or up
        is_down = wParam in (WM_KEYDOWN, WM_SYSKEYDOWN)
        is_up = wParam in (WM_KEYUP, WM_SYSKEYUP)
        
        if is_down:
            # If key wasn't already down (ignore repeats)
            if vk_code not in key_states:
                key_states[vk_code] = timestamp_ns
                # Flight time: distance between last release and this press
                flight_time = (timestamp_ns - last_release_ns) / 1_000_000 if last_release_ns else 0
                
                events.append({
                    "event": "down",
                    "vk": vk_code,
                    "t_ns": timestamp_ns,
                    "flight_time_ms": flight_time
                })
                # Log to stdout for real-time feedback (optional)
                # print(json.dumps({"e": "d", "k": vk_code, "t": timestamp_ns}), flush=True)

        elif is_up:
            if vk_code in key_states:
                press_time = key_states.pop(vk_code)
                hold_time = (timestamp_ns - press_time) / 1_000_000
                last_release_ns = timestamp_ns
                
                events.append({
                    "event": "up",
                    "vk": vk_code,
                    "t_ns": timestamp_ns,
                    "hold_time_ms": hold_time
                })
                # print(json.dumps({"e": "u", "k": vk_code, "t": timestamp_ns}), flush=True)

    return user32.CallNextHookEx(None, nCode, wParam, lParam)

# Pointer to the hook function
CMPFUNC = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_int, ctypes.wintypes.WPARAM, ctypes.wintypes.LPARAM)
pointer = CMPFUNC(hook_callback)

def run_hook():
    hook = user32.SetWindowsHookExW(WH_KEYBOARD_LL, pointer, kernel32.GetModuleHandleW(None), 0)
    if not hook:
        print("Failed to set hook!", file=sys.stderr)
        return

    # Message loop to keep the hook alive
    msg = ctypes.wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))

    user32.UnhookWindowsHookEx(hook)

if __name__ == "__main__":
    # Start the hook in a separate thread
    hook_thread = threading.Thread(target=run_hook, daemon=True)
    hook_thread.start()
    
    # Listen for commands from parent process
    # "START" starts recording (clears events)
    # "STOP" stops recording and prints JSON summary
    # "QUIT" exits
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            cmd = line.strip().upper()
            if cmd == "START":
                events = []
                key_states = {}
                last_release_ns = None
                print(json.dumps({"status": "recording_started"}), flush=True)
            elif cmd == "STOP":
                # Finalize and output
                print(json.dumps({"status": "recording_stopped", "data": events}), flush=True)
                events = []
            elif cmd == "QUIT":
                break
    except KeyboardInterrupt:
        pass
