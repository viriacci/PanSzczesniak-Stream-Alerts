using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Pssa.Setup;
internal static class UpdateCleanup
{
    // Only a versioned installer inside the updater's own temporary directory.
    // Never delete a manually downloaded installer or follow a junction.
    internal static void Schedule()
    {
        var exe=Environment.ProcessPath;
        if(string.IsNullOrEmpty(exe))return;
        var path=Path.GetFullPath(exe);
        var folder=Path.GetDirectoryName(path);
        if(folder==null||!Regex.IsMatch(Path.GetFileName(folder),@"^PSSA-update-[A-Za-z0-9]{6}$")||
            !Regex.IsMatch(Path.GetFileName(path),@"^PSSA-Setup-\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?-x64\.exe$"))return;
        if(!string.Equals(Path.GetDirectoryName(folder),Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath())),StringComparison.OrdinalIgnoreCase))return;
        if(File.GetAttributes(folder).HasFlag(FileAttributes.ReparsePoint)||File.GetAttributes(path).HasFlag(FileAttributes.ReparsePoint))return;
        string Q(string v)=>"'"+v.Replace("'","''")+"'";
        var script="$ErrorActionPreference='Stop'; $file="+Q(path)+"; $dir="+Q(folder)+"; "+
            "try { Wait-Process -Id "+Environment.ProcessId+" -Timeout 120 -ErrorAction SilentlyContinue } catch {} ; "+
            "for($i=0;$i -lt 30;$i++){ try { "+
            "if(-not [IO.Directory]::Exists($dir)){break}; if(([IO.File]::GetAttributes($dir) -band [IO.FileAttributes]::ReparsePoint) -ne 0){break}; "+
            "if([IO.File]::Exists($file)){if(([IO.File]::GetAttributes($file) -band [IO.FileAttributes]::ReparsePoint) -ne 0){break}; [IO.File]::Delete($file)}; "+
            "if([IO.Directory]::Exists($dir) -and [IO.Directory]::GetFileSystemEntries($dir).Length -eq 0){[IO.Directory]::Delete($dir,$false)}; break "+
            "} catch { Start-Sleep -Seconds 1 } }";
        var ps=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe");
        var start=new ProcessStartInfo(ps){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};
        start.ArgumentList.Add("-NoProfile");start.ArgumentList.Add("-NonInteractive");
        start.ArgumentList.Add("-EncodedCommand");start.ArgumentList.Add(Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
        using var child=Process.Start(start);
    }
}
