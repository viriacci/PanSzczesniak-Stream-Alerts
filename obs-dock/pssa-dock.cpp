// SPDX-License-Identifier: GPL-2.0-or-later
#include <obs-module.h>
#include <obs-frontend-api.h>
#include <QWidget>
#include <QScrollArea>
#include <QSizePolicy>
#include <graphics/vec2.h>
#include <cstring>
#include <QVBoxLayout>
#include <QGridLayout>
#include <QLabel>
#include <QPushButton>
#include <QToolButton>
#include <QSlider>
#include <QCheckBox>
#include <QComboBox>
#include "pssa-locales.generated.h"
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
#include <QUrl>
#include <windows.h>

OBS_DECLARE_MODULE()
MODULE_EXPORT const char *obs_module_description(void) { return "PSSA Control Dock"; }
static constexpr const char *dockId = "pssa-control-dock";
static QString trp(const char *s){return QString::fromUtf8(s);}
static QString dockLanguage="pl";
static QString preferredLanguage(){
 QSettings config(QSettings::IniFormat,QSettings::UserScope,"PSSA","ControlDock");
 const auto override=config.value("language","auto").toString();
 if(override=="pl"||override=="en"||override=="de")return override;
 QFile f(QDir(qEnvironmentVariable("APPDATA")).filePath("PSSA 2 Dev/language.json"));
 if(!f.open(QIODevice::ReadOnly)||f.size()>1024)return "pl";
 const auto code=QJsonDocument::fromJson(f.readAll()).object().value("language").toString();
 return code=="en"||code=="de"?code:"pl";
}
static QString dtr(const char *key){return pssaDockText(dockLanguage,key);}
static QJsonObject descriptor(){
 QFile f(QDir(qEnvironmentVariable("APPDATA")).filePath("PSSA 2 Dev/obs-dock.json"));
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
static bool isBrowser(obs_source_t *source){
 const char *id=source?obs_source_get_id(source):nullptr;return id&&std::strcmp(id,"browser_source")==0;
}
static bool validOverlay(const QString &url){
 const QUrl parsed(url);const int port=parsed.port();
 return port>=1&&port<=65535&&QRegularExpression("^http://127\\.0\\.0\\.1:[0-9]{1,5}/[a-f0-9]{64}/$").match(url).hasMatch();
}
static bool refreshBrowser(obs_source_t *source){
 auto *properties=obs_source_properties(source);if(!properties)return false;
 auto *button=obs_properties_get(properties,"refreshnocache");
 const bool found=button&&obs_property_get_type(button)==OBS_PROPERTY_BUTTON;
 if(found)obs_property_button_clicked(button,source);
 obs_properties_destroy(properties);return found;
}
static bool repairManagedUrl(obs_source_t *source,const QByteArray &url){
 auto *s=obs_source_get_settings(source);if(!s)return false;
 const bool changed=url!=obs_data_get_string(s,"url")||obs_data_get_bool(s,"is_local_file")||obs_data_get_bool(s,"shutdown")||obs_data_get_bool(s,"restart_when_active");
 if(changed){obs_data_set_string(s,"url",url.constData());obs_data_set_bool(s,"is_local_file",false);obs_data_set_bool(s,"shutdown",false);obs_data_set_bool(s,"restart_when_active",false);obs_source_update(source,s);}
 obs_data_release(s);return changed;
}
static bool managed(obs_source_t *source){
 if(!isBrowser(source))return false;
 auto *s=obs_source_get_settings(source);const bool result=obs_data_get_bool(s,"pssa_control_dock");obs_data_release(s);return result;
}
static bool urlMatches(obs_source_t *source,const QByteArray &url){
 if(!isBrowser(source))return false;
 auto *s=obs_source_get_settings(source);const bool result=url==obs_data_get_string(s,"url");obs_data_release(s);return result;
}
static obs_source_t *targetScene(){
 return obs_frontend_preview_program_mode_active()?obs_frontend_get_current_preview_scene():obs_frontend_get_current_scene();
}
class Dock final:public QWidget{
 QSettings settings{QSettings::IniFormat,QSettings::UserScope,"PSSA","ControlDock"};
 QLabel *status{},*sceneLabel{},*sceneCaption{},*volumeLabel{},*details{},*operationLabel{};
 QPushButton *startButton{},*stopButton{},*restartButton{},*showButton{},*addButton{},*refreshButton{},*testButton{};
 QToolButton *more{};
 QWidget *extra{};
 QScrollArea *extraScroll{};
 QSlider *volume{};
 QCheckBox *mute{},*autoStart{},*autoClose{};
 QTimer timer,volumeTimer;
 QPointer<QLocalSocket> active;
 QByteArray response;
 enum class Phase{Idle,Starting,Restarting,Stopping};
 Phase phase=Phase::Idle;
 bool online=false,autoAttempted=false;
 qint64 deadline=0;
 QString previousToken;
 int stoppingPid=0;
 QString overlay;
 void report(const QString &text){status->setText(text);}
 void result(const QString &text){operationLabel->setText(text);operationLabel->setVisible(!text.isEmpty());}
 void controls(){
  const bool idle=phase==Phase::Idle,ready=online&&idle;
  startButton->setEnabled(!online&&idle);stopButton->setEnabled(ready);restartButton->setEnabled(ready);showButton->setEnabled(ready);
  volume->setEnabled(ready);mute->setEnabled(ready);addButton->setEnabled(ready&&!overlay.isEmpty());refreshButton->setEnabled(ready);testButton->setEnabled(ready);
 }
 void updateScene(){
  auto *source=targetScene();
  sceneCaption->setText(obs_frontend_preview_program_mode_active()?dtr("dock.previewScene"):dtr("dock.activeScene"));
  sceneLabel->setText(source?trp(obs_source_get_name(source)):dtr("dock.noScene"));
  if(source)obs_source_release(source);
 }
 void apply(const QJsonObject &data,const QString &token){
  online=true;overlay=data.value("overlayUrl").toString();
  if(phase==Phase::Starting||phase==Phase::Restarting){
   if(token==previousToken&&phase==Phase::Restarting){controls();return;}
   phase=Phase::Idle;result(dtr("dock.ready"));
  }
  const int v=data.value("volume").toInt(100);
  if(!volume->isSliderDown()&&!volumeTimer.isActive()){QSignalBlocker b(volume);volume->setValue(v);volumeLabel->setText(QString::number(v)+"%");}
  {QSignalBlocker b(mute);mute->setChecked(data.value("muted").toBool());}
  if(phase==Phase::Idle)report(dtr("dock.running"));
  details->setText(trp("Twitch: ")+dtr(("dock.twitch."+data.value("twitch").toString()).toUtf8().constData())+dtr("dock.queue")+QString::number(data.value("pending").toInt())+dtr("dock.overlay")+(data.contains("overlayClients")?(data.value("overlayClients").toInt()>0?dtr("dock.connected"):dtr("dock.notConnected")):dtr("dock.noData"))+trp("  |  Port: ")+(validOverlay(overlay)?QString::number(QUrl(overlay).port()):trp("—")));
  controls();
 }
 void offline(){
  online=false;overlay.clear();
  if(phase==Phase::Stopping&&!processAlive(stoppingPid)){phase=Phase::Idle;result(dtr("dock.closed"));}
  if(phase==Phase::Idle)report(dtr("dock.offline"));
  controls();
 }
 void checkDeadline(){
  if(phase==Phase::Idle||QDateTime::currentMSecsSinceEpoch()<=deadline)return;
  result(phase==Phase::Stopping?dtr("dock.notClosed"):dtr("dock.notRestarted"));
  phase=Phase::Idle;report(online?dtr("dock.running"):dtr("dock.offline"));controls();
 }
 void launch(){
  if(phase!=Phase::Idle)return;
  const auto d=descriptor();const QString exe=d.value("exe").toString();QFileInfo info(exe);
  if(elevated()){result(dtr("dock.elevated"));return;}
  if(!info.isAbsolute()||!info.isFile()||info.fileName().compare("PSSA 2 Dev.exe",Qt::CaseInsensitive)!=0){result(dtr("dock.manualStart"));return;}
  if(!QProcess::startDetached(exe,QStringList{"--pssa-background"},info.absolutePath())){result(dtr("dock.startFailed"));return;}
  previousToken=d.value("token").toString();phase=Phase::Starting;deadline=QDateTime::currentMSecsSinceEpoch()+45000;report(dtr("dock.starting"));result(QString());controls();
 }
 void send(const QString &cmd,const QJsonValue &value=QJsonValue()){
  if(active){if(cmd=="status")return;auto old=active;active.clear();old->abort();old->deleteLater();}
  const auto d=descriptor();if(!validDescriptor(d)){offline();return;}
  auto *s=new QLocalSocket(this);active=s;response.clear();
  auto finish=[this,s,cmd](bool success){
   if(active!=s)return;
   active.clear();s->abort();s->deleteLater();
   if(!success){if(cmd=="status")offline();else if(cmd=="quit"||cmd=="restart"){result(dtr("dock.unconfirmed"));}else{result(dtr("dock.commandFailed"));controls();}}
  };
  connect(s,&QLocalSocket::connected,this,[s,d,cmd,value](){s->write(request(d,cmd,value));s->flush();});
  connect(s,&QLocalSocket::readyRead,this,[this,s,d,cmd,finish](){
   if(active!=s)return;
   response+=s->readAll();if(response.size()>16384){finish(false);return;}
   if(!response.contains('\n'))return;
   const auto result=QJsonDocument::fromJson(response.left(response.indexOf('\n'))).object();
   if(!result.value("ok").toBool()){finish(false);return;}
   if(cmd!="quit"&&cmd!="restart")apply(result.value("state").toObject(),d.value("token").toString());
   finish(true);
  });
  connect(s,&QLocalSocket::errorOccurred,this,[finish](QLocalSocket::LocalSocketError){finish(false);});
  connect(s,&QLocalSocket::disconnected,this,[finish](){finish(false);});
  QTimer::singleShot(800,s,[finish](){finish(false);});
  s->connectToServer(d.value("pipe").toString());
 }
 void stop(bool restart){
  if(!online||phase!=Phase::Idle)return;
  volumeTimer.stop();const auto d=descriptor();previousToken=d.value("token").toString();stoppingPid=d.value("pid").toInt();
  phase=restart?Phase::Restarting:Phase::Stopping;deadline=QDateTime::currentMSecsSinceEpoch()+45000;
  result(QString());report(restart?dtr("dock.restarting"):dtr("dock.stopping"));controls();send(restart?"restart":"quit");
 }
 void addSource(){
  if(!online||!validOverlay(overlay)){result(dtr("dock.badOverlay"));return;}
  auto *sceneSource=targetScene();if(!sceneSource){result(dtr("dock.noActive"));return;}
  const QString sceneName=trp(obs_source_get_name(sceneSource));auto *scene=obs_scene_from_source(sceneSource);if(!scene){obs_source_release(sceneSource);return;}
  const QByteArray url=overlay.toUtf8();
  struct Search {QByteArray url;obs_source_t *source=nullptr;obs_sceneitem_t *item=nullptr;};
  Search current{url};
  obs_scene_enum_items(scene,[](obs_scene_t*,obs_sceneitem_t *item,void *data){auto &x=*static_cast<Search*>(data);auto *s=obs_sceneitem_get_source(item);if(managed(s)||urlMatches(s,x.url)){x.source=obs_source_get_ref(s);x.item=item;return false;}return true;},&current);
  if(current.source){const bool changed=managed(current.source)&&repairManagedUrl(current.source,url);const bool hidden=current.item&&!obs_sceneitem_visible(current.item);if(hidden)obs_sceneitem_set_visible(current.item,true);if(!changed)refreshBrowser(current.source);if(changed||hidden)obs_frontend_save();obs_source_release(current.source);obs_source_release(sceneSource);result(dtr("dock.sourceChecked")+sceneName);return;}
  Search global{url};
  obs_enum_sources([](void *data,obs_source_t *s){auto &x=*static_cast<Search*>(data);if(managed(s)||urlMatches(s,x.url)){x.source=obs_source_get_ref(s);return false;}return true;},&global);
  auto *source=global.source;
  if(!source){
   auto *s=obs_data_create();obs_data_set_string(s,"url",url.constData());obs_data_set_int(s,"width",1920);obs_data_set_int(s,"height",1080);
   obs_data_set_bool(s,"is_local_file",false);obs_data_set_bool(s,"shutdown",false);obs_data_set_bool(s,"restart_when_active",false);obs_data_set_bool(s,"reroute_audio",true);obs_data_set_bool(s,"pssa_control_dock",true);
   QByteArray name="PSSA - Alerty";int i=2;while(auto *existing=obs_get_source_by_name(name.constData())){obs_source_release(existing);name="PSSA - Alerty "+QByteArray::number(i++);}
   source=obs_source_create("browser_source",name.constData(),s,nullptr);obs_data_release(s);
  }else if(managed(source)){repairManagedUrl(source,url);}
  if(!source){obs_source_release(sceneSource);result(dtr("dock.sourceFailed"));return;}
  auto *item=obs_scene_add(scene,source);
  if(item){obs_video_info info{};if(obs_get_video_info(&info)){vec2 scale;const auto w=obs_source_get_width(source),h=obs_source_get_height(source);vec2_set(&scale,static_cast<float>(info.base_width)/static_cast<float>(w?w:1920),static_cast<float>(info.base_height)/static_cast<float>(h?h:1080));obs_sceneitem_set_scale(item,&scale);}obs_frontend_save();}
  obs_source_release(source);obs_source_release(sceneSource);result(item?dtr("dock.sourceAdded")+sceneName:dtr("dock.addFailed"));
 }
 void refreshSources(){
  if(!online||!validOverlay(overlay)){result(dtr("dock.badOverlay"));return;}
  struct Refresh {QByteArray url;int count=0;bool changed=false;};
  Refresh r{overlay.toUtf8()};
  obs_enum_sources([](void *data,obs_source_t *s){
   auto &r=*static_cast<Refresh*>(data);
   if(managed(s)){const bool changed=repairManagedUrl(s,r.url);r.changed|=changed;if(changed||refreshBrowser(s))r.count++;}
   else if(urlMatches(s,r.url)&&refreshBrowser(s))r.count++;
   return true;
  },&r);
  if(r.changed)obs_frontend_save();
  result(r.count?dtr("dock.refreshed")+QString::number(r.count):dtr("dock.missingSource"));
 }
public:
 Dock(){
  dockLanguage=preferredLanguage();
  auto *layout=new QVBoxLayout(this);layout->setContentsMargins(8,8,8,8);layout->setSpacing(6);
  auto *logo=new QLabel("PSSA",this);logo->setAlignment(Qt::AlignCenter);logo->setStyleSheet("font-size:24px;font-weight:700;color:#e3c048;");layout->addWidget(logo);
  status=new QLabel(dtr("dock.checking"),this);status->setAlignment(Qt::AlignCenter);status->setWordWrap(true);layout->addWidget(status);
  auto *grid=new QGridLayout;grid->setSpacing(5);layout->addLayout(grid);
  startButton=new QPushButton(dtr("dock.start"),this);stopButton=new QPushButton(dtr("dock.stop"),this);restartButton=new QPushButton(dtr("dock.restart"),this);showButton=new QPushButton(dtr("dock.show"),this);
  grid->addWidget(startButton,0,0);grid->addWidget(stopButton,0,1);grid->addWidget(restartButton,1,0);grid->addWidget(showButton,1,1);
  more=new QToolButton(this);more->setText(dtr("dock.more"));more->setCheckable(true);more->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);more->setArrowType(Qt::DownArrow);more->setSizePolicy(QSizePolicy::Expanding,QSizePolicy::Preferred);layout->addWidget(more);
  extra=new QWidget(this);auto *x=new QVBoxLayout(extra);x->setContentsMargins(0,4,0,0);x->setSpacing(6);
  volumeLabel=new QLabel("100%",extra);x->addWidget(new QLabel(dtr("dock.volume"),extra));x->addWidget(volumeLabel);
  volume=new QSlider(Qt::Horizontal,extra);volume->setRange(0,100);volume->setValue(100);x->addWidget(volume);
  mute=new QCheckBox(dtr("dock.mute"),extra);x->addWidget(mute);
  sceneCaption=new QLabel(dtr("dock.activeScene"),extra);x->addWidget(sceneCaption);sceneLabel=new QLabel(extra);sceneLabel->setWordWrap(true);x->addWidget(sceneLabel);
  addButton=new QPushButton(dtr("dock.add"),extra);refreshButton=new QPushButton(dtr("dock.refresh"),extra);testButton=new QPushButton(dtr("dock.test"),extra);
  x->addWidget(addButton);x->addWidget(refreshButton);x->addWidget(testButton);
  details=new QLabel(extra);details->setWordWrap(true);x->addWidget(details);
  operationLabel=new QLabel(this);operationLabel->setWordWrap(true);operationLabel->hide();layout->insertWidget(2,operationLabel);
  autoStart=new QCheckBox(dtr("dock.autoStart"),extra);autoClose=new QCheckBox(dtr("dock.autoClose"),extra);
  autoStart->setChecked(settings.value("autoStart",false).toBool());autoClose->setChecked(settings.value("autoClose",false).toBool());x->addWidget(autoStart);x->addWidget(autoClose);
  auto *languageChoice=new QComboBox(extra);languageChoice->addItem(dtr("dock.follow"),"auto");languageChoice->addItem("Polski","pl");languageChoice->addItem("English","en");languageChoice->addItem("Deutsch","de");
  languageChoice->setCurrentIndex(qMax(0,languageChoice->findData(settings.value("language","auto"))));x->addWidget(new QLabel(dtr("dock.language"),extra));x->addWidget(languageChoice);
  connect(languageChoice,&QComboBox::currentIndexChanged,this,[this,languageChoice](int){settings.setValue("language",languageChoice->currentData());settings.sync();result(dtr("dock.restartLanguage"));});
  extraScroll=new QScrollArea(this);extraScroll->setWidgetResizable(true);extraScroll->setFrameShape(QFrame::NoFrame);extraScroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);extraScroll->setWidget(extra);extraScroll->setMinimumHeight(80);extraScroll->hide();layout->addWidget(extraScroll,1);
  connect(more,&QToolButton::toggled,this,[this](bool b){extraScroll->setVisible(b);more->setText(b?dtr("dock.less"):dtr("dock.more"));more->setArrowType(b?Qt::UpArrow:Qt::DownArrow);});
  connect(startButton,&QPushButton::clicked,this,[this](){launch();});connect(stopButton,&QPushButton::clicked,this,[this](){stop(false);});connect(restartButton,&QPushButton::clicked,this,[this](){stop(true);});connect(showButton,&QPushButton::clicked,this,[this](){send("show");});
  connect(addButton,&QPushButton::clicked,this,[this](){addSource();});connect(refreshButton,&QPushButton::clicked,this,[this](){refreshSources();});connect(testButton,&QPushButton::clicked,this,[this](){send("test");});
  volumeTimer.setSingleShot(true);volumeTimer.setInterval(160);connect(volume,&QSlider::valueChanged,this,[this](int v){volumeLabel->setText(QString::number(v)+"%");volumeTimer.start();});connect(&volumeTimer,&QTimer::timeout,this,[this](){send("volume",volume->value());});
  connect(mute,&QCheckBox::toggled,this,[this](bool v){send("mute",v);});
  connect(autoStart,&QCheckBox::toggled,this,[this](bool v){settings.setValue("autoStart",v);settings.sync();});connect(autoClose,&QCheckBox::toggled,this,[this](bool v){settings.setValue("autoClose",v);settings.sync();});
  timer.setInterval(1500);connect(&timer,&QTimer::timeout,this,[this](){updateScene();checkDeadline();send("status");if(!autoAttempted){autoAttempted=true;if(autoStart->isChecked()&&!online&&!processAlive(descriptor().value("pid").toInt()))launch();}});
  controls();updateScene();timer.start();send("status");
 }
 void obsExit(){
  timer.stop();if(!autoClose->isChecked())return;
  const auto d=descriptor();if(!validDescriptor(d))return;
  QLocalSocket s;s.connectToServer(d.value("pipe").toString());if(s.waitForConnected(200)){s.write(request(d,"quit"));s.flush();if(s.bytesToWrite()>0)s.waitForBytesWritten(200);if(!s.bytesAvailable())s.waitForReadyRead(200);}
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
