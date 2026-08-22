# Unvibe Desktop Bridge

The reliable selected-code flow in VS Code and Cursor is provided by the **Unvibe Desktop Bridge** extension.

1. Install `Unvibe Desktop Bridge.vsix` from the Unvibe DMG (double-click it, or use VS Code/Cursor’s **Extensions: Install from VSIX…** command).
2. Keep the Unvibe desktop app open once.
3. Select code in VS Code or Cursor and press **⌘U**.

The extension reads the active editor selection directly, copies it only on the local machine, and opens `unvibe://review?source=ide`. No source code is placed in the URL. Unvibe applies its local secret filter before any review request.

The desktop app reserves **⌥⌘U** as an optional cross-app fallback. It exists for editors without the bridge, but macOS Accessibility cannot provide the same reliability as the editor-native command.
