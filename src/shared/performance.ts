import type {PerformanceMode} from './runtime.ts'
export interface Sample {
 at:number;spanMs:number;mode:PerformanceMode;systemCpu:number|null;systemRamMB:number;appCpu:number|null;appRamMB:number;appProcesses:number;eventLoop:number|null;timerLateMs:number;
 gpu:number|null;gpuAt:number|null;agentCpu:number|null;agentRamMB:number|null;
 obsCpu:number|null;obsRamMB:number|null;obsFps:number|null;obsRenderSkipped:number|null;obsOutputSkipped:number|null;obsStreaming:boolean|null;obsRecording:boolean|null;
 queuePending:number;queuePlaying:boolean;done:number;failed:number;suppressed:number;retried:number;overlayClients:number;agentOnline:boolean;twitchPhase:string;obsPhase:string
}
export interface MeasurementHeader {id:string;version:string;startedAt:number;intervalMs:number;cores:number;ramMB:number;platform:string;arch:string;gpuEnabled:boolean}
export interface MetricSummary {mean:number|null;p95:number|null;peak:number|null;count:number}
export interface MeasurementSummary extends MeasurementHeader {status:'running'|'finished'|'interrupted'|'limit'|'error';endedAt:number|null;samples:number;durationMs:number;cpu:MetricSummary;ram:MetricSummary;systemCpu:MetricSummary;systemRam:MetricSummary;loop:MetricSummary;gpu:MetricSummary;agentCpu:MetricSummary;agentRam:MetricSummary;obsFps:MetricSummary;obsCpu:MetricSummary;obsRam:MetricSummary;timerLag:MetricSummary;queuePeak:number;obsRenderDelta:number|null;obsOutputDelta:number|null;done:number;failed:number;suppressed:number;retried:number}
export interface MeasurementState {active:MeasurementSummary|null;recent:MeasurementSummary[]}
export interface CrashEntry {at:string;version:string;process:string;event:string;reason:string;exitCode:number|null;frames:string[]}
