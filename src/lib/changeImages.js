export function getChangeImage(name = '') {
  const value = String(name).toLowerCase();
  for (const model of ['apex', 'pocket', 'twin', 'bell', 'hammer']) {
    if (value.includes(model)) return `/change-machine/${model}-icon.png`;
  }
  return '/change-machine/generic.png';
}
