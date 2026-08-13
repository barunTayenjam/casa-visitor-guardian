(function () {
  var theme = localStorage.getItem('sentryvision-theme') || 'dark';
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.add(theme);
})();
