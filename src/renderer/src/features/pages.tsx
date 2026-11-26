import {useLocale} from '../i18n'
import {NavigationSettings} from './navigation'
import type {Navigation} from '../../../shared/layout'
import {ThemeLogo} from '../components/ThemeLogo'
import {themes,themeIds} from '../../../shared/themes'
import {memo} from 'react'
import {RuntimeSettings,DiagnosticsPage} from './runtime'
import type {RuntimePreferences,UpdateInfo} from '../../../shared/runtime'
import {AnalyticsPage} from './analytics'
import {LibraryPage,ProfilesPage} from './library'
import {StudioPage} from './studio'
import {LiveCenter} from './live'
import type {LiveState} from '../../../shared/live'
import {ObsPage} from './obs'
import type {ObsState,AgentState} from '../../../shared/obs'
import { QueuePage } from './queue'
import { AlertsPage, TwitchPage, MigrationPanel, AdvancedTwitchLogin } from './alerts'
import type { AlertState } from '../../../shared/alerts'
import type { SystemStatus } from '../../../shared/contracts'
import type { LayoutPreferences } from '../../../shared/layout'
import type { NavItem } from '../navigation'
import { Button, Empty, Panel, Status, SettingsSection } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
const MemoAnalytics=memo(AnalyticsPage),MemoLibrary=memo(LibraryPage),MemoStudio=memo(StudioPage),MemoQueue=memo(QueuePage),MemoDiagnostics=memo(DiagnosticsPage)
type Props={update?:UpdateInfo;checkUpdate:()=>Promise<UpdateInfo>;openUpdate:()=>void;runtime?:RuntimePreferences;saveRuntime:(p:RuntimePreferences)=>Promise<RuntimePreferences>;live?:LiveState;obs?:ObsState;agent?:AgentState;alertState?:AlertState;item:NavItem;status?:SystemStatus;layout:LayoutPreferences;busy:boolean;onCompact:()=>void;onReset:()=>void;onLayout:(v:Partial<LayoutPreferences>)=>void;onNavigation:(v:Navigation)=>void;editingMenu:boolean;onEditMenu:()=>void;onIntegrations:()=>void}
export function PageContent({update,checkUpdate,openUpdate,runtime,saveRuntime,live,obs,agent,alertState,item,status,layout,busy,onCompact,onReset,onLayout,onNavigation,editingMenu,onEditMenu,onIntegrations}:Props) {
 const {t}=useLocale()
 if(item.id==='dashboard')return <><LiveCenter state={live} obs={obs} pending={alertState?.queue.pendingCount??null} onIntegrations={onIntegrations}/><Panel title={t("dashboard.recent")}>{alertState?.queue.history.length?alertState.queue.history.slice(0,4).map(x=><div className="setting-row" key={x.id}><span>{x.text}</span><small className="muted">{t("queue.status."+x.status)}</small></div>):<Empty title={t("dashboard.noEvents")}>{t("dashboard.eventsEmpty")}</Empty>}</Panel></>
 if(item.id==='analytics')return <MemoAnalytics/>
 if(item.id==='library')return <MemoLibrary base={alertState?.twitch.overlayUrl??''} lowPower={runtime?.mode==='streaming'}/>
 if(item.id==='profiles')return <ProfilesPage alerts={alertState} live={live}/>
 if(item.id==='studio')return <MemoStudio state={alertState}/>
 if(item.id==='settings')return <>
  <NavigationSettings navigation={layout.navigation} onChange={onNavigation} editing={editingMenu} onEdit={onEditMenu}/>
  <SettingsSection title={t("settings.appearance")}>
   <div className="setting-row"><div><h3>{t("settings.compact")}</h3><p>{t("settings.compactDetail")}</p></div><Button role="switch" aria-checked={status?.compact??false} disabled={!status||busy} onClick={onCompact}>{status?.compact?t("common.enabled"):t("common.disabled")}</Button></div>
   <div className="setting-row"><div><h3>{t("settings.inspector")}</h3><p>{t("settings.inspectorDetail")}</p></div><Button role="switch" aria-checked={layout.inspectorOpen} disabled={busy} onClick={()=>onLayout({inspectorOpen:!layout.inspectorOpen})}>{layout.inspectorOpen?t("common.enabled"):t("common.disabled")}</Button></div>
   <div className="setting-row"><div><h3>{t("settings.panelSize")}</h3><p>{t("settings.panelSizes",{menu:layout.sidebarWidth,inspector:layout.inspectorWidth})}</p></div><Button disabled={busy} onClick={onReset}>{t("settings.resetLayout")}</Button></div>
  </SettingsSection>
  {runtime&&<RuntimeSettings runtime={runtime} save={saveRuntime} update={update} checkUpdate={checkUpdate} openUpdate={openUpdate}/>}
  {runtime&&<SettingsSection title={t("settings.themes")}><div className="theme-grid">{themeIds.map(id=>{const theme=themes[id];return <button type="button" className="theme-choice" key={id} aria-pressed={runtime.theme===id} disabled={busy} onClick={()=>void saveRuntime({...runtime,theme:id}).catch(()=>window.alert(t("settings.themeError")))}><div className="theme-preview" data-preview={id} style={{background:theme.colors[0],color:id==='vivionyx'?'#f2efed':theme.colors[2],borderColor:id==='vivionyx'?theme.colors[1]:theme.colors[2]}}><ThemeLogo theme={id} className="theme-mark"/><strong>{theme.name}</strong><div className="theme-swatches">{theme.colors.map(c=><i key={c} style={{background:c}}/>)}</div></div><strong>{runtime.theme===id?t("settings.activeTheme"):t("common.select")}</strong></button>})}</div></SettingsSection>}
  <SettingsSection title={t("settings.advancedLogin")}><AdvancedTwitchLogin state={alertState}/></SettingsSection>
 </>
 if(item.id==='diagnostics')return <MemoDiagnostics/>
 if(item.id==='documentation')return <><Panel title={t("docs.shortcuts")}><dl className="details"><dt>Ctrl + B</dt><dd>{t("docs.toggleMenu")}</dd><dt>Ctrl + I</dt><dd>{t("settings.inspector")}</dd><dt>Ctrl + ,</dt><dd>{t("docs.settings")}</dd><dt>{t("docs.arrowKeys")}</dt><dd>{t("docs.resize")}</dd><dt>Esc</dt><dd>{t("docs.closeDialog")}</dd></dl></Panel><Panel title={t("docs.guide")}><p>{t("docs.guideDetail")}</p></Panel></>
 if(item.id==='queue'||item.id==='activity')return <MemoQueue state={alertState?.queue}/>
 if(item.id==='integrations')return <><TwitchPage state={alertState}/><ObsPage obs={obs} agent={agent}/><MigrationPanel/></>
 if(item.id==='alerts'||item.id==='rewards')return <AlertsPage key={item.id+':'+(alertState?.profileId??'default')} state={alertState} rewards={item.id==='rewards'}/>
 return <Panel title={item.label} action={<Status>{t("docs.stage",{stage:item.stage})}</Status>}><Empty title={t("docs.preparing")}>{item.description} {t("docs.unavailable")}</Empty></Panel>
}
