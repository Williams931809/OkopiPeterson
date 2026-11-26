(() => {
  const prefix = 'maisonpe-pending-order:'
  const keyOf = item => item.id + ':' + item.size
  function read(storage, key, fallback = null) {
    try { return JSON.parse(storage.getItem(key)) ?? fallback }
    catch { return fallback }
  }

  function remembered() {
    const orders = new Map()
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
      const order = read(localStorage, key)
      if (order?.order) orders.set(order.order, order)
    }
    const legacy = read(sessionStorage, 'maisonpe-checkout')
    if (legacy?.order && !orders.has(legacy.order)) orders.set(legacy.order, legacy)
    return orders
  }

  function settle(orderId) {
    const pending = remembered().get(orderId)
    if (!pending || localStorage.getItem('maisonpe-cleared-order:' + orderId)) return false
    let snapshot
    try { snapshot = JSON.parse(pending.bag) } catch { return false }
    if (!Array.isArray(snapshot)) return false
    const current = read(localStorage, 'okopiBag', [])
    if (!Array.isArray(current)) return false
    const purchased = new Map()
    for (const item of snapshot) {
      const key = keyOf(item)
      purchased.set(key, (purchased.get(key) ?? 0) + Number(item.qty || 0))
    }
    const next = current.map(item => {
      if (!purchased.has(keyOf(item))) return item
      return { ...item, qty: item.qty - purchased.get(keyOf(item)) }
    }).filter(item => item.qty > 0)
    localStorage.setItem('okopiBag', JSON.stringify(next))
    localStorage.setItem('maisonpe-cleared-order:' + orderId, '1')
    localStorage.removeItem(prefix + orderId)
    if (read(sessionStorage, 'maisonpe-checkout')?.order === orderId) {
      sessionStorage.removeItem('maisonpe-checkout')
    }
    document.dispatchEvent(new CustomEvent('maisonpe-cart-settled', { detail: next }))
    return true
  }

  window.maisonpeOrders = {
    save(order, bag) {
      localStorage.setItem(prefix + order, JSON.stringify({ order, bag }))
      localStorage.setItem('maisonpe-last-order', order)
    },
    latest() {
      return localStorage.getItem('maisonpe-last-order') ?? read(sessionStorage, 'maisonpe-checkout')?.order
    },
    settle,
    async reconcile() {
      for (const id of remembered().keys()) {
        if (!/^[a-f0-9-]{36}$/i.test(id)) continue
        try {
          const response = await fetch('/api/orders/' + encodeURIComponent(id))
          if (!response.ok) continue
          const { order } = await response.json()
          if (order.status === 'paid') settle(id)
          if (order.status === 'cancelled') localStorage.removeItem(prefix + id)
        } catch {
          // Retain the saved checkout for the next visit.
        }
      }
    },
  }
})()
