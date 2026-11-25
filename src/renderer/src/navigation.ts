import type { PageId } from '../../shared/layout'
import type { IconName } from './components/icons'
export interface NavItem {id:PageId;label:string;icon:IconName;stage:number;description:string}
export const groups: {label:string;items:NavItem[]}[] = [
 {label:'Główne',items:[
 {id:'queue',label:'Kolejka',icon:'queue',stage:4,description:'Zarządzanie kolejnością, pauzą i odtwarzaniem alertów.'},
 {id:'rewards',label:'Nagrody Twitch',icon:'gift',stage:3,description:'Powiązania nagród za punkty kanału z alertami.'},
 {id:'alerts',label:'Alerty',icon:'bell',stage:3,description:'Konfiguracja zdarzeń Twitcha oraz wyglądu alertów.'},
 {id:'studio',label:'Kreator Alertów',icon:'studio',stage:7,description:'Warstwy, animacje, oś czasu i podgląd alertów.'}]},
 {label:'Dodatkowe',items:[
 {id:'profiles',label:'Profile i szablony',icon:'layers',stage:8,description:'Zestawy alertów oraz warianty przypisane do profili.'},
 {id:'library',label:'Biblioteka',icon:'folder',stage:8,description:'Zarządzanie obrazami, wideo i dźwiękami.'},
 {id:'dashboard',label:'Dashboard',icon:'dashboard',stage:2,description:'Stan aplikacji i najważniejsze informacje o transmisji.'}]},
 {label:'Analiza',items:[
 {id:'activity',label:'Aktywność',icon:'activity',stage:6,description:'Zdarzenia Twitcha, aktywność czatu i historia bieżącej sesji.'},
 {id:'analytics',label:'Analityka',icon:'chart',stage:9,description:'Porównania okresów 7, 14, 30 i 180 dni oraz import historii.'}]},
 {label:'Ustawienia',items:[
 {id:'integrations',label:'Konfiguracja',icon:'plug',stage:3,description:'Połączenie z Twitchem i OBS.'},
 {id:'diagnostics',label:'Diagnostyka',icon:'shield',stage:2,description:'Stan bazy danych oraz wersja aplikacji.'},
 {id:'documentation',label:'Dokumentacja',icon:'book',stage:2,description:'Informacje o projekcie i skróty klawiaturowe.'},
 {id:'settings',label:'Ustawienia',icon:'settings',stage:2,description:'Dopasuj aplikację do swojego stanowiska.'}]}
]
export const allPages=groups.flatMap(group=>group.items)
