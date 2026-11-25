using System.IO;
using System.Windows;
namespace Pssa.Setup;
public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        try{
            if(e.Args.Length>0&&e.Args[0]=="--install"){
                int i=Array.IndexOf(e.Args,"--directory");
                if(i<0||i+1>=e.Args.Length)throw new ArgumentException("Missing --directory");
                await InstallEngine.Install(e.Args[i+1],!e.Args.Contains("--no-desktop"),!e.Args.Contains("--no-start"));
                Shutdown(0);return;
            }
            if(e.Args.Length==1&&e.Args[0]=="--uninstall"){await InstallEngine.Remove();Shutdown(0);return;}
            var window=new MainWindow();
            MainWindow=window;
            if(e.Args.Length==2&&e.Args[0]=="--preview"){
                window.Show(); await window.SavePreview(e.Args[1]); Shutdown(0);return;
            }
            window.Show();
        }catch(Exception ex){
            try{File.AppendAllText(Path.Combine(Path.GetTempPath(),"PSSA-setup-error.log"),DateTime.Now.ToString("s")+" "+ex.ToString()+Environment.NewLine);}catch{}
            if(e.Args.Length==0)MessageBox.Show(ex.Message,"PSSA Setup",MessageBoxButton.OK,MessageBoxImage.Error);
            Shutdown(1);
        }
    }
}
