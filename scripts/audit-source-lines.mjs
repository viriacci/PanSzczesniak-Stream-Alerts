import {readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
const checks=[
 ['dynamic-code',/\beval\s*\(|\bnew\s+Function\s*\(/],
 ['html-injection',/\b(?:innerHTML|outerHTML|dangerouslySetInnerHTML|insertAdjacentHTML)\b/],
 ['process-launch',/\b(?:spawn|execFile|execSync|execFileSync|Process\.Start|Start-Process)\b/],
 ['filesystem-mutation',/\b(?:rmSync|unlinkSync|renameSync|rmdirSync|Remove-Item|Directory\.Delete|File\.Delete|rm|unlink|rename)\s*\(/],
 ['network-boundary',/\b(?:fetch|createServer|WebSocket|request)\s*\(/],
 ['credential-boundary',/\b(?:client_secret|refresh_token|access_token|safeStorage|timingSafeEqual|Authorization)\b/],
 ['sql-boundary',/\b(?:prepare|exec)\s*\(/],
 ['timer-lifecycle',/\b(?:setInterval|setTimeout|requestAnimationFrame|ResizeObserver|MutationObserver)\s*\(/],
 ['renderer-sandbox',/\b(?:nodeIntegration|contextIsolation|webSecurity|sandbox)\s*:/]
]
const entries=[]
for(const path of files){
 if(!/^(src|setup|obs-dock|scripts|tests|\.github)\//.test(path)||!/\.(ts|tsx|js|mjs|cpp|h|cs|xaml|ps1|sh|yml|scss|html)$/.test(path)||path==='scripts/audit-source-lines.mjs')continue
 const bytes=readFileSync(path),lines=bytes.toString('utf8').split(/\r?\n/)
 const findings=[]
 for(let i=0;i<lines.length;i++)for(const [rule,pattern] of checks)if(pattern.test(lines[i]))findings.push({line:i+1,rule})
 entries.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),lines:lines.length,findings})
}
writeFileSync('audit-source-lines.json',JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),notice:'Mechanical triage, not a manual audit or proof of security.',entries},null,2))
console.log(JSON.stringify({sourceFiles:entries.length,lines:entries.reduce((n,e)=>n+e.lines,0),reviewPoints:entries.reduce((n,e)=>n+e.findings.length,0)}))
