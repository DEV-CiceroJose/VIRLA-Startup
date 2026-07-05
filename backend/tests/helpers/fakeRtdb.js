/**
 * RTDB falso em memória p/ testar chatRealtimeService sem Firebase real.
 * Suporta só o subconjunto usado pelo serviço: ref(path).get()/set()/update()/push(),
 * e snapshots com exists()/val()/forEach(). update() usa chaves planas.
 */
export function makeFakeRtdb(seed = {}) {
  const store = structuredClone(seed)

  function nodeAt(path, create = false) {
    const keys = path.split('/')
    let node = store
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (node[k] == null || typeof node[k] !== 'object') {
        if (!create) return node[k]
        node[k] = {}
      }
      node = node[k]
    }
    return node
  }

  function setAt(path, value) {
    const keys = path.split('/')
    let node = store
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (node[k] == null || typeof node[k] !== 'object') node[k] = {}
      node = node[k]
    }
    node[keys[keys.length - 1]] = value
  }

  function snapshot(value) {
    return {
      exists: () => value != null,
      val: () => value,
      forEach: (cb) => {
        if (value && typeof value === 'object') {
          for (const [key, v] of Object.entries(value)) cb({ key, val: () => v })
        }
      },
    }
  }

  function ref(path) {
    return {
      async get() { return snapshot(nodeAt(path)) },
      async set(value) { setAt(path, value) },
      async update(patch) {
        const target = nodeAt(path, true)
        Object.assign(target, patch)
      },
      push() {
        const key = `msg_${Math.random().toString(36).slice(2, 10)}`
        return { key, async set(value) { setAt(`${path}/${key}`, value) } }
      },
    }
  }

  return { ref, __store: store }
}
