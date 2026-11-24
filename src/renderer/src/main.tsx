import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/base.scss'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')
const report=(kind:'error'|'rejection'|'react',error:unknown)=>{const stack=error instanceof Error?error.stack??'':'';void window.pssa.rendererFault(kind,stack.slice(0,8192)).catch(()=>{})}
window.addEventListener('error',e=>report('error',e.error))
window.addEventListener('unhandledrejection',e=>report('rejection',e.reason))
createRoot(root,{onUncaughtError:e=>report('react',e),onCaughtError:e=>report('react',e),onRecoverableError:e=>report('react',e)}).render(<App />)
