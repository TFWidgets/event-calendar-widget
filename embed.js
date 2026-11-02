/*!
 * TF Widgets — Event Calendar v1
 * Встраивание: <script src=".../embed.js" data-id="CLIENT_ID"></script>
 * Конфиг клиента: configs/CLIENT_ID.json
 * Календарь событий: список ближайших событий и календарь на месяц, повторяющиеся события
 * (каждую неделю / раз в две недели / каждый месяц), фильтр по категориям, кнопка-ссылка
 * (билеты, регистрация) и «Добавить в календарь» (Google Calendar и файл .ics для Apple / Outlook).
 * Прошедшие события скрываются сами. Время событий — время заведения (часовой пояс из конфига).
 * Виджет встаёт на место тега <script>. Все стили ограничены классом .bhw-ev.
 */
(function () {
    'use strict';
    var VERSION = '1.0.0';
    var LOG = '[TFW Events]';
    // Где работает живое превью BHWEvents.render() (конфигуратор на сайте)
    var PREVIEW_DOMAINS = ['tf-widgets.com', '*.tf-widgets.com', '9ac5za-h1.myshopify.com'];
    var MAX_EVENTS = 80;
    var HORIZON_DAYS = 400;          // повторы считаем не дальше чем на ~13 месяцев вперёд
    var CAT_COLORS = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];

    var ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5z"/></svg>';
    var ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 3v4.6l3.2 1.9-1 1.7L11 12.7V7h2z"/></svg>';
    var ICON_CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 2v2h8V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2h2zm12 8H4v10h16V10zm-9 2v4H7v-4h4z"/></svg>';
    var ICON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>';
    var ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.6 18.6 10 20l8-8-8-8-1.4 1.4 6.6 6.6z"/></svg>';
    var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>';
    var ICON_REPEAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 1l4 4-4 4V6H7a3 3 0 0 0-3 3v2H2V9a5 5 0 0 1 5-5h10V1zM7 23l-4-4 4-4v3h10a3 3 0 0 0 3-3v-2h2v2a5 5 0 0 1-5 5H7v3z"/></svg>';

    var inlineCSS = `
        .bhw-ev { font-family: var(--bhw-font, 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif); -webkit-font-smoothing: antialiased;
            display: block; position: relative; width: 100%; max-width: var(--bhw-max, 880px); margin: 0 auto; padding: var(--bhw-pad, 24px);
            background: var(--bhw-bg, #ffffff); color: var(--bhw-text, #1f2937); border-radius: var(--bhw-r, 18px);
            line-height: 1.45; font-size: 15px; text-align: left; box-sizing: border-box; }
        .bhw-ev *, .bhw-ev *::before, .bhw-ev *::after { box-sizing: border-box; }
        .bhw-ev svg { width: 1em; height: 1em; flex: none; }
        .bhw-ev .bhw-ev-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 16px; margin: 0 0 16px; }
        .bhw-ev .bhw-ev-head.bhw-c { justify-content: center; text-align: center; }
        .bhw-ev .bhw-ev-h { margin: 0; padding: 0; font-size: 26px; font-weight: 800; line-height: 1.2; letter-spacing: -.01em; color: inherit; }
        .bhw-ev .bhw-ev-sub { margin: 4px 0 0; font-size: 15px; opacity: .7; color: inherit; }
        .bhw-ev .bhw-ev-views { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--bhw-line, rgba(0,0,0,.12)); border-radius: 999px; }
        .bhw-ev .bhw-ev-vb { margin: 0; padding: 7px 14px; min-height: 0; border: 0; border-radius: 999px; background: transparent; box-shadow: none; color: inherit;
            font: inherit; font-size: 13.5px; font-weight: 600; line-height: 1.2; cursor: pointer; }
        .bhw-ev .bhw-ev-vb.bhw-on { background: var(--bhw-accent, #2563eb); color: var(--bhw-accent-text, #fff); }

        /* фильтр по категориям */
        .bhw-ev .bhw-ev-cats { display: flex; gap: 6px; margin: 0 0 14px; padding: 2px 2px 6px; overflow-x: auto; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .bhw-ev .bhw-ev-cat { flex: none; display: inline-flex; align-items: center; gap: 7px; margin: 0; padding: 7px 13px; min-height: 0; border: 1px solid var(--bhw-line, rgba(0,0,0,.12));
            border-radius: 999px; background: transparent; box-shadow: none; color: inherit; font: inherit; font-size: 13.5px; font-weight: 600; white-space: nowrap; cursor: pointer; }
        .bhw-ev .bhw-ev-cat i { width: 8px; height: 8px; border-radius: 50%; background: var(--c, currentColor); }
        .bhw-ev .bhw-ev-cat.bhw-on { background: var(--bhw-accent, #2563eb); border-color: var(--bhw-accent, #2563eb); color: var(--bhw-accent-text, #fff); }
        .bhw-ev .bhw-ev-cat.bhw-on i { background: currentColor; }

        /* список */
        .bhw-ev .bhw-ev-month-h { margin: 18px 0 10px; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .6; color: inherit; }
        .bhw-ev .bhw-ev-list > .bhw-ev-month-h:first-child { margin-top: 0; }
        .bhw-ev .bhw-ev-items { display: grid; gap: 10px; }
        .bhw-ev .bhw-ev-card { position: relative; display: flex; gap: 16px; align-items: flex-start; margin: 0; padding: 14px; border-radius: calc(var(--bhw-r, 18px) * .7);
            background: var(--bhw-card, #f4f6fb); }
        .bhw-ev .bhw-ev-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 0 3px 3px 0; background: var(--c, transparent); }
        .bhw-ev .bhw-ev-date { flex: none; width: 58px; padding: 7px 0 8px; border-radius: 12px; text-align: center; background: var(--bhw-bg-solid, #fff); border: 1px solid var(--bhw-line, rgba(0,0,0,.08)); }
        .bhw-ev .bhw-ev-dm { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--bhw-accent, #2563eb); line-height: 1.2; }
        .bhw-ev .bhw-ev-dd { display: block; font-size: 24px; font-weight: 800; line-height: 1.1; color: inherit; }
        .bhw-ev .bhw-ev-dw { display: block; font-size: 11.5px; opacity: .6; line-height: 1.2; color: inherit; }
        .bhw-ev .bhw-ev-body { flex: 1 1 auto; min-width: 0; }
        .bhw-ev .bhw-ev-title { margin: 1px 0 0; font-size: 17px; font-weight: 700; line-height: 1.3; color: inherit; overflow-wrap: anywhere; }
        .bhw-ev .bhw-ev-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 5px 0 0; font-size: 13.5px; opacity: .78; color: inherit; }
        .bhw-ev .bhw-ev-meta span { display: inline-flex; align-items: center; gap: 5px; }
        .bhw-ev .bhw-ev-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
        .bhw-ev .bhw-ev-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.3;
            background: color-mix(in srgb, var(--c, #2563eb) 14%, transparent); color: var(--c, #2563eb); }
        .bhw-ev .bhw-ev-badge.bhw-plain { background: var(--bhw-line, rgba(0,0,0,.08)); color: inherit; }
        .bhw-ev .bhw-ev-badge.bhw-sold { background: var(--bhw-text, #1f2937); color: var(--bhw-bg-solid, #fff); }
        .bhw-ev .bhw-ev-desc { margin: 8px 0 0; font-size: 14px; line-height: 1.5; opacity: .78; color: inherit; overflow-wrap: anywhere; white-space: pre-line;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .bhw-ev .bhw-ev-card.bhw-open .bhw-ev-desc { display: block; -webkit-line-clamp: unset; overflow: visible; }
        .bhw-ev .bhw-ev-more { margin: 4px 0 0; padding: 0; min-height: 0; border: 0; background: none; box-shadow: none; color: var(--bhw-accent, #2563eb); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
        .bhw-ev .bhw-ev-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0 0; }
        .bhw-ev .bhw-ev-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; margin: 0; padding: 9px 16px; min-height: 0; border: 1px solid transparent; border-radius: 999px;
            background: var(--bhw-accent, #2563eb); color: var(--bhw-accent-text, #fff); font: inherit; font-size: 14px; font-weight: 700; line-height: 1.2; text-decoration: none; cursor: pointer; box-shadow: none; }
        .bhw-ev .bhw-ev-btn:hover { filter: brightness(1.06); }
        .bhw-ev .bhw-ev-btn.bhw-ghost { background: transparent; color: inherit; border-color: var(--bhw-line, rgba(0,0,0,.14)); }
        .bhw-ev .bhw-ev-btn.bhw-ghost:hover { border-color: var(--bhw-accent, #2563eb); filter: none; }
        .bhw-ev .bhw-ev-btn:focus-visible, .bhw-ev .bhw-ev-vb:focus-visible, .bhw-ev .bhw-ev-cat:focus-visible, .bhw-ev .bhw-ev-day:focus-visible, .bhw-ev .bhw-ev-nav:focus-visible { outline: 3px solid var(--bhw-accent, #2563eb); outline-offset: 2px; }
        .bhw-ev .bhw-ev-add { position: relative; }
        .bhw-ev .bhw-ev-menu { position: absolute; left: 0; top: calc(100% + 6px); z-index: 20; display: none; min-width: 210px; padding: 6px; border-radius: 12px;
            background: var(--bhw-bg-solid, #fff); color: var(--bhw-text, #1f2937); border: 1px solid var(--bhw-line, rgba(0,0,0,.12)); box-shadow: 0 12px 32px rgba(0,0,0,.16); }
        .bhw-ev .bhw-ev-add.bhw-open .bhw-ev-menu { display: grid; }
        .bhw-ev .bhw-ev-menu.bhw-up { top: auto; bottom: calc(100% + 6px); }
        .bhw-ev .bhw-ev-menu a { display: block; padding: 9px 12px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; color: inherit; cursor: pointer; }
        .bhw-ev .bhw-ev-menu a:hover, .bhw-ev .bhw-ev-menu a:focus-visible { background: var(--bhw-card, #f4f6fb); outline: none; }
        .bhw-ev .bhw-ev-img { flex: none; width: 132px; aspect-ratio: 4 / 3; border-radius: calc(var(--bhw-r, 18px) * .5); overflow: hidden; background: var(--bhw-line, rgba(0,0,0,.08)); }
        .bhw-ev .bhw-ev-img img { width: 100% !important; height: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; object-fit: cover; display: block; }
        .bhw-ev .bhw-ev-showmore { display: block; margin: 14px auto 0; }
        .bhw-ev .bhw-ev-empty { margin: 18px 0; padding: 22px; text-align: center; border-radius: calc(var(--bhw-r, 18px) * .7); background: var(--bhw-card, #f4f6fb); opacity: .85; font-size: 15px; color: inherit; }
        .bhw-ev .bhw-ev-tz { margin: 14px 0 0; font-size: 12px; opacity: .55; text-align: center; color: inherit; }

        /* месяц */
        .bhw-ev .bhw-ev-cal-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; }
        .bhw-ev .bhw-ev-cal-t { margin: 0; font-size: 18px; font-weight: 800; color: inherit; text-transform: capitalize; }
        .bhw-ev .bhw-ev-cal-nav { display: flex; align-items: center; gap: 6px; }
        .bhw-ev .bhw-ev-nav { display: grid; place-items: center; width: 34px; height: 34px; margin: 0; padding: 0; min-height: 0; border: 1px solid var(--bhw-line, rgba(0,0,0,.12)); border-radius: 50%;
            background: transparent; box-shadow: none; color: inherit; font-size: 18px; cursor: pointer; }
        .bhw-ev .bhw-ev-nav[disabled] { opacity: .3; cursor: default; }
        .bhw-ev .bhw-ev-today { width: auto; padding: 0 12px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; }
        .bhw-ev .bhw-ev-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
        .bhw-ev .bhw-ev-wd { padding: 2px 0 6px; font-size: 12px; font-weight: 700; text-align: center; opacity: .55; text-transform: uppercase; letter-spacing: .04em; color: inherit; }
        .bhw-ev .bhw-ev-day { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 3px; min-width: 0; min-height: 86px; margin: 0; padding: 6px; border: 1px solid transparent;
            border-radius: 10px; background: var(--bhw-card, #f4f6fb); box-shadow: none; color: inherit; font: inherit; text-align: left; cursor: pointer; overflow: hidden; }
        .bhw-ev .bhw-ev-day.bhw-out { background: transparent; opacity: .45; }
        .bhw-ev .bhw-ev-day.bhw-past .bhw-ev-dn { opacity: .5; }
        .bhw-ev .bhw-ev-day.bhw-sel { border-color: var(--bhw-accent, #2563eb); box-shadow: 0 0 0 2px var(--bhw-accent-soft, rgba(37,99,235,.2)); }
        .bhw-ev .bhw-ev-dn { font-size: 13px; font-weight: 700; line-height: 1; color: inherit; }
        .bhw-ev .bhw-ev-day.bhw-now .bhw-ev-dn { display: inline-grid; place-items: center; width: 24px; height: 24px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--bhw-accent, #2563eb); color: var(--bhw-accent-text, #fff); }
        .bhw-ev .bhw-ev-chip { display: block; padding: 2px 6px; border-radius: 6px; font-size: 11.5px; font-weight: 600; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            background: color-mix(in srgb, var(--c, #2563eb) 16%, transparent); color: inherit; border-left: 3px solid var(--c, #2563eb); }
        .bhw-ev .bhw-ev-plus { font-size: 11.5px; font-weight: 700; opacity: .6; color: inherit; }
        .bhw-ev .bhw-ev-dots { display: none; justify-content: center; gap: 3px; margin-top: auto; }
        .bhw-ev .bhw-ev-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--c, #2563eb); }
        .bhw-ev.bhw-narrow .bhw-ev-day { min-height: 46px; align-items: center; padding: 6px 2px; }
        .bhw-ev.bhw-narrow .bhw-ev-chip, .bhw-ev.bhw-narrow .bhw-ev-plus { display: none; }
        .bhw-ev.bhw-narrow .bhw-ev-dots { display: flex; }
        .bhw-ev.bhw-narrow .bhw-ev-day.bhw-now .bhw-ev-dn { margin: -4px 0 0; }
        .bhw-ev .bhw-ev-dayp { margin: 16px 0 0; }
        .bhw-ev .bhw-ev-dayp-h { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: inherit; }

        @media (max-width: 560px) {
            .bhw-ev { padding: var(--bhw-pad-m, 16px); }
            .bhw-ev .bhw-ev-h { font-size: 22px; }
            .bhw-ev .bhw-ev-card { gap: 12px; padding: 12px; }
            .bhw-ev .bhw-ev-date { width: 52px; }
            .bhw-ev .bhw-ev-dd { font-size: 21px; }
        }
        .bhw-ev.bhw-narrow .bhw-ev-card { flex-wrap: wrap; }
        .bhw-ev.bhw-narrow .bhw-ev-img { order: -1; width: 100%; aspect-ratio: 16 / 9; }
        .bhw-ev.bhw-narrow .bhw-ev-body { flex-basis: calc(100% - 70px); }
        @media (prefers-reduced-motion: reduce) { .bhw-ev, .bhw-ev * { transition: none !important; } }

        /* защита от тем сайта, которые красят текст и кнопки через !important */
        .bhw-ev :where(.bhw-ev-h, .bhw-ev-sub, .bhw-ev-month-h, .bhw-ev-dd, .bhw-ev-dw, .bhw-ev-title, .bhw-ev-meta, .bhw-ev-meta *, .bhw-ev-desc, .bhw-ev-empty, .bhw-ev-tz,
            .bhw-ev-cal-t, .bhw-ev-wd, .bhw-ev-dn, .bhw-ev-chip, .bhw-ev-plus, .bhw-ev-dayp-h) { color: var(--bhw-text, #1f2937) !important; }
        .bhw-ev .bhw-ev-dm, .bhw-ev .bhw-ev-more { color: var(--bhw-accent, #2563eb) !important; }
        .bhw-ev .bhw-ev-btn { color: var(--bhw-accent-text, #fff) !important; background: var(--bhw-accent, #2563eb) !important; text-decoration: none !important; }
        .bhw-ev .bhw-ev-btn.bhw-ghost { color: var(--bhw-text, #1f2937) !important; background: transparent !important; }
        .bhw-ev :is(.bhw-ev-vb, .bhw-ev-cat, .bhw-ev-nav) { color: var(--bhw-text, #1f2937) !important; background: transparent !important; }
        .bhw-ev :is(.bhw-ev-vb, .bhw-ev-cat).bhw-on { color: var(--bhw-accent-text, #fff) !important; background: var(--bhw-accent, #2563eb) !important; }
        .bhw-ev .bhw-ev-day { color: var(--bhw-text, #1f2937) !important; background: var(--bhw-card, #f4f6fb) !important; }
        .bhw-ev .bhw-ev-day.bhw-out { background: transparent !important; }
        .bhw-ev .bhw-ev-day.bhw-now .bhw-ev-dn { color: var(--bhw-accent-text, #fff) !important; }
        .bhw-ev .bhw-ev-badge { color: var(--c, #2563eb) !important; }
        .bhw-ev .bhw-ev-badge.bhw-plain { color: var(--bhw-text, #1f2937) !important; }
        .bhw-ev .bhw-ev-badge.bhw-sold { color: var(--bhw-bg-solid, #fff) !important; }
        .bhw-ev .bhw-ev-menu a { color: var(--bhw-text, #1f2937) !important; text-decoration: none !important; }
        .bhw-ev :where(h3, h4, p, span, b, button, strong, a) { font-family: inherit !important; letter-spacing: normal; text-transform: none; }
        .bhw-ev :is(.bhw-ev-month-h, .bhw-ev-dm, .bhw-ev-wd) { text-transform: uppercase !important; }
        .bhw-ev .bhw-ev-month-h, .bhw-ev .bhw-ev-dm { letter-spacing: .06em !important; }
    `;

    /* =========================================================
       ПУБЛИЧНЫЕ API
       ========================================================= */
    window.BusinessHoursWidgets = window.BusinessHoursWidgets || {};
    window.BusinessHoursWidgets.events = window.BusinessHoursWidgets.events || {};

    // Живое превью для конфигуратора: BHWEvents.render(container, config) -> { update, destroy, el }
    var api = window.BHWEvents = window.BHWEvents || {};
    api.version = VERSION;
    api.defaults = getDefaultConfig;
    api.checkAccess = bhwCheckAccess;
    api.occurrences = function (cfg) { var c = normalizeConfig(cfg || {}); return expand(c, todayInfo(c).key, addDays(todayInfo(c).key, HORIZON_DAYS)); };
    api.calendarLinks = function (ev, cfg) { var c = normalizeConfig(cfg || {}); return { google: googleUrl(ev, c), ics: icsText(ev, c) }; };
    api.render = function (container, config) {
        var noop = { destroy: function () {}, update: function () {}, el: null };
        if (!bhwCheckAccess({ domains: PREVIEW_DOMAINS }).ok) { console.warn(LOG, 'preview is only available on tf-widgets.com'); return noop; }
        injectBaseStyles();
        if (container._bhwEvDestroy) container._bhwEvDestroy();
        var cls = container.__bhwEvClass || (container.__bhwEvClass = 'bhw-ev-preview-' + Math.random().toString(36).slice(2, 8));
        var widget = null;
        var ctrl = {
            el: null,
            update: function (cfg) {
                var state = widget ? widget.state() : null;
                if (widget) widget.destroy();
                widget = mountWidget(normalizeConfig(cfg || {}), cls, 'preview', { inline: container, state: state });
                ctrl.el = widget.root;
            },
            setView: function (v) { if (widget) widget.setView(v); },
            destroy: function () { if (widget) widget.destroy(); widget = null; ctrl.el = null; container._bhwEvDestroy = null; }
        };
        ctrl.update(config);
        container._bhwEvDestroy = ctrl.destroy;
        return ctrl;
    };

    /* =========================================================
       АВТОЗАПУСК ПО <script data-id="..."> (только свой тег)
       ========================================================= */
    try {
        var currentScript = document.currentScript || (function () {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
        })();
        if (currentScript && currentScript.dataset && currentScript.dataset.id && currentScript.dataset.bhwMounted !== '1') {
            currentScript.dataset.bhwMounted = '1';
            var debug = currentScript.dataset.debug === '1';
            var clientId = normalizeId(currentScript.dataset.id);
            var baseUrl = getBasePath(currentScript.src);
            loadConfig(clientId, baseUrl)
                .then(function (fetched) {
                    var access = bhwCheckAccess(fetched);
                    if (!access.ok) {
                        console.warn(LOG, 'widget "' + clientId + '" is not active on ' + (location.hostname || 'this page') + ': ' + access.reason);
                        return;
                    }
                    var cfg = normalizeConfig(fetched);
                    if (debug) console.log(LOG, 'config "' + clientId + '":', cfg);
                    injectBaseStyles();
                    var mount = function () {
                        var w = mountWidget(cfg, 'bhw-ev-' + clientId.replace(/[^a-z0-9_-]/gi, '') + '-' + Date.now(), clientId, { anchor: currentScript });
                        window.BusinessHoursWidgets.events[clientId] = w;
                    };
                    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
                })
                .catch(function (error) {
                    console.warn(LOG, 'config "' + clientId + '" not loaded:', error.message);
                });
        }
    } catch (error) {
        console.error(LOG, 'critical error:', error);
    }

    /* =========================================================
       ФУНКЦИИ
       ========================================================= */
    function injectBaseStyles() {
        if (!document.getElementById('tfw-events-styles')) {
            var style = document.createElement('style');
            style.id = 'tfw-events-styles';
            style.textContent = inlineCSS;
            (document.head || document.documentElement).appendChild(style);
        }
    }

    /* ---------------------------------------------------------
       ДОСТУП (общий блок для всех виджетов TF Widgets — копировать без изменений)
       --------------------------------------------------------- */
    function bhwCheckAccess(config) {
        config = config || {};
        if (config.active === false) return { ok: false, reason: 'widget is switched off ("active": false)' };
        var host = String(location.hostname || '').toLowerCase().replace(/^www\./, '');
        if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return { ok: true };
        var list = config.domains;
        if (typeof list === 'string') list = list.split(/[\s,]+/);
        if (!Array.isArray(list) || !list.length) return { ok: false, reason: 'no "domains" in config' };
        for (var i = 0; i < list.length; i++) {
            var d = String(list[i] || '').trim().toLowerCase()
                .replace(/^[a-z]+:\/\//, '').replace(/[\/:].*$/, '').replace(/^www\./, '');
            if (!d) continue;
            if (d.indexOf('*.') === 0) {
                var base = d.slice(2);
                if (host === base || host.slice(-(base.length + 1)) === '.' + base) return { ok: true };
            } else if (host === d) {
                return { ok: true };
            }
        }
        return { ok: false, reason: 'domain is not in "domains"' };
    }

    function normalizeId(id) { return String(id || 'demo').replace(/\.(json|js)$/i, ''); }
    function getBasePath(src) {
        if (!src) return './';
        try { var url = new URL(src, location.href); return url.origin + url.pathname.replace(/\/[^\/]*$/, '/'); }
        catch (error) { return './'; }
    }
    function loadConfig(clientId, baseUrl) {
        if (clientId === 'local') {
            var el = document.querySelector('#bhw-ev-local-config');
            if (!el) return Promise.reject(new Error('#bhw-ev-local-config not found'));
            try { return Promise.resolve(JSON.parse(el.textContent)); } catch (e) { return Promise.reject(e); }
        }
        var url = baseUrl + 'configs/' + encodeURIComponent(clientId) + '.json?v=' + Date.now();
        return fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    function getDefaultConfig() {
        return {
            heading: 'Upcoming events',
            subheading: '',
            view: 'list',                  // какой вид открыт первым: list | month
            views: 'both',                 // both | list | month — что может выбрать посетитель
            lang: 'en',                    // язык дат (названия месяцев и дней)
            weekStart: 1,                  // 1 — понедельник, 0 — воскресенье
            timeFormat: '24',              // 24 | 12
            timezone: '',                  // часовой пояс заведения, например Europe/Prague
            showTimezone: false,
            listLimit: 6,                  // сколько событий показать сразу (дальше — кнопка «Show more»)
            groupByMonth: true,
            filter: true,                  // фильтр по категориям, если их 2 и больше
            addToCalendar: true,
            events: [],                    // [{ title, date, end, allDay, start, finish, location, desc, image, link, linkText, cat, price, soldOut, repeat, until }]
            labels: {
                list: 'List', month: 'Month', all: 'All', today: 'Today', allDay: 'All day', more: 'More', less: 'Less',
                showMore: 'Show more events', noEvents: 'No upcoming events right now. Check back soon.', noDay: 'No events on this day.',
                addToCalendar: 'Add to calendar', button: 'Details', soldOut: 'Sold out', free: 'Free',
                weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', times: 'Times shown in'
            },
            style: {
                fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
                colors: { background: '#ffffff', text: '#1f2937', card: '#f4f6fb', accent: '#2563eb', accentText: '#ffffff' },
                sizes: { maxWidth: 880, radius: 18 }
            }
        };
    }

    function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
    function isDateKey(s) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
        var p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
        return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
    }
    function isTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }
    function validTz(tz) {
        if (!tz) return false;
        try { new Intl.DateTimeFormat('en', { timeZone: tz }).format(0); return true; } catch (e) { return false; }
    }
    function safeHttps(url) { var u = String(url || '').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
    function safeLink(url) {
        var u = String(url || '').trim();
        if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;
        if (/^mailto:[^\s"'<>]+$/i.test(u) || /^tel:[+\d\s()-]+$/i.test(u)) return u;
        return '';
    }
    function normalizeConfig(raw) {
        raw = raw || {};
        var evs = Array.isArray(raw.events) ? raw.events : [];
        var cfg = mergeDeep(getDefaultConfig(), raw);
        cfg.view = cfg.view === 'month' ? 'month' : 'list';
        cfg.views = ['both', 'list', 'month'].indexOf(cfg.views) >= 0 ? cfg.views : 'both';
        if (cfg.views !== 'both') cfg.view = cfg.views;
        cfg.weekStart = Number(cfg.weekStart) === 0 ? 0 : 1;
        cfg.timeFormat = String(cfg.timeFormat) === '12' ? '12' : '24';
        cfg.timezone = validTz(cfg.timezone) ? cfg.timezone : '';
        cfg.lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(cfg.lang || '') ? cfg.lang : 'en';
        cfg.listLimit = Math.min(50, Math.max(1, Math.round(num(cfg.listLimit, 6))));
        cfg.events = evs.slice(0, MAX_EVENTS).map(function (e, i) {
            e = e || {};
            var date = isDateKey(e.date) ? e.date : '';
            var end = isDateKey(e.end) && e.end > date ? e.end : '';
            var start = isTime(e.start) ? e.start : '';
            var finish = isTime(e.finish) ? e.finish : '';
            var allDay = e.allDay === true || !start;
            var repeat = ['weekly', 'biweekly', 'monthly'].indexOf(e.repeat) >= 0 ? e.repeat : '';
            return {
                i: i,
                title: str(e.title, 100),
                date: date, end: repeat ? '' : end,
                allDay: allDay, start: allDay ? '' : start, finish: allDay ? '' : finish,
                location: str(e.location, 140),
                desc: str(e.desc, 600),
                image: safeHttps(e.image),
                link: safeLink(e.link),
                linkText: str(e.linkText, 30),
                cat: str(e.cat, 30),
                price: str(e.price, 30),
                soldOut: e.soldOut === true,
                repeat: repeat,
                until: repeat && isDateKey(e.until) && e.until >= date ? e.until : ''
            };
        }).filter(function (e) { return e.title && e.date; });
        var cats = [];
        cfg.events.forEach(function (e) { if (e.cat && cats.indexOf(e.cat) < 0) cats.push(e.cat); });
        cfg._cats = cats;
        cfg.style.sizes.maxWidth = Math.min(1400, Math.max(320, num(cfg.style.sizes.maxWidth, 880)));
        cfg.style.sizes.radius = Math.min(32, Math.max(0, num(cfg.style.sizes.radius, 18)));
        return cfg;
    }

    function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
    function mergeDeep(base, over) {
        var out = {};
        Object.keys(base || {}).forEach(function (k) { out[k] = isObj(base[k]) ? mergeDeep(base[k], {}) : base[k]; });
        Object.keys(over || {}).forEach(function (k) {
            var v = over[k];
            if (isObj(v) && isObj(out[k])) out[k] = mergeDeep(out[k], v);
            else if (v !== undefined) out[k] = v;
        });
        return out;
    }
    function cssValue(v, fallback) { if (v === undefined || v === null || v === '') return fallback; return String(v).replace(/[;{}<>]/g, ''); }
    function num(v, fallback) { var n = Number(v); return isFinite(n) && v !== '' && v !== null ? n : fallback; }
    function escapeHtml(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        if (!/^[0-9a-f]{6}$/i.test(h)) return null;
        var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function isDark(hex) {
        var c = hexToRgb(hex); if (!c) return false;
        return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.5;
    }
    function rgba(hex, a) { var c = hexToRgb(hex); return c ? 'rgba(' + c.join(',') + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; }

    /* ---------- даты (всё считаем строками YYYY-MM-DD в часовом поясе заведения) ---------- */
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function keyToUTC(k) { var p = k.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
    function utcToKey(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
    function addDays(k, n) { return utcToKey(keyToUTC(k) + n * 86400000); }
    function dayDiff(a, b) { return Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000); }
    function weekday(k) { return new Date(keyToUTC(k)).getUTCDay(); }
    function addMonthsKey(k, n) {
        var p = k.split('-').map(Number), y = p[0], m = p[1] - 1 + n;
        y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
        var dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        if (p[2] > dim) return null;   // 31-е число в коротком месяце — пропускаем
        return y + '-' + pad(m + 1) + '-' + pad(p[2]);
    }
    function partsIn(ms, tz) {
        var o = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
        if (tz) o.timeZone = tz;
        var r = {};
        new Intl.DateTimeFormat('en-US', o).formatToParts(new Date(ms)).forEach(function (p) { r[p.type] = p.value; });
        return { key: r.year + '-' + r.month + '-' + r.day, time: (r.hour === '24' ? '00' : r.hour) + ':' + r.minute };
    }
    function todayInfo(cfg) {
        var now = Date.now();
        var p = partsIn(now, cfg.timezone);
        return { key: p.key, time: p.time, ms: now };
    }
    // «настенное» время заведения → момент UTC (для ссылок в календарь)
    function wallToUTC(k, t, tz) {
        var p = k.split('-').map(Number), hm = (t || '00:00').split(':').map(Number);
        var guess = Date.UTC(p[0], p[1] - 1, p[2], hm[0], hm[1]);
        if (!tz) return new Date(p[0], p[1] - 1, p[2], hm[0], hm[1]).getTime();
        var off = function (ms) { var q = partsIn(ms, tz), a = q.key.split('-').map(Number), b = q.time.split(':').map(Number); return Date.UTC(a[0], a[1] - 1, a[2], b[0], b[1]) - ms; };
        var ms = guess - off(guess);
        return guess - off(ms);
    }

    // все даты событий в окне [from, to]
    function expand(cfg, from, to) {
        var out = [];
        cfg.events.forEach(function (e) {
            var span = e.end ? dayDiff(e.date, e.end) : 0;
            var push = function (k) {
                var endKey = addDays(k, span);
                if (endKey < from || k > to) return;
                out.push({ ev: e, key: k, endKey: endKey });
            };
            if (!e.repeat) { push(e.date); return; }
            var last = e.until && e.until < to ? e.until : to;
            var limit = 0;
            if (e.repeat === 'monthly') {
                for (var n = 0; limit < 400; n++, limit++) {
                    var k = addMonthsKey(e.date, n);
                    if (k === null) continue;
                    if (k > last) break;
                    push(k);
                }
            } else {
                var step = e.repeat === 'weekly' ? 7 : 14;
                var k2 = e.date;
                if (k2 < from) k2 = addDays(k2, Math.floor(dayDiff(k2, from) / step) * step);
                for (; k2 <= last && limit < 400; k2 = addDays(k2, step), limit++) push(k2);
            }
        });
        out.sort(function (a, b) {
            if (a.key !== b.key) return a.key < b.key ? -1 : 1;
            var ta = a.ev.allDay ? '' : a.ev.start, tb = b.ev.allDay ? '' : b.ev.start;
            if (ta !== tb) return ta < tb ? -1 : 1;
            return a.ev.i - b.ev.i;
        });
        return out;
    }
    // событие ещё не закончилось?
    function notOver(o, today) {
        if (o.endKey > today.key) return true;
        if (o.endKey < today.key) return false;
        if (o.ev.allDay) return true;
        var endT = o.ev.finish || o.ev.start;
        if (!o.ev.finish) return true;              // без времени окончания — показываем весь день
        return endT > today.time;
    }

    function fmt(cfg, k, opts) {
        try { return new Intl.DateTimeFormat(cfg.lang, Object.assign({ timeZone: 'UTC' }, opts)).format(new Date(keyToUTC(k))); }
        catch (e) { return k; }
    }
    function fmtTime(cfg, t) {
        if (!t) return '';
        if (cfg.timeFormat !== '12') return t;
        var hm = t.split(':').map(Number), h = hm[0] % 12 || 12;
        return h + (hm[1] ? ':' + pad(hm[1]) : '') + (hm[0] < 12 ? ' am' : ' pm');
    }
    function timeText(o, cfg) {
        var e = o.ev, L = cfg.labels;
        var range = '';
        if (o.endKey !== o.key) {
            range = fmt(cfg, o.key, { day: 'numeric', month: 'short' }) + ' – ' + fmt(cfg, o.endKey, { day: 'numeric', month: 'short' });
            if (!e.allDay) range += ', ' + fmtTime(cfg, e.start) + (e.finish ? ' – ' + fmtTime(cfg, e.finish) : '');
            return range;
        }
        if (e.allDay) return L.allDay || 'All day';
        return fmtTime(cfg, e.start) + (e.finish ? ' – ' + fmtTime(cfg, e.finish) : '');
    }
    function catColor(cfg, cat) {
        var i = cfg._cats.indexOf(cat);
        return i < 0 ? cssValue(cfg.style.colors.accent, '#2563eb') : CAT_COLORS[i % CAT_COLORS.length];
    }

    /* ---------- «Добавить в календарь» ---------- */
    function stamp(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    function eventSpan(o, cfg) {
        var e = o.ev, tz = cfg.timezone;
        if (e.allDay) return { allDay: true, s: o.key.replace(/-/g, ''), e: addDays(o.endKey, 1).replace(/-/g, '') };
        var s = wallToUTC(o.key, e.start, tz);
        var en = e.finish ? wallToUTC(o.endKey, e.finish, tz) : s + 3600000;
        if (en <= s) en = wallToUTC(addDays(o.endKey, 1), e.finish, tz);   // заканчивается после полуночи
        return { allDay: false, s: stamp(s), e: stamp(en) };
    }
    function plainDesc(o) { return [o.ev.desc, o.ev.link].filter(Boolean).join('\n\n'); }
    function googleUrl(o, cfg) {
        if (!o.ev) o = { ev: o, key: o.date, endKey: o.end || o.date };
        var sp = eventSpan(o, cfg);
        var q = 'action=TEMPLATE&text=' + encodeURIComponent(o.ev.title) + '&dates=' + sp.s + '/' + sp.e;
        var d = plainDesc(o); if (d) q += '&details=' + encodeURIComponent(d.slice(0, 900));
        if (o.ev.location) q += '&location=' + encodeURIComponent(o.ev.location);
        return 'https://calendar.google.com/calendar/render?' + q;
    }
    function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function icsFold(line) {
        var out = [], s = line;
        while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
        out.push(s);
        return out.join('\r\n');
    }
    function icsText(o, cfg) {
        if (!o.ev) o = { ev: o, key: o.date, endKey: o.end || o.date };
        var sp = eventSpan(o, cfg);
        var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TF Widgets//Event Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
            'UID:' + o.key.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 10) + '@tf-widgets.com',
            'DTSTAMP:' + stamp(Date.now()),
            sp.allDay ? 'DTSTART;VALUE=DATE:' + sp.s : 'DTSTART:' + sp.s,
            sp.allDay ? 'DTEND;VALUE=DATE:' + sp.e : 'DTEND:' + sp.e,
            'SUMMARY:' + icsEsc(o.ev.title)];
        if (o.ev.location) lines.push('LOCATION:' + icsEsc(o.ev.location));
        var d = plainDesc(o); if (d) lines.push('DESCRIPTION:' + icsEsc(d));
        if (/^https?:/.test(o.ev.link)) lines.push('URL:' + o.ev.link);
        lines.push('END:VEVENT', 'END:VCALENDAR');
        return lines.map(icsFold).join('\r\n') + '\r\n';
    }
    function downloadIcs(o, cfg) {
        var text = icsText(o, cfg);
        var name = (o.ev.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';
        try {
            var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = name + '.ics'; a.rel = 'noopener';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        } catch (e) {
            window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(text), '_blank');
        }
    }

    function applyCustomStyles(uniqueClass, cfg) {
        var id = 'bhw-ev-style-' + uniqueClass;
        var el = document.getElementById(id);
        if (!el) { el = document.createElement('style'); el.id = id; (document.head || document.documentElement).appendChild(el); }
        var s = cfg.style || {}, c = s.colors || {}, z = s.sizes || {};
        var bg = cssValue(c.background, '');
        var text = cssValue(c.text, '#1f2937');
        var accent = cssValue(c.accent, '#2563eb');
        var solid = hexToRgb(bg) ? bg : (isDark(text) ? '#ffffff' : '#111111');
        el.textContent = '.' + uniqueClass + '{' +
            '--bhw-font:' + cssValue(s.fontFamily, "'Inter', system-ui, sans-serif") + ';' +
            '--bhw-bg:' + (bg || 'transparent') + ';' +
            '--bhw-bg-solid:' + solid + ';' +
            '--bhw-pad:' + (bg ? '24px' : '0px') + ';' +
            '--bhw-pad-m:' + (bg ? '16px' : '0px') + ';' +
            '--bhw-text:' + text + ';' +
            '--bhw-line:' + rgba(text, isDark(solid) ? .18 : .12) + ';' +
            '--bhw-card:' + cssValue(c.card, rgba(text, .05)) + ';' +
            '--bhw-accent:' + accent + ';' +
            '--bhw-accent-soft:' + rgba(accent, .2) + ';' +
            '--bhw-accent-text:' + cssValue(c.accentText, isDark(accent) ? '#ffffff' : '#111111') + ';' +
            '--bhw-max:' + num(z.maxWidth, 880) + 'px;' +
            '--bhw-r:' + num(z.radius, 18) + 'px;' +
            '}';
        return id;
    }

    function cardHtml(o, cfg, n) {
        var e = o.ev, L = cfg.labels, color = e.cat ? catColor(cfg, e.cat) : '';
        var rep = e.repeat ? (L[e.repeat] || '') : '';
        var meta = '<span>' + ICON_CLOCK + escapeHtml(timeText(o, cfg)) + '</span>' +
            (e.location ? '<span>' + ICON_PIN + escapeHtml(e.location) + '</span>' : '') +
            (rep ? '<span>' + ICON_REPEAT + escapeHtml(rep) + '</span>' : '');
        var badges = (e.cat ? '<span class="bhw-ev-badge" style="--c:' + color + '">' + escapeHtml(e.cat) + '</span>' : '') +
            (e.price ? '<span class="bhw-ev-badge bhw-plain">' + escapeHtml(e.price) + '</span>' : '') +
            (e.soldOut ? '<span class="bhw-ev-badge bhw-sold">' + escapeHtml(L.soldOut || 'Sold out') + '</span>' : '');
        var acts = (e.link && !e.soldOut ? '<a class="bhw-ev-btn" href="' + escapeHtml(e.link) + '" target="_blank" rel="noopener">' + escapeHtml(e.linkText || L.button || 'Details') + '</a>' : '') +
            (cfg.addToCalendar ? '<span class="bhw-ev-add"><button type="button" class="bhw-ev-btn bhw-ghost" data-act="add" aria-haspopup="true" aria-expanded="false">' + ICON_CAL + escapeHtml(L.addToCalendar || 'Add to calendar') + '</button>' +
                '<span class="bhw-ev-menu" role="menu"><a role="menuitem" href="' + escapeHtml(googleUrl(o, cfg)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
                '<a role="menuitem" href="#" data-act="ics">Apple / Outlook (.ics)</a></span></span>' : '');
        return '<article class="bhw-ev-card" data-o="' + n + '"' + (color ? ' style="--c:' + color + '"' : '') + '>' +
            '<div class="bhw-ev-date"><span class="bhw-ev-dm">' + escapeHtml(fmt(cfg, o.key, { month: 'short' }).replace('.', '')) + '</span>' +
                '<span class="bhw-ev-dd">' + Number(o.key.slice(8)) + '</span>' +
                '<span class="bhw-ev-dw">' + escapeHtml(fmt(cfg, o.key, { weekday: 'short' }).replace('.', '')) + '</span></div>' +
            '<div class="bhw-ev-body"><h4 class="bhw-ev-title">' + escapeHtml(e.title) + '</h4>' +
                '<div class="bhw-ev-meta">' + meta + '</div>' +
                (badges ? '<div class="bhw-ev-badges">' + badges + '</div>' : '') +
                (e.desc ? '<p class="bhw-ev-desc">' + escapeHtml(e.desc) + '</p><button type="button" class="bhw-ev-more" data-act="more" hidden>' + escapeHtml(L.more || 'More') + '</button>' : '') +
                (acts ? '<div class="bhw-ev-acts">' + acts + '</div>' : '') +
            '</div>' +
            (e.image ? '<span class="bhw-ev-img"><img alt="" loading="lazy" src="' + escapeHtml(e.image) + '"></span>' : '') +
            '</article>';
    }

    function mountWidget(cfg, uniqueClass, id, opts) {
        opts = opts || {};
        var inline = opts.inline || null;
        var styleId = applyCustomStyles(uniqueClass, cfg);
        var L = cfg.labels || {};
        var st = opts.state || {};
        var today = todayInfo(cfg);
        var view = st.view && (cfg.views === 'both' || cfg.views === st.view) ? st.view : cfg.view;
        var catSel = st.cat && cfg._cats.indexOf(st.cat) >= 0 ? st.cat : '';
        var shown = cfg.listLimit;
        var monthKey = st.month || today.key.slice(0, 7) + '-01';
        var selDay = st.day || '';
        var occ = [];        // текущий набор дат на экране (для кликов)
        var all = expand(cfg, addDays(today.key, -400), addDays(today.key, HORIZON_DAYS));

        var root = document.createElement('div');
        root.id = 'tfw-events-' + id;
        root.className = 'bhw-ev ' + uniqueClass;

        if (inline) inline.appendChild(root);
        else if (opts.anchor && opts.anchor.parentNode) opts.anchor.parentNode.insertBefore(root, opts.anchor.nextSibling);
        else document.body.appendChild(root);

        var cleanups = [];
        function on(t, e, h, o) { t.addEventListener(e, h, o); cleanups.push(function () { t.removeEventListener(e, h, o); }); }

        function filtered(list) { return catSel ? list.filter(function (o) { return o.ev.cat === catSel; }) : list; }

        function headHtml() {
            var views = cfg.views === 'both' ? '<div class="bhw-ev-views" role="tablist">' +
                '<button type="button" class="bhw-ev-vb' + (view === 'list' ? ' bhw-on' : '') + '" data-view="list" role="tab" aria-selected="' + (view === 'list') + '">' + escapeHtml(L.list || 'List') + '</button>' +
                '<button type="button" class="bhw-ev-vb' + (view === 'month' ? ' bhw-on' : '') + '" data-view="month" role="tab" aria-selected="' + (view === 'month') + '">' + escapeHtml(L.month || 'Month') + '</button></div>' : '';
            var titles = (cfg.heading || cfg.subheading) ? '<div>' + (cfg.heading ? '<h3 class="bhw-ev-h">' + escapeHtml(cfg.heading) + '</h3>' : '') +
                (cfg.subheading ? '<p class="bhw-ev-sub">' + escapeHtml(cfg.subheading) + '</p>' : '') + '</div>' : '';
            if (!titles && !views) return '';
            return '<header class="bhw-ev-head' + (titles && !views ? ' bhw-c' : '') + '">' + titles + views + '</header>';
        }
        function catsHtml() {
            if (!cfg.filter || cfg._cats.length < 2) return '';
            return '<div class="bhw-ev-cats">' +
                '<button type="button" class="bhw-ev-cat' + (!catSel ? ' bhw-on' : '') + '" data-cat="">' + escapeHtml(L.all || 'All') + '</button>' +
                cfg._cats.map(function (c) {
                    return '<button type="button" class="bhw-ev-cat' + (catSel === c ? ' bhw-on' : '') + '" data-cat="' + escapeHtml(c) + '" style="--c:' + catColor(cfg, c) + '"><i></i>' + escapeHtml(c) + '</button>';
                }).join('') + '</div>';
        }
        function listHtml() {
            var up = filtered(all.filter(function (o) { return notOver(o, today); }));
            if (!up.length) { occ = []; return '<p class="bhw-ev-empty">' + escapeHtml(L.noEvents || 'No upcoming events.') + '</p>'; }
            occ = up.slice(0, shown);
            var html = '<div class="bhw-ev-list">', lastM = '';
            occ.forEach(function (o, n) {
                var m = o.key.slice(0, 7);
                if (cfg.groupByMonth && m !== lastM) {
                    if (lastM) html += '</div>';
                    html += '<h4 class="bhw-ev-month-h">' + escapeHtml(fmt(cfg, m + '-01', { month: 'long', year: 'numeric' })) + '</h4><div class="bhw-ev-items">';
                    lastM = m;
                } else if (!cfg.groupByMonth && n === 0) html += '<div class="bhw-ev-items">';
                html += cardHtml(o, cfg, n);
            });
            html += '</div></div>';
            if (up.length > shown) html += '<button type="button" class="bhw-ev-btn bhw-ghost bhw-ev-showmore" data-act="showmore">' + escapeHtml(L.showMore || 'Show more events') + '</button>';
            return html;
        }
        function monthHtml() {
            var first = monthKey, firstW = (weekday(first) - cfg.weekStart + 7) % 7;
            var gridStart = addDays(first, -firstW);
            var mNum = first.slice(0, 7);
            var minM = addMonthsKey(today.key.slice(0, 7) + '-01', -12), maxM = addMonthsKey(today.key.slice(0, 7) + '-01', 12);
            var list = filtered(all), byDay = {};
            list.forEach(function (o) {
                for (var k = o.key; k <= o.endKey; k = addDays(k, 1)) (byDay[k] = byDay[k] || []).push(o);
            });
            var wd = '';
            for (var i = 0; i < 7; i++) wd += '<div class="bhw-ev-wd">' + escapeHtml(fmt(cfg, addDays('2024-01-07', (cfg.weekStart + i) % 7), { weekday: 'short' }).replace('.', '')) + '</div>';
            var cells = '', weeks = 0;
            var k = gridStart;
            do {
                for (var d = 0; d < 7; d++, k = addDays(k, 1)) {
                    var items = byDay[k] || [];
                    var cls = 'bhw-ev-day' + (k.slice(0, 7) !== mNum ? ' bhw-out' : '') + (k === today.key ? ' bhw-now' : '') + (k < today.key ? ' bhw-past' : '') + (k === selDay ? ' bhw-sel' : '');
                    var label = fmt(cfg, k, { weekday: 'long', day: 'numeric', month: 'long' }) + (items.length ? ', ' + items.length : '');
                    cells += '<button type="button" class="' + cls + '" data-day="' + k + '" aria-label="' + escapeHtml(label) + '" aria-pressed="' + (k === selDay) + '"><span class="bhw-ev-dn">' + Number(k.slice(8)) + '</span>' +
                        items.slice(0, 2).map(function (o) { return '<span class="bhw-ev-chip" style="--c:' + (o.ev.cat ? catColor(cfg, o.ev.cat) : cssValue(cfg.style.colors.accent, '#2563eb')) + '">' + escapeHtml((o.ev.allDay || o.key !== k ? '' : fmtTime(cfg, o.ev.start) + ' ') + o.ev.title) + '</span>'; }).join('') +
                        (items.length > 2 ? '<span class="bhw-ev-plus">+' + (items.length - 2) + '</span>' : '') +
                        (items.length ? '<span class="bhw-ev-dots">' + items.slice(0, 3).map(function (o) { return '<i style="--c:' + (o.ev.cat ? catColor(cfg, o.ev.cat) : cssValue(cfg.style.colors.accent, '#2563eb')) + '"></i>'; }).join('') + '</span>' : '') +
                        '</button>';
                }
                weeks++;
            } while (k.slice(0, 7) === mNum && weeks < 6);
            var dayList = '';
            if (selDay) {
                occ = (byDay[selDay] || []);
                dayList = '<div class="bhw-ev-dayp"><h4 class="bhw-ev-dayp-h">' + escapeHtml(fmt(cfg, selDay, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h4>' +
                    (occ.length ? '<div class="bhw-ev-items">' + occ.map(function (o, n) { return cardHtml(o, cfg, n); }).join('') + '</div>' : '<p class="bhw-ev-empty">' + escapeHtml(L.noDay || 'No events on this day.') + '</p>') + '</div>';
            } else occ = [];
            return '<div class="bhw-ev-cal-top"><h4 class="bhw-ev-cal-t">' + escapeHtml(fmt(cfg, first, { month: 'long', year: 'numeric' })) + '</h4>' +
                '<div class="bhw-ev-cal-nav">' +
                (mNum !== today.key.slice(0, 7) ? '<button type="button" class="bhw-ev-nav bhw-ev-today" data-act="today">' + escapeHtml(L.today || 'Today') + '</button>' : '') +
                '<button type="button" class="bhw-ev-nav" data-act="prev" aria-label="Previous month"' + (first <= minM ? ' disabled' : '') + '>' + ICON_L + '</button>' +
                '<button type="button" class="bhw-ev-nav" data-act="next" aria-label="Next month"' + (first >= maxM ? ' disabled' : '') + '>' + ICON_R + '</button></div></div>' +
                '<div class="bhw-ev-grid">' + wd + cells + '</div>' + dayList;
        }
        // первый день месяца с событием (сегодня или позже) — выбираем сам, чтобы под календарём сразу был список
        function autoSelect() {
            var mNum = monthKey.slice(0, 7);
            var list = filtered(all).filter(function (o) { return o.endKey >= today.key && (o.key.slice(0, 7) === mNum || o.endKey.slice(0, 7) === mNum); });
            if (!list.length) { selDay = ''; return; }
            var k = list[0].key < today.key ? today.key : list[0].key;
            if (k.slice(0, 7) !== mNum) k = mNum + '-01';
            selDay = k;
        }

        function draw() {
            var tz = cfg.showTimezone && cfg.timezone ? '<p class="bhw-ev-tz">' + escapeHtml((L.times || 'Times shown in') + ' ' + cfg.timezone.replace(/_/g, ' ')) + '</p>' : '';
            root.innerHTML = headHtml() + catsHtml() + (view === 'month' ? monthHtml() : listHtml()) + tz;
            layout();
            // «More» только у длинных описаний
            root.querySelectorAll('.bhw-ev-card').forEach(function (c) {
                var p = c.querySelector('.bhw-ev-desc'), b = c.querySelector('.bhw-ev-more');
                if (p && b && p.scrollHeight > p.clientHeight + 2) b.hidden = false;
            });
            root.querySelectorAll('.bhw-ev-img img').forEach(function (img) {
                img.addEventListener('error', function () { var p = img.parentNode; if (p) p.remove(); });
            });
        }
        function closeMenus(except) {
            root.querySelectorAll('.bhw-ev-add.bhw-open').forEach(function (a) {
                if (a === except) return;
                a.classList.remove('bhw-open');
                var b = a.querySelector('[data-act="add"]'); if (b) b.setAttribute('aria-expanded', 'false');
            });
        }

        on(root, 'click', function (e) {
            var t = e.target.closest('button, a');
            if (!t || !root.contains(t)) return;
            if (t.hasAttribute('data-view')) { view = t.getAttribute('data-view'); if (view === 'month' && !selDay) autoSelect(); draw(); return; }
            if (t.hasAttribute('data-cat')) { catSel = t.getAttribute('data-cat'); shown = cfg.listLimit; if (view === 'month') autoSelect(); draw(); return; }
            if (t.hasAttribute('data-day')) { var dk = t.getAttribute('data-day'); selDay = selDay === dk ? '' : dk; if (dk.slice(0, 7) !== monthKey.slice(0, 7)) monthKey = dk.slice(0, 7) + '-01'; draw(); return; }
            var act = t.getAttribute('data-act');
            if (!act) return;
            var card = t.closest('.bhw-ev-card'), o = card ? occ[Number(card.getAttribute('data-o'))] : null;
            if (act === 'prev' || act === 'next') { monthKey = addMonthsKey(monthKey, act === 'prev' ? -1 : 1); autoSelect(); draw(); return; }
            if (act === 'today') { monthKey = today.key.slice(0, 7) + '-01'; autoSelect(); draw(); return; }
            if (act === 'showmore') { shown += cfg.listLimit; draw(); return; }
            if (act === 'more' && card) { var open = card.classList.toggle('bhw-open'); t.textContent = open ? (L.less || 'Less') : (L.more || 'More'); return; }
            if (act === 'add') {
                var wrap = t.parentNode, will = !wrap.classList.contains('bhw-open');
                closeMenus(wrap);
                wrap.classList.toggle('bhw-open', will);
                t.setAttribute('aria-expanded', will ? 'true' : 'false');
                var menu = wrap.querySelector('.bhw-ev-menu');
                if (menu && will) {
                    menu.classList.remove('bhw-up');
                    var r = menu.getBoundingClientRect();
                    if (r.bottom > (window.innerHeight || 0) && r.top - r.height - t.offsetHeight > 0) menu.classList.add('bhw-up');
                    var first = menu.querySelector('a'); if (first) first.focus({ preventScroll: true });
                }
                return;
            }
            if (act === 'ics' && o) { e.preventDefault(); downloadIcs(o, cfg); closeMenus(); return; }
        });
        on(document, 'click', function (e) { if (!root.contains(e.target)) closeMenus(); });
        on(root, 'keydown', function (e) { if (e.key === 'Escape') closeMenus(); });

        // узкий режим (телефон / узкая колонка): точки вместо названий в календаре, фото над текстом
        function layout() {
            var w = (inline ? inline.clientWidth : root.clientWidth) || root.clientWidth;
            root.classList.toggle('bhw-narrow', Math.min(w, cfg.style.sizes.maxWidth) < 600);
        }
        if (window.ResizeObserver) {
            var ro = new ResizeObserver(layout);
            ro.observe(inline || root);
            cleanups.push(function () { ro.disconnect(); });
        } else on(window, 'resize', layout);

        if (view === 'month' && !st.month) autoSelect();
        draw();

        return {
            root: root, config: cfg, id: id,
            state: function () { return { view: view, cat: catSel, month: monthKey, day: selDay }; },
            setView: function (v) { if (v === 'list' || v === 'month') { view = v; if (v === 'month' && !selDay) autoSelect(); draw(); } },
            destroy: function () {
                cleanups.forEach(function (f) { try { f(); } catch (e) {} });
                root.remove();
                var s = document.getElementById(styleId); if (s) s.remove();
            }
        };
    }
})();
