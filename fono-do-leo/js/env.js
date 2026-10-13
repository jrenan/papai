/* Development mode: local server (python3 -m http.server) or ?dev in the URL.
 * Enables the test shortcuts (?src=, ?screen=, ?ex=) and window.engine. */
const params = new URLSearchParams(location.search);

export const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const DEV = LOCAL || params.has('dev');
