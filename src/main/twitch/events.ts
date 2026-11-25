import type { AlertEvent } from '../../shared/alerts.ts'
export function subscriptions(id:string) {
 return [
 {type:'channel.follow',version:'2',condition:{broadcaster_user_id:id,moderator_user_id:id}},
 {type:'channel.raid',version:'1',condition:{to_broadcaster_user_id:id}},
 {type:'channel.cheer',version:'1',condition:{broadcaster_user_id:id}},
 {type:'channel.channel_points_custom_reward_redemption.add',version:'1',condition:{broadcaster_user_id:id}},
 {type:'channel.chat.notification',version:'1',condition:{broadcaster_user_id:id,user_id:id}},
 {type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:id,user_id:id}},
 {type:'stream.online',version:'1',condition:{broadcaster_user_id:id}},
 {type:'stream.offline',version:'1',condition:{broadcaster_user_id:id}}
 ]
}
const name=(v:unknown)=>typeof v==='string'&&v.length?v.slice(0,200):'Anonim'
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:0
export function normalizeEvent(id:string,type:string,e:any):AlertEvent|undefined {
 if(!id||!e||typeof e!=='object')return
 const user=name(e.user_name)
 switch(type){
 case 'channel.follow':return {id,kind:'follow',user}
 case 'channel.raid':return {id,kind:'raid',user:name(e.from_broadcaster_user_name),count:count(e.viewers)}
 case 'channel.cheer':return {id,kind:'bits',user:e.is_anonymous?'Anonim':user,count:count(e.bits)}
 case 'channel.channel_points_custom_reward_redemption.add':
  if(typeof e.reward?.id!=='string')return
  return {id,kind:'redemption',user,rewardId:e.reward.id,reward:name(e.reward.title)}
 case 'channel.chat.notification':{
  if(e.source_broadcaster_user_id&&e.source_broadcaster_user_id!==e.broadcaster_user_id)return
  const chatter=e.chatter_is_anonymous?'Anonim':name(e.chatter_user_name)
  switch(e.notice_type){
  case 'sub':return {id,kind:e.sub?.is_prime?'prime_sub':'sub',user:chatter}
  case 'resub':return {id,kind:'resub',user:chatter,months:count(e.resub?.cumulative_months)}
  case 'prime_paid_upgrade':return {id,kind:'sub',user:chatter}
  case 'gift_paid_upgrade':return {id,kind:'sub',user:chatter}
  case 'sub_gift':if(e.sub_gift?.community_gift_id)return;return {id,kind:'gift',user:chatter,count:1}
  case 'community_sub_gift':return {id,kind:'mass_gift',user:chatter,count:count(e.community_sub_gift?.total)}
  default:return
  }
 }
 }
}
