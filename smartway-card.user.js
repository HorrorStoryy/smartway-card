// ==UserScript==
// @name         Карточка сотрудника Smartway
// @namespace    https://smartway.today/
// @version      2.0
// @description  Извлекает данные сотрудника и формирует карточку
// @author       Smartway
// @match        https://bo.sandbox.smartway.today/*
// @match        https://bo.smartway.today/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/HorrorStoryy/smartway-card/main/smartway-card.meta.js
// @downloadURL  https://raw.githubusercontent.com/HorrorStoryy/smartway-card/main/smartway-card.user.js
// ==/UserScript==

(function() {
    'use strict';

    var cachedData = null;
    var lastCardText = '';

    function createToggleButton() {
        var oldBtn = document.getElementById('smartway-toggle');
        if (oldBtn) oldBtn.remove();
        var toggle = document.createElement('button');
        toggle.id = 'smartway-toggle';
        toggle.textContent = '[K]';
        toggle.title = 'Карточка сотрудника';
        toggle.style.cssText = 'position:fixed;top:100px;right:20px;z-index:999999;background:#4CAF50;color:#fff;border:none;border-radius:50%;width:50px;height:50px;font-size:24px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);transition:0.2s;display:flex;align-items:center;justify-content:center;opacity:0.8;';
        toggle.onmouseover = function() { this.style.opacity = '1'; this.style.transform = 'scale(1.05)'; };
        toggle.onmouseout = function() { this.style.opacity = '0.8'; this.style.transform = 'scale(1)'; };
        toggle.onclick = function() {
            var panel = document.getElementById('smartway-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel.style.display === 'block' && !cachedData) cachedData = parsePageData();
            } else {
                createPanel();
            }
        };
        document.body.appendChild(toggle);
        console.log('[SW] Кнопка создана');
    }

    function parsePageData() {
        console.log('[SW] Начинаю парсинг...');
        var text = document.body.innerText;
        console.log('[SW] Длина текста:', text.length);

        function findValue(label) {
            var escaped = label.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            var regex = new RegExp(escaped + '\\s*[:\\u2013-–—]?\\s*([^\\n]+)', 'i');
            var match = text.match(regex);
            var result = match ? match[1].trim() : '';
            console.log('[SW] findValue("' + label + '") = "' + result + '"');
            return result;
        }

        function cleanFullName(raw) {
            if (!raw) return '';
            return raw.replace(/done_outline/gi, '').replace(/\s+/g, ' ').trim();
        }

        function getShortCompanies() {
            var accountIndex = text.indexOf('АККАУНТЫ');
            if (accountIndex === -1) return '';
            var endMarkers = ['БОНУСНЫЕ КАРТЫ', 'ДОКУМЕНТЫ', 'TRAVEL ПОЛИТИКИ', 'ПРАВА'];
            var endPos = text.length;
            var a;
            for (a = 0; a < endMarkers.length; a++) {
                var idx = text.indexOf(endMarkers[a], accountIndex);
                if (idx !== -1 && idx < endPos) endPos = idx;
            }
            var section = text.substring(accountIndex, endPos);
            if (/Структурная группа/i.test(section)) return parseStructuredGroups(section);
            var startLabel = 'Список коротких компаний:';
            var startPos = section.indexOf(startLabel);
            if (startPos === -1) return '';
            var pos = startPos + startLabel.length;
            while (pos < section.length && (section[pos] === ' ' || section[pos] === '\n' || section[pos] === '\r')) pos++;
            var oldEndMarkers = ['Отделы:', 'Структурная группа'];
            var oldEndPos = section.length;
            var b;
            for (b = 0; b < oldEndMarkers.length; b++) {
                var idx2 = section.indexOf(oldEndMarkers[b], pos);
                if (idx2 !== -1 && idx2 < oldEndPos) oldEndPos = idx2;
            }
            return section.substring(pos, oldEndPos).trim();
        }

        function parseStructuredGroups(section) {
            var parts = section.split(/(?=Структурная группа)/i);
            var results = [];
            var c;
            for (c = 0; c < parts.length; c++) {
                var part = parts[c].trim();
                if (!part) continue;
                if (!/^Структурная группа/i.test(part)) continue;
                var lines = part.split(/\r?\n/);
                var cleanLines = [];
                var d;
                for (d = 0; d < lines.length; d++) {
                    var l = lines[d].trim();
                    if (l !== '') cleanLines.push(l);
                }
                var groupHeader = '';
                var e;
                for (e = 0; e < cleanLines.length; e++) {
                    if (/^Структурная группа/i.test(cleanLines[e])) { groupHeader = cleanLines[e]; break; }
                }
                var shortCompanies = '';
                var scIdx = -1;
                var f;
                for (f = 0; f < cleanLines.length; f++) {
                    if (/^Список коротких компаний/i.test(cleanLines[f])) { scIdx = f; break; }
                }
                if (scIdx !== -1) {
                    var labelLine = cleanLines[scIdx];
                    var colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        var afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) shortCompanies = afterColon;
                        else {
                            var g;
                            for (g = scIdx + 1; g < cleanLines.length; g++) {
                                if (cleanLines[g] && !/^(Отделы|Список коротких|Структурная)/i.test(cleanLines[g])) {
                                    shortCompanies = cleanLines[g]; break;
                                }
                            }
                        }
                    }
                }
                var departments = '';
                var deptIdx = -1;
                var h;
                for (h = 0; h < cleanLines.length; h++) {
                    if (/^Отделы/i.test(cleanLines[h])) { deptIdx = h; break; }
                }
                if (deptIdx !== -1) {
                    var labelLine2 = cleanLines[deptIdx];
                    var colonIdx2 = labelLine2.indexOf(':');
                    if (colonIdx2 !== -1) {
                        var afterColon2 = labelLine2.substring(colonIdx2 + 1).trim();
                        if (afterColon2) departments = afterColon2;
                        else {
                            var m;
                            for (m = deptIdx + 1; m < cleanLines.length; m++) {
                                if (cleanLines[m] && !/^(Отделы|Список коротких|Структурная)/i.test(cleanLines[m])) {
                                    departments = cleanLines[m]; break;
                                }
                            }
                        }
                    }
                }
                var groupText = groupHeader;
                if (shortCompanies) groupText = groupText + '\nСписок коротких компаний: ' + shortCompanies;
                if (departments) groupText = groupText + '\nОтделы: ' + departments;
                results.push(groupText);
            }
            return results.join('\n\n');
        }

        function getForeignPassports() {
            var results = [];
            var markers = ['Загран.паспорт', 'Паспорт иностранного гр-на'];
            var parts = [];
            var k;
            for (k = 0; k < markers.length; k++) {
                var pos = text.indexOf(markers[k]);
                while (pos !== -1) {
                    parts.push({ marker: markers[k], start: pos });
                    pos = text.indexOf(markers[k], pos + 1);
                }
            }
            parts.sort(function(x, y) { return x.start - y.start; });
            var p;
            for (p = 0; p < parts.length; p++) {
                var start = parts[p].start + parts[p].marker.length;
                var nextStart = (p + 1 < parts.length) ? parts[p+1].start : text.length;
                var section = text.substring(start, nextStart);
                var s = section.match(/Фамилия\s*[:\u2013-–—]?\s*([^\n]+)/i);
                var n = section.match(/Имя\s*[:\u2013-–—]?\s*([^\n]+)/i);
                var pt = section.match(/Отчество\s*[:\u2013-–—]?\s*([^\n]+)/i);
                var num = section.match(/Номер\s*[:\u2013-–—]?\s*([^\n]+)/i);
                var exp = section.match(/Срок действия\s*[:\u2013-–—]?\s*([^\n]+)/i);
                results.push({
                    surname: s ? s[1].trim() : '',
                    name: n ? n[1].trim() : '',
                    patronymic: pt ? pt[1].trim() : '',
                    number: num ? num[1].trim() : '',
                    expiry: exp ? exp[1].trim() : '',
                    marker: parts[p].marker
                });
            }
            return results;
        }

        function getPassportRF() {
            var section = text.split('Паспорт РФ')[1];
            if (!section) return '';
            var match = section.match(/Номер\s*[:\u2013-–—]?\s*([^\n]+)/i);
            return match ? match[1].trim() : '';
        }

        function formatDate(raw) {
            if (!raw) return '';
            if (/^\d{2}.\d{2}.\d{4}$/.test(raw.trim())) return raw.trim();
            var months = {
                'янв':'01','фев':'02','мар':'03','апр':'04','мая':'05','май':'05',
                'июн':'06','июл':'07','авг':'08','сен':'09','окт':'10','ноя':'11','дек':'12',
                'января':'01','февраля':'02','марта':'03','апреля':'04',
                'июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12'
            };
            var match = raw.match(/(\d+)\s*([а-яё]+).?\s*(\d{4})\s*г?.?/i);
            if (!match) return '';
            var day = match[1].padStart(2, '0');
            var month = months[match[2].toLowerCase()] || months[match[2].toLowerCase().slice(0,3)] || '00';
            if (month === '00') return '';
            return day + '.' + month + '.' + match[3];
        }

        var fullNameRaw = findValue('ФИО');
        var fullName = cleanFullName(fullNameRaw);
        var birthDateRaw = findValue('Дата рождения');
        var citizenship = findValue('Гражданство');
        var phone = findValue('Телефон');
        var email = findValue('Email') || findValue('Email:');
        var costCenter = findValue('Центр затрат по умолчанию');
        var shortCompanies = getShortCompanies();
        var formattedDate = formatDate(birthDateRaw);
        var dateString = (birthDateRaw && formattedDate) ? birthDateRaw + ' (' + formattedDate + ')' : birthDateRaw || '';
        var passportRF = getPassportRF();
        var foreignPassports = getForeignPassports();
        var isRussian = citizenship.toLowerCase().indexOf('россия') !== -1 || citizenship.toLowerCase().indexOf('russia') !== -1;

        console.log('[SW] ФИО:', fullName);
        console.log('[SW] Дата рождения:', dateString);
        console.log('[SW] Телефон:', phone);

        return {
            link: window.location.href,
            fullName: fullName,
            dateString: dateString,
            phone: phone,
            citizenship: citizenship,
            email: email,
            costCenter: costCenter,
            shortCompanies: shortCompanies,
            passportRF: passportRF,
            foreignPassports: foreignPassports,
            isRussian: isRussian
        };
    }

    function createPanel() {
        var existing = document.getElementById('smartway-panel');
        if (existing) { existing.style.display = 'block'; return; }

        var panel = document.createElement('div');
        panel.id = 'smartway-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;z-index:999999;width:380px;max-height:70vh;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e0e0e0;';

        var header = document.createElement('div');
        header.style.cssText = 'background:#4CAF50;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        header.innerHTML = '<span style="font-weight:bold;font-size:16px;">Карточка сотрудника</span><button id="smartway-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">X</button>';
        panel.appendChild(header);

        var typeSelector = document.createElement('div');
        typeSelector.style.cssText = 'display:flex;gap:6px;padding:10px 12px;background:#f9f9f9;border-bottom:1px solid #eee;flex-wrap:wrap;';

        var types = [
            { id: 'standard', label: 'Стандартная' },
            { id: 'rail', label: 'ЖД' },
            { id: 'insurance', label: 'Страховка' }
        ];

        var t;
        for (t = 0; t < types.length; t++) {
            (function(typeObj) {
                var btn = document.createElement('button');
                btn.dataset.type = typeObj.id;
                btn.textContent = typeObj.label;
                btn.className = 'type-btn';
                btn.style.cssText = 'background:#fff;border:1px solid #ccc;border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;transition:0.2s;flex:1;white-space:nowrap;';
                btn.onmouseover = function() { this.style.background = '#e8f5e9'; };
                btn.onmouseout = function() { this.style.background = '#fff'; };
                btn.onclick = function() {
                    var allBtns = document.querySelectorAll('#smartway-panel .type-btn');
                    var j;
                    for (j = 0; j < allBtns.length; j++) allBtns[j].style.background = '#fff';
                    this.style.background = '#c8e6c9';
                    generateCard(typeObj.id);
                };
                typeSelector.appendChild(btn);
            })(types[t]);
        }
        panel.appendChild(typeSelector);

        var contentArea = document.createElement('div');
        contentArea.id = 'smartway-content';
        contentArea.style.cssText = 'padding:12px 16px;overflow-y:auto;flex:1;background:#fafafa;min-height:100px;max-height:40vh;font-size:13px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;font-family:Courier New,monospace;';
        contentArea.textContent = 'Выберите тип карточки';
        panel.appendChild(contentArea);

        var copyBtn = document.createElement('button');
        copyBtn.id = 'smartway-copy';
        copyBtn.textContent = 'Копировать';
        copyBtn.style.cssText = 'margin:8px 16px 16px;padding:8px 0;background:#4CAF50;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold;';
        copyBtn.onmouseover = function() { this.style.background = '#45a049'; };
        copyBtn.onmouseout = function() { this.style.background = '#4CAF50'; };
        copyBtn.onclick = function() {
            if (!lastCardText || lastCardText === 'Выберите тип карточки' || lastCardText === 'Загрузка...') return;
            var ta = document.createElement('textarea');
            ta.value = lastCardText;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                copyBtn.textContent = 'Скопировано!';
                setTimeout(function() { copyBtn.textContent = 'Копировать'; }, 1500);
            } catch (err) {
                navigator.clipboard.writeText(lastCardText).then(function() {
                    copyBtn.textContent = 'Скопировано!';
                    setTimeout(function() { copyBtn.textContent = 'Копировать'; }, 1500);
                }).catch(function() { alert('Не удалось скопировать'); });
            }
            ta.remove();
        };
        panel.appendChild(copyBtn);

        header.querySelector('#smartway-close').onclick = function() { panel.style.display = 'none'; };

        var isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            var rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panel.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            var left = e.clientX - offsetX;
            var top = e.clientY - offsetY;
            left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, left));
            top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, top));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() {
            if (isDragging) { isDragging = false; panel.style.cursor = 'default'; }
        });

        document.body.appendChild(panel);
        if (!cachedData) cachedData = parsePageData();
        console.log('[SW] Панель создана');
    }

    function generateCard(type) {
        var contentArea = document.getElementById('smartway-content');
        if (!contentArea) return;
        if (!cachedData) cachedData = parsePageData();
        var data = cachedData;
        if (!data) { contentArea.textContent = 'Не удалось извлечь данные'; lastCardText = ''; return; }
        contentArea.textContent = 'Загрузка...';
        lastCardText = '';
        setTimeout(function() {
            var cardText = '';
            var link = data.link;
            var fullName = data.fullName;
            var dateString = data.dateString;
            var phone = data.phone;
            var citizenship = data.citizenship;
            var email = data.email;
            var costCenter = data.costCenter;
            var shortCompanies = data.shortCompanies;
            var passportRF = data.passportRF;
            var foreignPassports = data.foreignPassports;
            var isRussian = data.isRussian;

            function formatPassports(passports) {
                if (!passports || passports.length === 0) return '';
                var result = '';
                var q;
                for (q = 0; q < passports.length; q++) {
                    var p = passports[q];
                    if (q > 0) result = result + '\n---\n';
                    result = result + p.marker + ':\n' + p.surname + '\n' + p.name;
                    if (p.patronymic) result = result + '\n' + p.patronymic;
                    result = result + '\n' + p.number + '\n' + p.expiry;
                }
                return result;
            }

            if (type === 'standard') {
                if (isRussian) {
                    cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone + '\n' + passportRF + '\n\n' + shortCompanies;
                    if (costCenter) cardText = cardText + '\n\nЦЗ: **' + costCenter + '**';
                } else {
                    var foreignPart = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nПаспорт иностранного гр-на не найден';
                    cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone + '\n\n' + citizenship + foreignPart + '\n\n' + shortCompanies;
                    if (costCenter) cardText = cardText + '\n\nЦЗ: **' + costCenter + '**';
                }
            } else if (type === 'rail') {
                var foreignPart2 = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nЗагран.паспорт не найден';
                cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone;
                if (!isRussian) cardText = cardText + '\n\n' + citizenship;
                cardText = cardText + foreignPart2 + '\n\n' + shortCompanies;
                if (costCenter) cardText = cardText + '\n\nЦЗ: **' + costCenter + '**';
            } else if (type === 'insurance') {
                var foreignPart3 = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nЗагран.паспорт не найден';
                cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone;
                if (isRussian) cardText = cardText + '\n' + passportRF;
                else cardText = cardText + '\n\n' + citizenship;
                cardText = cardText + '\n\nEmail: ' + email + foreignPart3 + '\n\n' + shortCompanies;
                if (costCenter) cardText = cardText + '\n\nЦЗ: **' + costCenter + '**';
            }

            lastCardText = cardText;
            contentArea.textContent = cardText;
            console.log('[SW] Карточка готова, длина:', lastCardText.length);
        }, 50);
    }

    function openPanelAndGenerate(type) {
        var panel = document.getElementById('smartway-panel');
        if (!panel) { createPanel(); panel = document.getElementById('smartway-panel'); }
        else panel.style.display = 'block';
        if (!cachedData) cachedData = parsePageData();
        var btn = document.querySelector('#smartway-panel .type-btn[data-type="' + type + '"]');
        if (btn) btn.click();
    }

    function hotkeyHandler(e) {
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
            if (e.key === '1') { e.preventDefault(); e.stopPropagation(); openPanelAndGenerate('standard'); return; }
            if (e.key === '2') { e.preventDefault(); e.stopPropagation(); openPanelAndGenerate('rail'); return; }
            if (e.key === '3') { e.preventDefault(); e.stopPropagation(); openPanelAndGenerate('insurance'); return; }
        }
    }

    function setupHotkeys() {
        window.addEventListener('keydown', hotkeyHandler, true);
        document.addEventListener('keydown', hotkeyHandler, true);
        console.log('[SW] Горячие клавиши: Ctrl+1, Ctrl+2, Ctrl+3');
    }

    function init() {
        console.log('[SW] Запуск версии 2.0');
        createToggleButton();
        setupHotkeys();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
