export function parseCommand(text) {
  const value = text.trim().toLowerCase();
  return /^!(armor|legs|chaos)$/.test(value) ? value.slice(1) : null;
}
