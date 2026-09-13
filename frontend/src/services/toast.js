const listeners = new Set();
let nextId = 1;

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(msg, type = "success") {
  const id = nextId++;
  listeners.forEach((listener) => listener({ id, msg, type }));
  return id;
}
toast.success = (message) => toast(message, "success");
toast.error = (message) => toast(message, "error");
toast.info = (message) => toast(message, "info");
