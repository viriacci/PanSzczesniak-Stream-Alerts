import {parseScene,type Scene} from './scene.ts'
export interface AlertVariant {id:string;name:string;weight:number;minCount:number;maxCount:number|null;minMonths:number;categoryId:string;scene:Scene}
export function parseVariants(value:unknown):AlertVariant[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>12)throw Error('Invalid variants')
 const ids=new Set<string>()
 const integer=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw Error('Invalid variant number');return v}
 return value.map(v=>{
  if(!v||typeof v!=='object'||typeof v.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(v.id)||ids.has(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||typeof v.categoryId!=='string'||!/^\d{0,30}$/.test(v.categoryId))throw Error('Invalid variant')
  ids.add(v.id)
  const minCount=integer(v.minCount,0,1000000),maxCount=v.maxCount===null?null:integer(v.maxCount,minCount,1000000)
  return {id:v.id,name:v.name,weight:integer(v.weight,1,1000),minCount,maxCount,minMonths:integer(v.minMonths,0,1200),categoryId:v.categoryId,scene:parseScene(v.scene)}
 })
}
export function pickVariant(variants:AlertVariant[],count:number,months:number,categoryId:string,random=Math.random){
 const eligible=variants.filter(v=>count>=v.minCount&&(v.maxCount===null||count<=v.maxCount)&&months>=v.minMonths&&(!v.categoryId||v.categoryId===categoryId))
 if(!eligible.length)return undefined
 const total=eligible.reduce((sum,v)=>sum+v.weight,0)
 let n=Math.max(0,Math.min(.999999999999,random()))*total
 for(const v of eligible){n-=v.weight;if(n<0)return v}
 return eligible.at(-1)
}
