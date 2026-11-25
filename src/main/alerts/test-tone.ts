import {createHash} from 'node:crypto'
import {defaultRule,type AlertRule} from '../../shared/alerts.ts'
const rate=24000,frames=18000
const wav=Buffer.alloc(44+frames*2)
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8)
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22)
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34)
wav.write('data',36);wav.writeUInt32LE(frames*2,40)
for(let i=0;i<frames;i++){
 const t=i/rate,env=Math.min(1,t/.025)*Math.max(0,1-t/.75)**2
 wav.writeInt16LE(Math.round(10500*env*(.72*Math.sin(2*Math.PI*660*t)+.28*Math.sin(2*Math.PI*990*t))),44+i*2)
}
export const testTone=wav
export const testToneName=createHash('sha256').update(wav).digest('hex')+'.wav'
export function queueTestRule():AlertRule{return {...defaultRule('reward:pssa-queue-test','Testowy alert'),enabled:true,audio:testToneName,duration:1,template:'Test PSSA • sprawdzenie głośności'}}
