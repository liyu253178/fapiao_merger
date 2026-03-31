Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
objShell.Run "cmd /c node.exe server-entry.js", 0, False
WScript.Sleep 1000
objShell.Run "http://localhost:9988"