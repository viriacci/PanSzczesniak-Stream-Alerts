// SPDX-License-Identifier: GPL-2.0-or-later
#include <obs-module.h>
#include <obs-frontend-api.h>
#include <QWidget>
#include <QVBoxLayout>
#include <QGridLayout>
#include <QLabel>
#include <QPushButton>
#include <QToolButton>
#include <QSlider>
#include <QCheckBox>
#include <QTimer>
#include <QSettings>
#include <QFile>
#include <QFileInfo>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLocalSocket>
#include <QProcess>
#include <QPointer>
#include <QSignalBlocker>
#include <QRegularExpression>
#include <QDateTime>
#include <QByteArray>
#include <QStringList>
#include <windows.h>

OBS_DECLARE_MODULE()
MODULE_EXPORT const char *obs_module_description(void) { return "PSSA Control Dock"; }
static constexpr const char *dockId = "pssa-control-dock";
static QString trp(const char *s){return QString::fromUtf8(s);}
static QJsonObject descriptor(){
 QFile f(QDir(QString::fromLocal8Bit(qgetenv("APPDATA"))).filePath("PSSA 2 Dev/obs-dock.json"));
 if(!f.open(QIODevice::ReadOnly)||f.size()>8192)return {};
 return QJsonDocument::fromJson(f.readAll()).object();
}
static bool validDescriptor(const QJsonObject &d){
 return QRegularExpression("^pssa-dock-[a-f0-9]{32}$").match(d.value("pipe").toString()).hasMatch()
 && QRegularExpression("^[a-f0-9]{64}$").match(d.value("token").toString()).hasMatch();
}
static QByteArray request(const QJsonObject &d,const QString &cmd,const QJsonValue &value=QJsonValue()){
 QJsonObject x{{"token",d.value("token")},{"command",cmd},{"value",value}};
 return QJsonDocument(x).toJson(QJsonDocument::Compact)+"\n";
}
static bool elevated(){
 HANDLE token=nullptr;TOKEN_ELEVATION e{};DWORD size=0;
 if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return true;
 const BOOL ok=GetTokenInformation(token,TokenElevation,&e,sizeof(e),&size);CloseHandle(token);
 return !ok||e.TokenIsElevated!=0;
}
static bool processAlive(int pid){
 if(pid<=0)return false;
 HANDLE p=OpenProcess(SYNCHRONIZE,FALSE,static_cast<DWORD>(pid));if(!p)return GetLastError()==ERROR_ACCESS_DENIED;
 const bool alive=WaitForSingleObject(p,0)==WAIT_TIMEOUT;CloseHandle(p);return alive;
}
static bool isBrowser(obs_source_t *source){return source&&strcmp(obs_source_get_id(source),"browser_source")==0;}
static bool managed(obs_source_t *source){
 if(!isBrowser(source))return false;
 auto *s=obs_source_get_settings(source);const bool result=obs_data_get_bool(s,"pssa_control_dock");obs_data_release(s);return result;
}
static bool urlMatches(obs_source_t *source,const QByteArray &url){
 if(!isBrowser(source))return false;
 auto *s=obs_source_get_settings(source);const bool result=url==obs_data_get_string(s,"url");obs_data_release(s);return result;
}
class Dock final:public QWidget{
 QSettings settings{QSettings::IniFormat,QSettings::UserScope,"PSSA","ControlDock"};
 QLabel *status{},*sceneLabel{},*volumeLabel{},*details{};
 QPushButton *startButton{},*stopButton{},*restartButton{},*showButton{},*addButton{},*refreshButton{},*testButton{};
 QToolButton *more{};
 QWidget *extra{};
 QSlider *volume{};
 QCheckBox *mute{},*autoStart{},*autoClose{};
 QTimer timer,volumeTimer;
 QPointer<QLocalSocket> active;
 QByteArray response;
 bool online=false,starting=false,restarting=false,closing=false,autoAttempted=false;
 qint64 deadline=0;
 int restartPid=0;
 QString overlay;
 void report(const QString &text){status->setText(text);}
 void controls(){
  startButton->setEnabled(!online&&!starting&&!restarting&&!closing);
  stopButton->setEnabled(online&&!closing&&!restarting);
  restartButton->setEnabled(online&&!closing&&!restarting);
  showButton->setEnabled(online&&!closing);
  volume->setEnabled(online&&!closing);mute->setEnabled(online&&!closing);
  addButton->setEnabled(online&&!overlay.isEmpty());refreshButton->setEnabled(online);testButton->setEnabled(online);
 }
 void updateScene(){
  auto *source=obs_frontend_get_current_scene();
  sceneLabel->setText(source?trp(obs_source_get_name(source)):trp("Brak sceny"));
  if(source)obs_source_release(source);
 }
 void apply(const QJsonObject &data){
  online=true;starting=false;closing=false;overlay=data.value("overlayUrl").toString();
  const int v=data.value("volume").toInt(100);
  if(!volume->isSliderDown()&&!volumeTimer.isActive()){QSignalBlocker b(volume);volume->setValue(v);volumeLabel->setText(QString::number(v)+"%");}
  {QSignalBlocker b(mute);mute->setChecked(data.value("muted").toBool());}
  report(trp("Uruchomiony"));
  details->setText(trp("Twitch: ")+data.value("twitch").toString()+trp("  |  Kolejka: ")+QString::number(data.value("pending").toInt()));
  controls();
 }
 void offline(){
  online=false;overlay.clear();
  if(restarting){
   if(!processAlive(restartPid)){restarting=false;launch();return;}
   if(QDateTime::currentMSecsSinceEpoch()>deadline){restarting=false;report(trp("Restart: PSSA nie zakończyła pracy"));controls();return;}
  }
  if(starting&&QDateTime::currentMSecsSinceEpoch()>deadline){starting=false;report(trp("Nie uzyskano połączenia z PSSA"));}
  else if(!starting&&!restarting){closing=false;report(trp("Wyłączony"));}
  controls();
 }
 void launch(){
  const auto d=descriptor();const QString exe=d.value("exe").toString();QFileInfo info(exe);
  if(elevated()){report(trp("Uruchom OBS bez uprawnień administratora, aby startować PSSA"));controls();return;}
  if(!info.isAbsolute()||!info.isFile()||info.fileName().compare("PSSA 2 Dev.exe",Qt::CaseInsensitive)!=0){report(trp("Uruchom PSSA ręcznie po instalacji"));controls();return;}
  if(processAlive(d.value("pid").toInt())){report(trp("PSSA uruchamia się lub nie odpowiada"));return;}
  if(!QProcess::startDetached(exe,QStringList{"--pssa-background"},info.absolutePath())){report(trp("Nie udało się uruchomić PSSA"));return;}
  starting=true;deadline=QDateTime::currentMSecsSinceEpoch()+15000;report(trp("Uruchamianie…"));controls();
 }
 void send(const QString &cmd,const QJsonValue &value=QJsonValue()){
  if(active){if(cmd=="status")return;active->abort();active->deleteLater();active.clear();}
  const auto d=descriptor();if(!validDescriptor(d)){offline();return;}
  auto *s=new QLocalSocket(this);active=s;response.clear();
  auto finish=[this,s,cmd](bool success){
   if(active!=s)return;
   active.clear();s->abort();s->deleteLater();
   if(!success){if(cmd=="status")offline();else{if(cmd=="quit"){restarting=false;closing=false;}report(trp("Polecenie nie powiodło się"));controls();}}
  };
  connect(s,&QLocalSocket::connected,this,[s,d,cmd,value](){s->write(request(d,cmd,value));s->flush();});
  connect(s,&QLocalSocket::readyRead,this,[this,s,cmd,finish](){
   if(active!=s)return;
   response+=s->readAll();if(response.size()>16384){finish(false);return;}
   if(!response.contains('\n'))return;
   const auto result=QJsonDocument::fromJson(response.left(response.indexOf('\n'))).object();
   if(!result.value("ok").toBool()){finish(false);return;}
   if(cmd!="quit")apply(result.value("state").toObject());
   finish(true);
  });
  connect(s,&QLocalSocket::errorOccurred,this,[finish](QLocalSocket::LocalSocketError){finish(false);});
  connect(s,&QLocalSocket::disconnected,this,[finish](){finish(false);});
  QTimer::singleShot(800,s,[finish](){finish(false);});
  s->connectToServer(d.value("pipe").toString());
 }
 void stop(bool restart){
  if(!online)return;
  restartPid=descriptor().value("pid").toInt();restarting=restart;closing=true;
  deadline=QDateTime::currentMSecsSinceEpoch()+15000;
  report(restart?trp("Restartowanie…"):trp("Zamykanie…"));controls();send("quit");
 }
 void addSource(){
  if(!online||!QRegularExpression("^http://127\\.0\\.0\\.1:18766/[a-f0-9]{64}/$").match(overlay).hasMatch()){report(trp("Brak poprawnego adresu nakładki"));return;}
  auto *sceneSource=obs_frontend_get_current_scene();if(!sceneSource){report(trp("Brak aktywnej sceny"));return;}
  auto *scene=obs_scene_from_source(sceneSource);if(!scene){obs_source_release(sceneSource);return;}
  const QByteArray url=overlay.toUtf8();
  struct Search {QByteArray url;obs_source_t *source=nullptr;};
  Search current{url};
  obs_scene_enum_items(scene,[](obs_scene_t*,obs_sceneitem_t *item,void *data){auto &x=*static_cast<Search*>(data);auto *s=obs_sceneitem_get_source(item);if(managed(s)||urlMatches(s,x.url)){x.source=obs_source_get_ref(s);return false;}return true;},&current);
  if(current.source){if(managed(current.source)&&!urlMatches(current.source,url)){auto *s=obs_data_create();obs_data_set_string(s,"url",url.constData());obs_source_update(current.source,s);obs_data_release(s);}obs_source_release(current.source);obs_source_release(sceneSource);report(trp("Źródło PSSA już jest w scenie"));return;}
  Search global{url};
  obs_enum_sources([](void *data,obs_source_t *s){auto &x=*static_cast<Search*>(data);if(managed(s)||urlMatches(s,x.url)){x.source=obs_source_get_ref(s);return false;}return true;},&global);
  auto *source=global.source;
  if(!source){
   auto *s=obs_data_create();obs_data_set_string(s,"url",url.constData());obs_data_set_int(s,"width",1920);obs_data_set_int(s,"height",1080);
   obs_data_set_bool(s,"is_local_file",false);obs_data_set_bool(s,"shutdown",false);obs_data_set_bool(s,"restart_when_active",false);obs_data_set_bool(s,"reroute_audio",true);obs_data_set_bool(s,"pssa_control_dock",true);
   QByteArray name="PSSA - Alerty";int i=2;while(auto *existing=obs_get_source_by_name(name.constData())){obs_source_release(existing);name="PSSA - Alerty "+QByteArray::number(i++);}
   source=obs_source_create("browser_source",name.constData(),s,nullptr);obs_data_release(s);
  }else if(managed(source)&&!urlMatches(source,url)){auto *s=obs_data_create();obs_data_set_string(s,"url",url.constData());obs_source_update(source,s);obs_data_release(s);}
  if(!source){obs_source_release(sceneSource);report(trp("Nie można utworzyć źródła przeglądarkowego"));return;}
  auto *item=obs_scene_add(scene,source);
  if(item){obs_video_info info{};if(obs_get_video_info(&info)){vec2 scale;vec2_set(&scale,static_cast<float>(info.base_width)/1920.0f,static_cast<float>(info.base_height)/1080.0f);obs_sceneitem_set_scale(item,&scale);}obs_frontend_save();}
  obs_source_release(source);obs_source_release(sceneSource);report(item?trp("Dodano źródło PSSA"):trp("Nie udało się dodać źródła"));
 }
public:
 Dock(){
  auto *layout=new QVBoxLayout(this);layout->setContentsMargins(8,8,8,8);layout->setSpacing(6);
  auto *logo=new QLabel("PSSA",this);logo->setAlignment(Qt::AlignCenter);logo->setStyleSheet("font-size:24px;font-weight:700;color:#e3c048;");layout->addWidget(logo);
  status=new QLabel(trp("Sprawdzanie…"),this);status->setAlignment(Qt::AlignCenter);status->setWordWrap(true);layout->addWidget(status);
  auto *grid=new QGridLayout;grid->setSpacing(5);layout->addLayout(grid);
  startButton=new QPushButton(trp("Uruchom"),this);stopButton=new QPushButton(trp("Zamknij"),this);restartButton=new QPushButton(trp("Restartuj"),this);showButton=new QPushButton(trp("Pokaż PSSA"),this);
  grid->addWidget(startButton,0,0);grid->addWidget(stopButton,0,1);grid->addWidget(restartButton,1,0);grid->addWidget(showButton,1,1);
  more=new QToolButton(this);more->setText(trp("Więcej"));more->setCheckable(true);more->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);more->setArrowType(Qt::DownArrow);more->setSizePolicy(QSizePolicy::Expanding,QSizePolicy::Preferred);layout->addWidget(more);
  extra=new QWidget(this);auto *x=new QVBoxLayout(extra);x->setContentsMargins(0,4,0,0);x->setSpacing(6);
  volumeLabel=new QLabel("100%",extra);x->addWidget(new QLabel(trp("Głośność alertów"),extra));x->addWidget(volumeLabel);
  volume=new QSlider(Qt::Horizontal,extra);volume->setRange(0,100);volume->setValue(100);x->addWidget(volume);
  mute=new QCheckBox(trp("Wycisz alerty"),extra);x->addWidget(mute);
  x->addWidget(new QLabel(trp("Aktywna scena (program)"),extra));sceneLabel=new QLabel(extra);sceneLabel->setWordWrap(true);x->addWidget(sceneLabel);
  addButton=new QPushButton(trp("Dodaj źródło PSSA"),extra);refreshButton=new QPushButton(trp("Odśwież nakładkę"),extra);testButton=new QPushButton(trp("Dodaj testowy alert"),extra);
  x->addWidget(addButton);x->addWidget(refreshButton);x->addWidget(testButton);
  details=new QLabel(extra);details->setWordWrap(true);x->addWidget(details);
  autoStart=new QCheckBox(trp("Uruchamiaj PSSA z OBS"),extra);autoClose=new QCheckBox(trp("Zamykaj PSSA razem z OBS"),extra);
  autoStart->setChecked(settings.value("autoStart",false).toBool());autoClose->setChecked(settings.value("autoClose",false).toBool());x->addWidget(autoStart);x->addWidget(autoClose);
  extra->hide();layout->addWidget(extra);layout->addStretch();
  connect(more,&QToolButton::toggled,this,[this](bool b){extra->setVisible(b);more->setText(b?trp("Mniej"):trp("Więcej"));more->setArrowType(b?Qt::UpArrow:Qt::DownArrow);});
  connect(startButton,&QPushButton::clicked,this,[this](){launch();});connect(stopButton,&QPushButton::clicked,this,[this](){stop(false);});connect(restartButton,&QPushButton::clicked,this,[this](){stop(true);});connect(showButton,&QPushButton::clicked,this,[this](){send("show");});
  connect(addButton,&QPushButton::clicked,this,[this](){addSource();});connect(refreshButton,&QPushButton::clicked,this,[this](){send("reload");});connect(testButton,&QPushButton::clicked,this,[this](){send("test");});
  volumeTimer.setSingleShot(true);volumeTimer.setInterval(160);connect(volume,&QSlider::valueChanged,this,[this](int v){volumeLabel->setText(QString::number(v)+"%");volumeTimer.start();});connect(&volumeTimer,&QTimer::timeout,this,[this](){send("volume",volume->value());});
  connect(mute,&QCheckBox::toggled,this,[this](bool v){send("mute",v);});
  connect(autoStart,&QCheckBox::toggled,this,[this](bool v){settings.setValue("autoStart",v);settings.sync();});connect(autoClose,&QCheckBox::toggled,this,[this](bool v){settings.setValue("autoClose",v);settings.sync();});
  timer.setInterval(1500);connect(&timer,&QTimer::timeout,this,[this](){updateScene();if(!closing||!active)send("status");if(!autoAttempted){autoAttempted=true;if(autoStart->isChecked()&&!processAlive(descriptor().value("pid").toInt()))launch();}});
  controls();timer.start();send("status");
 }
 void obsExit(){
  timer.stop();if(!autoClose->isChecked())return;
  const auto d=descriptor();if(!validDescriptor(d))return;
  QLocalSocket s;s.connectToServer(d.value("pipe").toString());if(s.waitForConnected(200)){s.write(request(d,"quit"));s.flush();s.waitForBytesWritten(200);}
 }
};
static QPointer<Dock> widget;
static void frontendEvent(enum obs_frontend_event event,void*){if(event==OBS_FRONTEND_EVENT_EXIT&&widget)widget->obsExit();}
bool obs_module_load(void){
 widget=new Dock;
 if(!obs_frontend_add_dock_by_id(dockId,"PSSA Control Dock",widget.data())){delete widget.data();widget.clear();return false;}
 obs_frontend_add_event_callback(frontendEvent,nullptr);return true;
}
void obs_module_unload(void){
 obs_frontend_remove_event_callback(frontendEvent,nullptr);
 if(widget)obs_frontend_remove_dock(dockId);
 widget.clear();
}
