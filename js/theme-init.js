/* Apply the saved light/dark preference before first paint on every template. */
(function () {
  var root = document.documentElement;
  root.dataset.brand = 'editorial';
  root.dataset.accent = 'editorial';
  root.dataset.theme = 'light';
  try {
    if (localStorage.getItem('aa-theme') === 'dark') root.dataset.theme = 'dark';
  } catch (e) {}
})();
