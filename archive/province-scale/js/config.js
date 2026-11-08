// Supabase connection for the browser (the shared Family project, same as Felix Maze).
// The publishable key is meant to be public. The xw_maps table only opens to the
// signed-in family account (row-level security), so this page cannot read or write it anonymously.
window.XW_CONFIG = {
  url: 'https://twvqvutrcobedvuhnzxq.supabase.co',
  key: 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo',
  timeoutMs: 8000
};
