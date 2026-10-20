//gets tournament lists by state
function getHub_() {
  const all = readMasterRows_();
  const buckets = { open: [], ongoing: [], completed: [] };

  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    if (t.state === TOURNAMENT_STATES.CANCELLED) continue;

    const item = {
      id: t.id,
      name: t.name,
      game: t.game,
      date: t.date || '',
      state: t.state,
      created: t.created
    };

    if (t.state === TOURNAMENT_STATES.REGISTRATION_OPEN)      buckets.open.push(item);
    else if (t.state === TOURNAMENT_STATES.BRACKET_GENERATED) buckets.ongoing.push(item);
    else if (t.state === TOURNAMENT_STATES.COMPLETED)         buckets.completed.push(item);
  }

  const byDateDesc = (a, b) => (b.created || '').localeCompare(a.created || '');
  buckets.open.sort(byDateDesc);
  buckets.ongoing.sort(byDateDesc);
  buckets.completed.sort(byDateDesc);

  return {
    isAppOwner: isAppOwner_(),
    open: buckets.open,
    ongoing: buckets.ongoing,
    completed: buckets.completed
  };
}