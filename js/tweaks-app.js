/* Tweaks paneli — aksan rengi + koyu tema. AATheme ile senkron. */
function ThemeTweaks() {
  const [s, setS] = React.useState(window.AATheme.state());
  React.useEffect(function () {
    const h = function (e) { setS(e.detail); };
    window.addEventListener('aa-statechange', h);
    return function () { window.removeEventListener('aa-statechange', h); };
  }, []);

  return (
    React.createElement(TweaksPanel, { title: 'Tweaks' },
      React.createElement(TweakSection, { label: 'Aksan rengi' }),
      React.createElement(TweakColor, {
        label: 'Aksan',
        value: s.accent === 'terracotta' ? '#B85C3F' : '#1E3A5F',
        options: ['#1E3A5F', '#B85C3F'],
        onChange: function (v) { window.AATheme.setAccent(v === '#B85C3F' ? 'terracotta' : 'blue'); }
      }),
      React.createElement(TweakSection, { label: 'Görünüm' }),
      React.createElement(TweakToggle, {
        label: 'Koyu tema',
        value: s.theme === 'dark',
        onChange: function (v) { window.AATheme.setTheme(v ? 'dark' : 'light'); }
      })
    )
  );
}

(function () {
  var mount = document.getElementById('tweaks-root');
  if (mount && window.ReactDOM) {
    ReactDOM.createRoot(mount).render(React.createElement(ThemeTweaks));
  }
})();
