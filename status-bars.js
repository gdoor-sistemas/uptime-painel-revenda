// Barras diárias de disponibilidade nos cards da página de status.
// Verde = operacional, amarelo = desempenho degradado, vermelho = fora do ar.
// A situação de cada dia vem das issues de incidente que o Upptime abre (label "status" + slug do site).
(function () {
  var OWNER = 'enz0rd';
  var REPO = 'uptime-painel-revenda';
  var DAYS = 30;
  var DAY_MS = 86400000;
  var LABELS = { ok: 'Operacional', warn: 'Desempenho degradado', danger: 'Fora do ar', empty: 'Sem dados' };

  var cache = {};
  function once(key, load) {
    if (!cache[key]) cache[key] = load().catch(function () { delete cache[key]; return null; });
    return cache[key];
  }

  function getIncidents() {
    return once('issues', function () {
      return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/issues?state=all&labels=status&per_page=100')
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); });
    });
  }

  function getStartTime(slug) {
    return once('start:' + slug, function () {
      return fetch('https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/master/history/' + slug + '.yml')
        .then(function (res) { return res.text(); })
        .then(function (text) {
          var match = text.match(/^startTime:\s*(\S+)/m);
          return match ? new Date(match[1]).getTime() : null;
        });
    });
  }

  function dayStatus(dayStart, startTime, incidents) {
    var dayEnd = dayStart + DAY_MS;
    if (startTime && dayEnd <= startTime) return 'empty';
    var status = 'ok';
    incidents.forEach(function (issue) {
      var opened = new Date(issue.created_at).getTime();
      var closed = issue.closed_at ? new Date(issue.closed_at).getTime() : Date.now();
      if (opened >= dayEnd || closed <= dayStart) return;
      if (/degraded/i.test(issue.title)) { if (status === 'ok') status = 'warn'; } else status = 'danger';
    });
    return status;
  }

  function render(article) {
    var link = article.querySelector('a[href*="/history/"]');
    if (!link || article.querySelector('.g-bars')) return;
    var slug = link.getAttribute('href').split('/history/')[1].replace(/\/$/, '');
    var wrap = document.createElement('div');
    wrap.className = 'g-bars';
    article.appendChild(wrap);

    Promise.all([getIncidents(), getStartTime(slug)]).then(function (result) {
      var incidents = (result[0] || []).filter(function (issue) {
        return !issue.pull_request && issue.labels.some(function (label) { return label.name === slug; });
      });
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var bars = document.createElement('div');
      bars.className = 'g-bars__track';
      for (var i = DAYS - 1; i >= 0; i--) {
        var dayStart = today.getTime() - i * DAY_MS;
        var status = dayStatus(dayStart, result[1], incidents);
        var bar = document.createElement('span');
        bar.className = 'g-bar g-bar--' + status;
        bar.title = new Date(dayStart).toLocaleDateString('pt-BR') + ' · ' + LABELS[status];
        bars.appendChild(bar);
      }
      var axis = document.createElement('div');
      axis.className = 'g-bars__axis';
      axis.innerHTML = '<span>' + DAYS + ' dias atrás</span><span>Hoje</span>';
      wrap.appendChild(bars);
      wrap.appendChild(axis);
    });
  }

  function scan() {
    document.querySelectorAll('section.live-status article').forEach(render);
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
