import {spawn} from 'node:child_process'
import {join} from 'node:path'
export function launchNodeAgent(directory:string,exe:string,args:string[],bundleDirectory:string,smoke=false,version='unknown'){
 // Packed main bundles are unpacked explicitly for plain Node's module loader.
 const entry=join(bundleDirectory.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'agent.js')
 const env={...process.env,ELECTRON_RUN_AS_NODE:'1'} as NodeJS.ProcessEnv;delete env.NODE_OPTIONS;delete env.NODE_PATH
 return spawn(exe,[entry,JSON.stringify({directory,exe,args,smoke,version})],{env,detached:!smoke,stdio:'ignore',windowsHide:true})
}
