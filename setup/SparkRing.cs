using System.Diagnostics;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;

namespace Pssa.Setup;
public sealed class SparkRing : FrameworkElement
{
    private readonly Stopwatch clock = new();
    private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromMilliseconds(33) };
    private readonly SolidColorBrush[] colors = Enumerable.Range(0, 12).Select(i => {
        var b = new SolidColorBrush(Color.FromArgb((byte)(20+i*20), 249, 199, 94)); b.Freeze(); return b;
    }).ToArray();
    private readonly Pen ringPen = new(new SolidColorBrush(Color.FromArgb(80, 220, 165, 63)), 1);
    public SparkRing()
    {
        IsHitTestVisible = false;
        Loaded += (_,_) => { if(SystemParameters.ClientAreaAnimation) { clock.Restart(); timer.Start(); } InvalidateVisual(); };
        Unloaded += (_,_) => timer.Stop();
        timer.Tick += (_,_) => { if(clock.Elapsed.TotalSeconds > 4.5) timer.Stop(); InvalidateVisual(); };
        ringPen.Freeze();
    }
    public void Stop() => timer.Stop();
    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);
        var w=ActualWidth; var h=ActualHeight; if(w<60||h<60) return;
        var rect=new Rect(16,16,w-32,h-32);
        double t=clock.IsRunning?clock.Elapsed.TotalSeconds:5, progress=Math.Min(1,t/2.1);
        if(progress>=1) dc.DrawRoundedRectangle(null,ringPen,rect,24,24);
        // Rounded perimeter, built clockwise from the top midpoint, then settles into a subtle outline.
        if(t>4.5) return;
        var g=new RectangleGeometry(rect,24,24).GetFlattenedPathGeometry();
        for(int i=0;i<120;i++){
            double frac=(progress-i*.0029+1)%1;
            if(progress<1 && i*.0029>progress) continue;
            g.GetPointAtFractionLength(frac,out Point p,out Point tangent);
            double fade=(1-i/120.0)*Math.Min(1,(4.5-t)/1.3);
            int index=Math.Clamp((int)(fade*11),0,11);
            var jitter=Math.Sin(i*31.7+t*8)*Math.Min(9,i*.12);
            var q=new Point(p.X+tangent.Y*jitter,p.Y-tangent.X*jitter);
            double radius=1+2.0*fade;
            dc.DrawEllipse(colors[index],null,q,radius,radius*.8);
            if(i%11==0) dc.DrawEllipse(colors[Math.Max(0,index-4)],null,q,radius*2.5,radius*2.5);
        }
        // A persistent, gradually formed ring of small sparks remains behind the moving head.
        int count=(int)(progress*180);
        for(int i=0;i<count;i++){g.GetPointAtFractionLength(i/180.0,out Point p,out _);dc.DrawEllipse(colors[2+i%3],null,p,.65,.65);}
    }
}
