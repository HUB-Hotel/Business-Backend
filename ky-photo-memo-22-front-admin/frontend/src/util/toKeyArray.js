export const toKeyArray=(val) =>{
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map(urlToKey).filter(Boolean);
}
