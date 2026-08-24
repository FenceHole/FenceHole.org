// Nessie's Mac agent.
//
// The Hub runs in a datacenter and cannot reach this laptop, so this process
// polls outward and asks: "is there anything approved for me to do?"
//
// Safety model, in order:
//   1. Nessie can only ever REQUEST. Requests land as 'pending'.
//   2. A human approves each one in the Hub. Nothing else is ever executed.
//   3. This agent will only run the kinds listed in ALLOWED_KINDS below.
//   4. File access is confined to ALLOWED_DIRS.
//   5. Everything it does is printed here and written back as the result.
//
// Run:  cd desktop/mac-agent && NESSIE_AGENT_TOKEN=... node agent.js

const { execFile } = require('child_process')
const { promises: fs } = require('fs')
const os = require('os')
const path = require('path')

const HUB = process.env.NESSIE_HUB_URL || 'https://fencehole.org'
const TOKEN = process.env.NESSIE_AGENT_TOKEN
const POLL_MS = Number(process.env.NESSIE_POLL_MS || 5000)

// Turn a kind off by removing it from this list. Nothing outside it runs.
const ALLOWED_KINDS = new Set([
  'notify',      // a macOS notification
  'open_url',    // open a link in the default browser
  'open_app',    // launch an app by name
  'read_file',   // read a file inside ALLOWED_DIRS
  'write_file',  // write a file inside ALLOWED_DIRS
])

// File access is confined to these. Add more only if you mean it.
const ALLOWED_DIRS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents', 'Nessie'),
  path.join(os.homedir(), 'Downloads'),
]

if (!TOKEN) {
  console.error('NESSIE_AGENT_TOKEN is not set. Get it from the Hub and run:\n' +
    '  NESSIE_AGENT_TOKEN=xxxx node agent.js')
  process.exit(1)
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(String(stdout).trim())
    })
  })
}

function insideAllowedDir(target) {
  const resolved = path.resolve(target)
  return ALLOWED_DIRS.some((dir) => {
    const base = path.resolve(dir)
    return resolved === base || resolved.startsWith(base + path.sep)
  })
}

async function execute(cmd) {
  const { kind, payload = {} } = cmd

  if (!ALLOWED_KINDS.has(kind)) {
    throw new Error(`kind "${kind}" is not in this agent's allowlist`)
  }

  switch (kind) {
    case 'notify': {
      const text = String(payload.text || '').slice(0, 400)
      const title = String(payload.title || 'Nessie').slice(0, 100)
      // Passed as separate args, never interpolated into a shell string.
      await run('osascript', ['-e',
        'on run {t, m}\ndisplay notification m with title t\nend run', title, text])
      return `notified: ${text}`
    }
    case 'open_url': {
      const url = String(payload.url || '')
      if (!/^https?:\/\//i.test(url)) throw new Error('only http(s) URLs are allowed')
      await run('open', [url])
      return `opened ${url}`
    }
    case 'open_app': {
      const app = String(payload.app || '')
      if (!/^[\w .-]{1,60}$/.test(app)) throw new Error('invalid app name')
      await run('open', ['-a', app])
      return `launched ${app}`
    }
    case 'read_file': {
      const target = String(payload.path || '')
      if (!insideAllowedDir(target)) throw new Error(`path is outside the allowed folders`)
      const body = await fs.readFile(path.resolve(target), 'utf8')
      return body.slice(0, 8000)
    }
    case 'write_file': {
      const target = String(payload.path || '')
      if (!insideAllowedDir(target)) throw new Error(`path is outside the allowed folders`)
      const resolved = path.resolve(target)
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      await fs.writeFile(resolved, String(payload.content ?? ''), 'utf8')
      return `wrote ${resolved}`
    }
    default:
      throw new Error(`unhandled kind: ${kind}`)
  }
}

async function api(route, init = {}) {
  const res = await fetch(`${HUB}${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`${route} -> ${res.status} ${await res.text()}`)
  return res.json()
}

async function tick() {
  const { command } = await api('/api/machine/next')
  if (!command) return

  console.log(`\n▶ ${command.kind}`, JSON.stringify(command.payload))
  if (command.reason) console.log(`  reason: ${command.reason}`)

  let status = 'done'
  let result
  try {
    result = await execute(command)
    console.log(`  ✓ ${result.slice(0, 200)}`)
  } catch (err) {
    status = 'failed'
    result = err.message
    console.log(`  ✗ ${result}`)
  }

  await api('/api/machine/result', {
    method: 'POST',
    body: JSON.stringify({ id: command.id, status, result: String(result).slice(0, 4000) }),
  })
}

console.log(`Nessie Mac agent — watching ${HUB}`)
console.log(`Allowed: ${[...ALLOWED_KINDS].join(', ')}`)
console.log(`Files confined to:\n  ${ALLOWED_DIRS.join('\n  ')}`)
console.log('Only commands you approve in the Hub will run. Ctrl+C to stop.\n')

setInterval(() => {
  tick().catch((err) => console.error('poll error:', err.message))
}, POLL_MS)
