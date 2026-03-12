import type { APIRoute } from 'astro'

export const prerender = false

const widgetScript = `
(function() {
  'use strict';

  var API_BASE = 'https://www.kokomo.house/api/glossary';
  var STYLE_ID = 'kokomo-glossar-style';
  var TOOLTIP_ID = 'kokomo-glossar-tooltip';

  // Inject styles once
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.kokomo-glossar-term {',
      '  border-bottom: 1px dotted #2d6a4f;',
      '  cursor: help;',
      '  color: inherit;',
      '  text-decoration: none;',
      '  transition: border-color 0.2s;',
      '}',
      '.kokomo-glossar-term:hover {',
      '  border-bottom-color: #1b4332;',
      '}',
      '#' + TOOLTIP_ID + ' {',
      '  position: fixed;',
      '  max-width: 360px;',
      '  padding: 12px 16px;',
      '  background: #fff;',
      '  border: 1px solid #d4d4d4;',
      '  border-radius: 8px;',
      '  box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  color: #333;',
      '  z-index: 999999;',
      '  opacity: 0;',
      '  transform: translateY(4px);',
      '  transition: opacity 0.15s, transform 0.15s;',
      '  pointer-events: none;',
      '}',
      '#' + TOOLTIP_ID + '.visible {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',
      '#' + TOOLTIP_ID + ' strong {',
      '  display: block;',
      '  margin-bottom: 4px;',
      '  color: #1b4332;',
      '  font-size: 15px;',
      '}',
      '#' + TOOLTIP_ID + ' .kokomo-source {',
      '  display: block;',
      '  margin-top: 8px;',
      '  font-size: 11px;',
      '  color: #888;',
      '  text-decoration: none;',
      '}',
      '#' + TOOLTIP_ID + ' .kokomo-source:hover {',
      '  color: #2d6a4f;',
      '}',
    ].join('\\n');
    document.head.appendChild(style);
  }

  // Create tooltip element
  var tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  document.body.appendChild(tooltip);

  // Cache for fetched terms
  var cache = {};
  var hideTimeout;

  function showTooltip(el, data) {
    var maxDef = data.definition.length > 200
      ? data.definition.substring(0, 200).replace(/\\s+\\S*$/, '') + '...'
      : data.definition;
    tooltip.innerHTML =
      '<strong>' + escapeHtml(data.term) + '</strong>' +
      '<span>' + escapeHtml(maxDef) + '</span>' +
      '<a class="kokomo-source" href="' + escapeHtml(data.url) + '" target="_blank" rel="noopener">→ kokomo.house/glossar</a>';

    var rect = el.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left;

    // Keep within viewport
    if (left + 380 > window.innerWidth) left = window.innerWidth - 380;
    if (left < 8) left = 8;
    if (top + 200 > window.innerHeight) top = rect.top - 8 - tooltip.offsetHeight;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function fetchTerm(slug, callback) {
    if (cache[slug]) return callback(cache[slug]);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '?slug=' + encodeURIComponent(slug));
    xhr.onload = function() {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        cache[slug] = data;
        callback(data);
      }
    };
    xhr.send();
  }

  // Process elements with data-kokomo-glossar attribute
  function init() {
    var elements = document.querySelectorAll('[data-kokomo-glossar]');
    elements.forEach(function(el) {
      if (el.dataset.kokomoProcessed) return;
      el.dataset.kokomoProcessed = 'true';
      el.classList.add('kokomo-glossar-term');

      var slug = el.dataset.kokomoGlossar;

      el.addEventListener('mouseenter', function() {
        clearTimeout(hideTimeout);
        fetchTerm(slug, function(data) {
          showTooltip(el, data);
        });
      });

      el.addEventListener('mouseleave', function() {
        hideTimeout = setTimeout(hideTooltip, 200);
      });
    });
  }

  // Auto-highlight: scan page text for glossary terms
  function autoHighlight() {
    var container = document.querySelector('[data-kokomo-glossar-auto]');
    if (!container) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE);
    xhr.onload = function() {
      if (xhr.status !== 200) return;
      var data = JSON.parse(xhr.responseText);
      var terms = data.terms.sort(function(a, b) {
        return b.term.length - a.term.length;
      });

      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      var matched = new Set();
      textNodes.forEach(function(node) {
        if (node.parentElement.closest('[data-kokomo-glossar]')) return;
        if (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE') return;

        var text = node.textContent;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i];
          if (matched.has(t.slug)) continue;
          var idx = text.toLowerCase().indexOf(t.term.toLowerCase());
          if (idx === -1) continue;

          matched.add(t.slug);
          var before = document.createTextNode(text.substring(0, idx));
          var span = document.createElement('span');
          span.setAttribute('data-kokomo-glossar', t.slug);
          span.textContent = text.substring(idx, idx + t.term.length);
          var after = document.createTextNode(text.substring(idx + t.term.length));

          var parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(span, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          break;
        }
      });

      init();
    };
    xhr.send();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); autoHighlight(); });
  } else {
    init();
    autoHighlight();
  }
})();
`;

export const GET: APIRoute = async () => {
  return new Response(widgetScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
