import { Key, keyboard } from "@nut-tree-fork/nut-js";
/** Lowercase key name -> nut.js Key enum, covering common cross-platform key combos. */
const KEY_NAME_MAP = {
    ctrl: Key.LeftControl,
    control: Key.LeftControl,
    lctrl: Key.LeftControl,
    rctrl: Key.RightControl,
    alt: Key.LeftAlt,
    lalt: Key.LeftAlt,
    ralt: Key.RightAlt,
    shift: Key.LeftShift,
    lshift: Key.LeftShift,
    rshift: Key.RightShift,
    cmd: Key.LeftSuper,
    command: Key.LeftSuper,
    meta: Key.LeftSuper,
    super: Key.LeftSuper,
    win: Key.LeftSuper,
    windows: Key.LeftSuper,
    tab: Key.Tab,
    enter: Key.Return,
    return: Key.Return,
    esc: Key.Escape,
    escape: Key.Escape,
    space: Key.Space,
    spacebar: Key.Space,
    backspace: Key.Backspace,
    delete: Key.Delete,
    del: Key.Delete,
    insert: Key.Insert,
    ins: Key.Insert,
    home: Key.Home,
    end: Key.End,
    pageup: Key.PageUp,
    pgup: Key.PageUp,
    pagedown: Key.PageDown,
    pgdn: Key.PageDown,
    up: Key.Up,
    down: Key.Down,
    left: Key.Left,
    right: Key.Right,
    capslock: Key.CapsLock,
    numlock: Key.NumLock,
    scrolllock: Key.ScrollLock,
    print: Key.Print,
    printscreen: Key.Print,
    pause: Key.Pause,
    menu: Key.Menu,
    "-": Key.Minus,
    "=": Key.Equal,
    "[": Key.LeftBracket,
    "]": Key.RightBracket,
    "\\": Key.Backslash,
    ";": Key.Semicolon,
    "'": Key.Quote,
    ",": Key.Comma,
    ".": Key.Period,
    "/": Key.Slash,
    "`": Key.Grave,
};
for (let i = 1; i <= 24; i++) {
    KEY_NAME_MAP[`f${i}`] = Key[`F${i}`];
}
for (let d = 0; d <= 9; d++) {
    KEY_NAME_MAP[`${d}`] = Key[`Num${d}`];
}
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    KEY_NAME_MAP[letter] = Key[letter.toUpperCase()];
}
function resolveKey(name) {
    const key = KEY_NAME_MAP[name.toLowerCase()];
    if (key === undefined) {
        throw new Error(`Unsupported key name: "${name}"`);
    }
    return key;
}
/**
 * Real cross-platform implementation backed by @nut-tree-fork/nut-js
 * (Windows, macOS, Linux/X11 native keyboard driver).
 */
export class NutjsKeyboardService {
    async typeText(input) {
        await keyboard.type(input.text);
        return {
            success: true,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
    async keyPress(input) {
        const keys = input.keys.map(resolveKey);
        await keyboard.pressKey(...keys);
        await keyboard.releaseKey(...[...keys].reverse());
        return {
            success: true,
            backend: "nutjs",
            timestamp: new Date().toISOString(),
        };
    }
}
