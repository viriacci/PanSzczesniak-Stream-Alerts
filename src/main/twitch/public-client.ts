// Public application identifier only. No client secret belongs in a desktop build.
export const publicClientId=typeof PSSA_TWITCH_CLIENT_ID==='string'&&/^[a-zA-Z0-9]{10,128}$/.test(PSSA_TWITCH_CLIENT_ID)?PSSA_TWITCH_CLIENT_ID:''
declare const PSSA_TWITCH_CLIENT_ID:string
