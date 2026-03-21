const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            const validChannels = [
                'capture:start', 'capture:stop', 'capture:getBuffer', 'capture:clear'
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        invoke: (channel, data) => {
            const validChannels = [
                'capture:start', 'capture:stop', 'capture:getBuffer', 'capture:clear', 
                'capture:event', 'capture:setTappyMode', 
                'buffer:getSnapshot', 'buffer:getCount', 'buffer:clear',
                'analysis:save', 'analysis:list',
                'session:save', 'session:load', 'session:list', 
                'session:delete', 'session:openFile', 'keyboard:getInfo'
            ];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
            return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
        },
        on: (channel, func) => {
            const validChannels = ['keystroke-count', 'keystroke-event', 'buffer:update'];
            if (validChannels.includes(channel)) {
                const subscription = (event, ...args) => func(event, ...args);
                ipcRenderer.on(channel, subscription);
                return () => ipcRenderer.removeListener(channel, subscription);
            }
        }
    }
});
