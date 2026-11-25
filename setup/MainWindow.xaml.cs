using Microsoft.Win32;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Pssa.Setup;
public partial class MainWindow : Window
{
    private Installed? installed;
    private int stage;
    private bool busy,success,removed;
    private readonly Brush gold=new SolidColorBrush(Color.FromRgb(229,189,87));
    private readonly Brush dim=new SolidColorBrush(Color.FromRgb(73,68,61));
    public MainWindow()
    {
        InitializeComponent();
        // Scale to fit compact displays without changing the designed layout.
        if(SystemParameters.WorkArea.Width<Width||SystemParameters.WorkArea.Height<Height){
            var scale=Math.Min(SystemParameters.WorkArea.Width/Width,SystemParameters.WorkArea.Height/Height)*.98;
            var root=(FrameworkElement)Content; root.LayoutTransform=new ScaleTransform(scale,scale);Width*=scale;Height*=scale;
        }
        installed=InstallEngine.Detect();
        Folder.Text=installed?.Folder??InstallEngine.DefaultFolder;
        Folder.IsReadOnly=installed!=null;BrowseButton.IsEnabled=installed==null;
        WelcomeStatus.Text=installed==null?"Gotowy do instalacji • aktualny użytkownik":"Wykryto PSSA "+installed.Version+" • aktualizacja lub dezinstalacja";
        OptionsTitle.Text=installed==null?"Opcje instalacji":"Zarządzaj instalacją";
        ScopeText.Text=installed?.Machine==true?"Instalacja dla wszystkich użytkowników (wymaga uprawnień).":"Instalacja dla bieżącego użytkownika.";
        FolderHint.Text=installed==null?"Wybierz osobny, pusty katalog. Dane aplikacji są przechowywane oddzielnie.":"Aktualizacja zachowa folder programu oraz wszystkie dane.";
        RemoveButton.Visibility=installed==null?Visibility.Collapsed:Visibility.Visible;
        Closing+=(_,e)=>{if(busy)e.Cancel=true;};
        Closed+=(_,_)=>{Sparks.Stop();Application.Current.Shutdown();};
        ShowStage(0);
    }
    private void ShowStage(int value)
    {
        stage=value; ErrorText.Visibility=Visibility.Collapsed;
        WelcomePanel.Visibility=value==0?Visibility.Visible:Visibility.Collapsed;
        OptionsPanel.Visibility=value==1?Visibility.Visible:Visibility.Collapsed;
        ConfirmPanel.Visibility=value==2?Visibility.Visible:Visibility.Collapsed;
        WorkPanel.Visibility=value==3?Visibility.Visible:Visibility.Collapsed;
        FinishPanel.Visibility=value==4?Visibility.Visible:Visibility.Collapsed;
        BackButton.Visibility=value is 1 or 2?Visibility.Visible:Visibility.Collapsed;
        CancelButton.Visibility=value is 3 or 4?Visibility.Collapsed:Visibility.Visible;
        NextButton.Visibility=value==3?Visibility.Collapsed:Visibility.Visible;
        CloseButton.IsEnabled=value!=3;
        NextButton.Content=value switch {0=>"Dalej  →",1=>installed==null?"Zainstaluj":"Aktualizuj",2=>"Odinstaluj",4=>"Zakończ",_=>""};
        FooterText.Text=value==3?"OPERACJA W TOKU":"INSTALATOR OFFLINE";
        var dot=value==0?0:value is 1 or 2?1:value==3?2:3;
        var dots=new[]{Dot0,Dot1,Dot2,Dot3};for(int i=0;i<dots.Length;i++)dots[i].Fill=i<=dot?gold:dim;
    }
    private void DragTitle(object sender,MouseButtonEventArgs e){if(e.OriginalSource is DependencyObject d){while(d!=null){if(d is System.Windows.Controls.Button)return;d=VisualTreeHelper.GetParent(d);}}if(e.LeftButton==MouseButtonState.Pressed)DragMove();}
    private void MinimizeClick(object sender,RoutedEventArgs e)=>WindowState=WindowState.Minimized;
    private void CloseClick(object sender,RoutedEventArgs e){if(!busy)Close();}
    private void BackClick(object sender,RoutedEventArgs e)=>ShowStage(stage==2?1:0);
    private void BrowseClick(object sender,RoutedEventArgs e){var dialog=new OpenFolderDialog{Title="Folder instalacji PSSA",Multiselect=false};if(Directory.Exists(Folder.Text))dialog.InitialDirectory=Folder.Text;if(dialog.ShowDialog(this)==true)Folder.Text=dialog.FolderName;}
    private void RemoveClick(object sender,RoutedEventArgs e){RemovePath.Text=installed?.Folder;ShowStage(2);}
    private async void NextClick(object sender,RoutedEventArgs e)
    {
        if(busy)return;
        if(stage==0){ShowStage(1);return;}
        if(stage==4){
            if(success&&!removed&&LaunchBox.IsChecked==true&&installed!=null){try{Process.Start(new ProcessStartInfo(installed.Exe){UseShellExecute=true});}catch(Exception ex){MessageBox.Show(ex.Message,"PSSA");return;}}
            Close();return;
        }
        var uninstall=stage==2;
        if(!uninstall)try{InstallEngine.ValidateFolder(Folder.Text,installed);}catch(Exception ex){ErrorText.Text=ex.Message;ErrorText.Visibility=Visibility.Visible;return;}
        busy=true;success=false;removed=uninstall;
        WorkTitle.Text=uninstall?"Dezinstalacja PSSA":installed==null?"Instalacja PSSA":"Aktualizacja PSSA";
        WorkStatus.Text="Przygotowywanie…";ShowStage(3);
        try{
            var path=Folder.Text;var desktop=DesktopBox.IsChecked==true;var start=StartBox.IsChecked==true;
            Action<string> status=s=>Dispatcher.Invoke(()=>WorkStatus.Text=s);
            if(uninstall)await Task.Run(()=>InstallEngine.Remove(status));
            else installed=await Task.Run(()=>InstallEngine.Install(path,desktop,start,status));
            success=true;ResultMark.Text="✓";FinishTitle.Text=uninstall?"PSSA został odinstalowany":"Instalacja zakończona pomyślnie!";
            FinishText.Text=uninstall?"Twoje dane pozostały na dysku. Możesz w każdej chwili zainstalować PSSA ponownie.":"PSSA jest gotowe do działania. Możesz uruchomić aplikację bezpośrednio z instalatora.";
        }catch(Exception ex){
            ResultMark.Text="!";FinishTitle.Text="Nie ukończono operacji";FinishText.Text=ex.Message;
        }finally{busy=false;LaunchBox.Visibility=success&&!removed?Visibility.Visible:Visibility.Collapsed;ShowStage(4);}
    }
    public async Task SavePreview(string file){
        await Task.Delay(700);UpdateLayout();
        var bitmap=new RenderTargetBitmap((int)ActualWidth,(int)ActualHeight,96,96,PixelFormats.Pbgra32);bitmap.Render(this);
        var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var output=File.Create(file);encoder.Save(output);
    }
}
