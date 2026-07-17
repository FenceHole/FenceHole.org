// Nessie Orb — a small always-on-top window that floats over everything and
// loads the live Nessie from the Hub. Summon or hide her from anywhere with
// Cmd+Shift+N (Mac) / Ctrl+Shift+N (Windows/Linux).
//
// Run:  cd desktop && npm install && npm start

const { app, BrowserWindow, globalShortcut, shell } = require('electron')

const NESSIE_URL = process.env.NESSIE_URL || 'https://fencehole.org/hq/nessie'

let win = null

function createWindow () {
  win = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 320,
    minHeight: 420,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#08080f',
    webPreferences: { contextIsolation: true },
  })

  // Float above full-screen apps and follow across desktops/spaces.
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.loadURL(NESSIE_URL)

  // The window is frameless, so inject a slim drag bar with hide/quit controls.
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (function () {
        if (document.getElementById('nessie-orb-bar')) return
        var bar = document.createElement('div')
        bar.id = 'nessie-orb-bar'
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:30px;z-index:99999;' +
          'display:flex;align-items:center;justify-content:space-between;padding:0 10px;' +
          'background:rgba(8,8,15,.92);border-bottom:1px solid rgba(240,180,41,.25);' +
          '-webkit-app-region:drag;-webkit-user-select:none;user-select:none;' +
          'font:700 10px -apple-system,sans-serif;letter-spacing:2px;color:#f0b429'
        bar.innerHTML =
          '<span>\\u25C8 NESSIE</span>' +
          '<span style="-webkit-app-region:no-drag;cursor:pointer;color:#8888aa;font-size:14px;' +
          'letter-spacing:0" onclick="window.close()" title="Hide (Cmd/Ctrl+Shift+N brings her back)">\\u2715</span>'
        document.body.appendChild(bar)
        document.body.style.paddingTop = '30px'
      })()
    `).catch(() => {})
  })

  // Any external link opens in the normal browser, not inside the orb.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  createWindow()
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (!win) return createWindow()
    if (win.isVisible()) win.hide()
    else { win.show(); win.focus() }
  })
})

// Keep running in the background so the hotkey can re-summon her (macOS style).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => { if (!win) createWindow() })

app.on('will-quit', () => globalShortcut.unregisterAll())
