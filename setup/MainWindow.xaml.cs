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
    private bool fresh;
    private bool busy,success,removed;
    private readonly Brush gold=new SolidColorBrush(Color.FromRgb(229,189,87));
    private readonly Brush dim=new SolidColorBrush(Color.FromRgb(73,68,61));
    public MainWindow()
    {
        InitializeComponent();

        if(SystemParameters.WorkArea.Width<Width||SystemParameters.WorkArea.Height<Height){
            var scale=Math.Min(SystemParameters.WorkArea.Width/Width,SystemParameters.WorkArea.Height/Height)*.98;
            var root=(FrameworkElement)Content; root.LayoutTransform=new ScaleTransform(scale,scale);Width*=scale;Height*=scale;
        }
        installed=InstallEngine.Detect();fresh=installed==null;
        LanguageChoice.SelectedIndex=L.Language=="en"?1:L.Language=="de"?2:0;
        Folder.Text=installed?.Folder??InstallEngine.DefaultFolder;
        Folder.IsReadOnly=installed!=null;BrowseButton.IsEnabled=installed==null;
        RefreshLanguage();
        RemoveButton.Visibility=installed==null?Visibility.Collapsed:Visibility.Visible;
        Closing+=(_,e)=>{if(busy)e.Cancel=true;};
        Closed+=(_,_)=>{Sparks.Stop();Application.Current.Shutdown();};
        ShowStage(fresh?-1:0);
    }
    private void RefreshLanguage(){
        WelcomeStatus.Text=installed==null?L.T("setup.ready"):L.T("setup.detected","version",installed.Version);
        OptionsTitle.Text=L.T(installed==null?"setup.options":"setup.manage");
        ScopeText.Text=L.T(installed?.Machine==true?"setup.machine":"setup.user");
    }
    private void LanguageChanged(object sender,System.Windows.Controls.SelectionChangedEventArgs e){
        if(LanguageChoice?.SelectedItem is System.Windows.Controls.ComboBoxItem item&&item.Tag is string code){L.Set(code);if(WelcomeStatus!=null)RefreshLanguage();if(NextButton!=null&&stage==-1)NextButton.Content=L.T("setup.next");}
    }
    private void ShowStage(int value)
    {
        stage=value; ErrorText.Visibility=Visibility.Collapsed;
        LanguagePanel.Visibility=value==-1?Visibility.Visible:Visibility.Collapsed;
        WelcomePanel.Visibility=value==0?Visibility.Visible:Visibility.Collapsed;
        OptionsPanel.Visibility=value==1?Visibility.Visible:Visibility.Collapsed;
        ConfirmPanel.Visibility=value==2?Visibility.Visible:Visibility.Collapsed;
        WorkPanel.Visibility=value==3?Visibility.Visible:Visibility.Collapsed;
        FinishPanel.Visibility=value==4?Visibility.Visible:Visibility.Collapsed;
        BackButton.Visibility=value is 1 or 2||value==0&&fresh?Visibility.Visible:Visibility.Collapsed;
        CancelButton.Visibility=value is 3 or 4?Visibility.Collapsed:Visibility.Visible;
        NextButton.Visibility=value==3?Visibility.Collapsed:Visibility.Visible;
        CloseButton.IsEnabled=value!=3;
        NextButton.Content=value switch {-1 or 0=>L.T("setup.next"),1=>L.T(installed==null?"setup.install":"setup.update"),2=>L.T("setup.uninstall"),4=>L.T("setup.finish"),_=>""};
        var dot=value<=0?0:value is 1 or 2?1:value==3?2:3;
        var dots=new[]{Dot0,Dot1,Dot2,Dot3};for(int i=0;i<dots.Length;i++)dots[i].Fill=i<=dot?gold:dim;
    }
    private void DragTitle(object sender,MouseButtonEventArgs e){if(e.OriginalSource is DependencyObject d){while(d!=null){if(d is System.Windows.Controls.Button)return;d=VisualTreeHelper.GetParent(d);}}if(e.LeftButton==MouseButtonState.Pressed)DragMove();}
    private void MinimizeClick(object sender,RoutedEventArgs e)=>WindowState=WindowState.Minimized;
    private void CloseClick(object sender,RoutedEventArgs e){if(!busy)Close();}
    private void BackClick(object sender,RoutedEventArgs e)=>ShowStage(stage==2?1:stage==0&&fresh?-1:0);
    private void BrowseClick(object sender,RoutedEventArgs e){var dialog=new OpenFolderDialog{Title=L.T("setup.browseTitle"),Multiselect=false};if(Directory.Exists(Folder.Text))dialog.InitialDirectory=Folder.Text;if(dialog.ShowDialog(this)==true)Folder.Text=dialog.FolderName;}
    private void RemoveClick(object sender,RoutedEventArgs e){RemovePath.Text=installed?.Folder;ShowStage(2);}
    private async void NextClick(object sender,RoutedEventArgs e)
    {
        if(busy)return;
        if(stage==-1){ShowStage(0);return;}
        if(stage==0){ShowStage(1);return;}
        if(stage==4){
            if(success&&!removed&&LaunchBox.IsChecked==true&&installed!=null){try{Process.Start(new ProcessStartInfo(installed.Exe){UseShellExecute=true});}catch(Exception ex){MessageBox.Show(ex.Message,"PSSA");return;}}
            Close();return;
        }
        var uninstall=stage==2;
        if(!uninstall)try{InstallEngine.ValidateFolder(Folder.Text,installed);}catch(Exception ex){ErrorText.Text=ex.Message;ErrorText.Visibility=Visibility.Visible;return;}
        busy=true;success=false;removed=uninstall;
        WorkTitle.Text=uninstall?L.T("setup.removing"):installed==null?L.T("setup.installing"):L.T("setup.updating");
        WorkStatus.Text=L.T("setup.preparing");ShowStage(3);
        try{
            var path=Folder.Text;var desktop=DesktopBox.IsChecked==true;var start=StartBox.IsChecked==true;
            Action<string> status=s=>Dispatcher.Invoke(()=>WorkStatus.Text=s);
            if(uninstall)await Task.Run(()=>InstallEngine.Remove(status));
            else installed=await Task.Run(()=>InstallEngine.Install(path,desktop,start,status));
            success=true;ResultMark.Text="✓";FinishTitle.Text=uninstall?L.T("setup.removed"):L.T("setup.success");
            FinishText.Text=uninstall?L.T("setup.removedDetail"):L.T("setup.successDetail");
        }catch(Exception ex){
            ResultMark.Text="!";FinishTitle.Text=L.T("setup.failed");FinishText.Text=ex.Message;
        }finally{busy=false;LaunchBox.Visibility=success&&!removed?Visibility.Visible:Visibility.Collapsed;ShowStage(4);}
    }
    public async Task SavePreview(string file){
        await Task.Delay(700);UpdateLayout();
        var bitmap=new RenderTargetBitmap((int)ActualWidth,(int)ActualHeight,96,96,PixelFormats.Pbgra32);bitmap.Render((Visual)Content);
        var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var output=File.Create(file);encoder.Save(output);
    }
}
