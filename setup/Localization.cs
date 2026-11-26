using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;

namespace Pssa.Setup;
internal static class L
{
    private static readonly string[] Codes={"pl","en","de"};
    private static readonly string Data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"PSSA 2 Dev");
    private static readonly string Preference=Path.Combine(Data,"language.json");
    private static readonly Dictionary<string,Dictionary<string,string>> Catalogs=new();
    public static string Language {get;private set;}="pl";
    public static string? Saved(){
        try{if(new FileInfo(Preference).Length>1024)return null;using var doc=JsonDocument.Parse(File.ReadAllText(Preference));var code=doc.RootElement.GetProperty("language").GetString();return Codes.Contains(code)?code:null;}catch{return null;}
    }
    public static string Default(bool updating){
        if(updating)return Saved()??"pl";
        var code=CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        return Saved()??(Codes.Contains(code)?code:"en");
    }
    private static Dictionary<string,string> Load(string code){
        if(Catalogs.TryGetValue(code,out var existing))return existing;
        using var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("PSSA.Locale."+code+".json")??throw new InvalidOperationException("Locale missing");
        using var doc=JsonDocument.Parse(stream);
        var values=JsonSerializer.Deserialize<Dictionary<string,string>>(doc.RootElement.GetProperty("translations"))??throw new InvalidOperationException("Invalid locale");
        Catalogs[code]=values;return values;
    }
    public static void Set(string code){
        Language=Codes.Contains(code)?code:"pl";
        var current=Load(Language);
        foreach(var item in Load("pl"))Application.Current.Resources[item.Key]=current.TryGetValue(item.Key,out var value)?value:item.Value;
    }
    public static string T(string key,string? name=null,string? value=null){
        var text=Load(Language).GetValueOrDefault(key)??Load("pl").GetValueOrDefault(key)??key;
        return name==null?text:text.Replace("{"+name+"}",value??"");
    }
    public static void Save(){
        Directory.CreateDirectory(Data);
        var temp=Preference+"."+Guid.NewGuid().ToString("N")+".tmp";
        try{File.WriteAllText(temp,JsonSerializer.Serialize(new {language=Language}));File.Move(temp,Preference,true);}finally{if(File.Exists(temp))File.Delete(temp);}
    }
}
