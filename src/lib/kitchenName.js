// "Osama" → "Osama's Kitchen", "James" → "James' Kitchen", no name → "My Kitchen".
// Uses the first name only so it fits under a home-screen icon.
export function kitchenParts(name) {
  const raw = String(name || '').trim().split(/\s+/)[0];
  const first = raw ? raw[0].toUpperCase() + raw.slice(1) : '';
  if (!first || first.toLowerCase() === 'my') return { owner: 'My', suffix: ' Kitchen' };
  return { owner: first, suffix: /s$/i.test(first) ? "' Kitchen" : "'s Kitchen" };
}

export function kitchenName(name) {
  const { owner, suffix } = kitchenParts(name);
  return owner + suffix;
}
