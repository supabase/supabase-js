// Native/browser WebSocket entry point
const NativeWebSocket = typeof WebSocket !== 'undefined' ? WebSocket : undefined

export default NativeWebSocket
