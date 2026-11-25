using Microsoft.Win32;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;

namespace Pssa.Setup;
internal record Installed(string Folder, string Uninstaller, bool Machine, string Version)
{
    public string Exe => Path.Combine(Folder,"PSSA 2 Dev.exe");
}
internal static class InstallEngine
{
    private const string GuidKey = "1d52d779-24b9-566f-8b55-c659c5b0b6e2";
    internal static void Trace(string text){try{File.AppendAllText(Path.Combine(Path.GetTempPath(),"PSSA-setup-error.log"),DateTime.Now.ToString("s")+" "+text+Environment.NewLine);}catch{}}
    public static Installed? Detect()
    {
        foreach(var machine in new[]{false,true})
        foreach(var view in new[]{RegistryView.Registry64,RegistryView.Registry32})
        {
            using var root=RegistryKey.OpenBaseKey(machine?RegistryHive.LocalMachine:RegistryHive.CurrentUser,view);
            using var key=root.OpenSubKey(@"Software\"+GuidKey);
            using var uninstall=root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\"+GuidKey);
            var dir=key?.GetValue("InstallLocation") as string ?? uninstall?.GetValue("InstallLocation") as string;
            if(string.IsNullOrWhiteSpace(dir)) continue;
            dir=Path.GetFullPath(dir.Trim('"')).TrimEnd('\\');
            var exe=Path.Combine(dir,"PSSA 2 Dev.exe");
            var un=new[]{"Uninstall PSSA.exe","Uninstall PSSA 2 Dev.exe"}.Select(n=>Path.Combine(dir,n)).FirstOrDefault(File.Exists);
            if(File.Exists(exe)&&un!=null) return new(dir,un,machine,uninstall?.GetValue("DisplayVersion") as string??"nieznana");
            Trace("Registered folder found, executable="+File.Exists(exe)+", uninstaller="+(un!=null));
        }
        return null;
    }
    public static string DefaultFolder => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","PSSA 2 Dev");
    private static bool Inside(string path,string root)=>path.Equals(root,StringComparison.OrdinalIgnoreCase)||path.StartsWith(root.TrimEnd('\\')+"\\",StringComparison.OrdinalIgnoreCase);
    public static string ValidateFolder(string value, Installed? old)
    {
        if(string.IsNullOrWhiteSpace(value)||value.Contains('"')||value.Any(char.IsControl)||!Path.IsPathFullyQualified(value)||value.StartsWith(@"\\"))
            throw new InvalidOperationException("Wybierz pełną ścieżkę na lokalnym dysku.");
        var dir=Path.GetFullPath(value).TrimEnd('\\');
        if(dir.Length<=3) throw new InvalidOperationException("Nie można instalować w katalogu głównym dysku.");
        if(old!=null){
            if(!string.Equals(dir,old.Folder.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Aktualizacja musi zachować istniejący katalog.");
            return dir;
        }
        var data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"PSSA 2 Dev");
        if(Inside(dir,data)||Inside(data,dir)||Inside(dir,Environment.GetFolderPath(Environment.SpecialFolder.Windows))||Inside(dir,Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles))||Inside(dir,Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)))
            throw new InvalidOperationException("Wybierz osobny katalog programu poza folderami systemowymi i danymi.");
        if(File.Exists(dir)||Directory.Exists(dir)&&Directory.EnumerateFileSystemEntries(dir).Any())
            throw new InvalidOperationException("Nowa instalacja wymaga pustego lub nieistniejącego katalogu.");
        for(var p=dir;!string.IsNullOrEmpty(p);p=Path.GetDirectoryName(p)){
            if(Directory.Exists(p)&&File.GetAttributes(p).HasFlag(FileAttributes.ReparsePoint))throw new InvalidOperationException("Wybierz katalog bez dowiązań i przekierowań.");
        }
        return dir;
    }
    private static void CheckRunning()
    {
        foreach(var p in Process.GetProcessesByName("PSSA 2 Dev"))
        using(p) { if(!p.HasExited) throw new InvalidOperationException("Zakończ PSSA oraz niezależny Agent przed instalacją lub dezinstalacją."); }
    }
    private static async Task Run(string exe,string args,bool machine)
    {
        var info=new ProcessStartInfo(exe,args){UseShellExecute=machine,WorkingDirectory=Path.GetDirectoryName(exe)!};
        if(machine)info.Verb="runas";else info.CreateNoWindow=true;
        Trace("Launching "+Path.GetFileName(exe));
        using var p=Process.Start(info)??throw new InvalidOperationException("Nie można uruchomić silnika instalacji.");
        await p.WaitForExitAsync();
        Trace("Engine exit "+p.ExitCode);
        if(p.ExitCode!=0)throw new InvalidOperationException("Silnik instalacji zwrócił kod "+p.ExitCode+".");
    }
    public static async Task<Installed> Install(string value,bool desktop,bool start,Action<string>? status=null)
    {
        Trace("Install requested"); CheckRunning(); var old=Detect(); Trace("Existing installation detected: "+(old!=null)); var dir=ValidateFolder(value,old);
        var temp=Path.Combine(Path.GetTempPath(),"PSSA-Setup-"+System.Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        try{
            Trace("Extracting embedded payload"); status?.Invoke("Weryfikacja pakietu instalacyjnego…");
            var exe=Path.Combine(temp,"payload.exe");
            var a=Assembly.GetExecutingAssembly();
            await using(var input=a.GetManifestResourceStream("PSSA.Payload.exe")??throw new InvalidOperationException("Brak pakietu instalacyjnego."))
            await using(var output=new FileStream(exe,FileMode.CreateNew,FileAccess.Write,FileShare.None,1024*1024,true))
                await input.CopyToAsync(output);
            using var hashReader=new StreamReader(a.GetManifestResourceStream("PSSA.Payload.sha256")!);
            var expected=(await hashReader.ReadToEndAsync()).Trim();
            await using(var input=File.OpenRead(exe)){
                var actual=Convert.ToHexString(await SHA256.HashDataAsync(input));
                if(!actual.Equals(expected,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Pakiet instalacyjny jest uszkodzony.");
            }
            status?.Invoke(old!=null?"Aktualizowanie plików PSSA…":"Instalowanie plików PSSA…");
            var args="/S "+(old?.Machine==true?"/allusers":"/currentuser")+(desktop?"":" /PSSA-NODESKTOP")+(start?"":" /PSSA-NOSTART")+" /D="+dir;
            await Run(exe,args,old?.Machine==true);
            var installed=Detect();
            Trace("Post-install detected: "+(installed!=null));
            if(installed==null||!installed.Folder.TrimEnd('\\').Equals(dir,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Nie potwierdzono ukończonej instalacji.");
            return installed;
        }finally{try{Directory.Delete(temp,true);}catch{}}
    }
    public static async Task Remove(Action<string>? status=null)
    {
        CheckRunning(); var old=Detect()??throw new InvalidOperationException("Nie znaleziono zainstalowanej aplikacji.");
        status?.Invoke("Usuwanie programu i skrótów…");
        // Normal NSIS uninstaller copies itself and exits; wait for the registered program to disappear.
        await Run(old.Uninstaller,"/S /KEEP_APP_DATA "+(old.Machine?"/allusers":"/currentuser"),old.Machine);
        for(int i=0;i<120;i++){
            if(!File.Exists(old.Exe)&&Detect()?.Folder!=old.Folder)return;
            await Task.Delay(500);
        }
        throw new InvalidOperationException("Nie potwierdzono zakończenia dezinstalacji. Sprawdź listę zainstalowanych aplikacji.");
    }
}
