const inFlightRequests = new Map();

export function runDedupedRequest(key, requestFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = Promise.resolve()
    .then(() => requestFn())
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}
