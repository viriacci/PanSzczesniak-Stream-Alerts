import type {Scene} from './scene.ts'
export type MediaKind='image'|'audio'|'video'
export interface Asset {id:string;name:string;folder:string;tags:string[];kind:MediaKind;bytes:number|null;missing:boolean;references:number}
export interface Profile {id:string;name:string;categoryId:string}
export interface SceneTemplate {id:string;name:string;scene:Scene}
export interface LibraryState {assets:Asset[];profiles:Profile[];activeProfile:string;templates:SceneTemplate[]}
export type LibraryAction=
 |{type:'asset-edit';id:string;name:string;folder:string;tags:string[]}
 |{type:'profile-create';name:string;categoryId:string}
 |{type:'profile-activate'|'profile-delete';id:string}
 |{type:'profile-edit';id:string;name:string;categoryId:string}
 |{type:'template-create';key:string;name:string}
 |{type:'template-save-draft';name:string;scene:Scene}
 |{type:'template-apply';id:string;key:string}
 |{type:'template-delete';id:string}
 |{type:'variant-save';key:string;id?:string;name:string;templateId:string;weight:number;minCount:number;maxCount:number|null;minMonths:number;categoryId:string}
 |{type:'variant-delete';key:string;id:string}
export const mediaKind=(id:string):MediaKind=>/\.(mp4|webm)$/i.test(id)?'video':/\.(mp3|wav|ogg|m4a)$/i.test(id)?'audio':'image'
