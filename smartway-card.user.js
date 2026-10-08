// ==UserScript==
// @name         Карточка сотрудника Smartway
// @namespace    https://smartway.today/
// @version      1.5
// @description  Извлекает данные сотрудника и формирует карточку
// @author       Smartway
// @match        https://bo.sandbox.smartway.today/*
// @match        https://bo.smartway.today/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://cdn.jsdelivr.net/gh/HorrorStoryy/smartway-card@main/smartway-card.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/HorrorStoryy/smartway-card@main/smartway-card.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[SMARTWAY] Скрипт загружен, версия 1.5');

    var cachedData = null;
    var lastCardText = '';

    function createToggleButton() {
        var oldBtn = document.getElementById('smartway-toggle');
        if (oldBtn) oldBtn.remove();
        var toggle = document.createElement('button');
        toggle.id = 'smartway-toggle';
        toggle.textContent = '[K]';
        toggle.title = 'Карточка сотрудника (Ctrl+1/2/3)';
        toggle.style.cssText = 'position:fixed;top:100px;right:20px;z-index:999999;background:#4CAF50;color:#fff;border:none;border-radius:50%;width:50px;height:50px;font-size:18px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);transition:0.2s;display:flex;align-items:center;justify-content:center;opacity:0.8;font-weight:bold;';
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
        console.log('[SMARTWAY] Кнопка создана');
    }

    function parsePageData() {
        var text = document.body.innerText;

        function findValue(label) {
            var regex = new RegExp(label.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '\\s[:\\u2013-]?\\s*([^\\n]+)', 'i');
            var match = text.match(regex);
            return match ? match[1].trim() : '';
        }

        function cleanFullName(raw) {
            if (!raw) return '';
            return raw.replace(/done_outline/gi, '').replace(/\s+/g, ' ').trim();
        }

        function getShortCompanies() {
            var accountIndex = text.indexOf('\u0410\u041A\u041A\u0410\u0423\u041d\u0422\u042b');
            if (accountIndex === -1) return '';
            var endMarkers = ['\u0411\u041e\u041d\u0423\u0421\u041d\u042b\u0415 \u041a\u0410\u0420\u0422\u042b', '\u0414\u041e\u041a\u0423\u041c\u0415\u041d\u0422\u042b', 'TRAVEL \u041f\u041e\u041b\u0418\u0422\u0418\u041a\u0418', '\u041f\u0420\u0410\u0412\u0410'];
            var endPos = text.length;
            for (var i = 0; i < endMarkers.length; i++) {
                var idx = text.indexOf(endMarkers[i], accountIndex);
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
            for (var j = 0; j < oldEndMarkers.length; j++) {
                var idx2 = section.indexOf(oldEndMarkers[j], pos);
                if (idx2 !== -1 && idx2 < oldEndPos) oldEndPos = idx2;
            }
            return section.substring(pos, oldEndPos).trim();
        }

        function parseStructuredGroups(section) {
            var parts = section.split(/(?=Структурная группа)/i);
            var results = [];
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i].trim();
                if (!part) continue;
                if (!/^Структурная группа/i.test(part)) continue;
                var lines = part.split(/\r?\n/);
                var cleanLines = [];
                for (var k = 0; k < lines.length; k++) {
                    var l = lines[k].trim();
                    if (l !== '') cleanLines.push(l);
                }
                var groupHeader = '';
                for (var k2 = 0; k2 < cleanLines.length; k2++) {
                    if (/^Структурная группа/i.test(cleanLines[k2])) { groupHeader = cleanLines[k2]; break; }
                }
                var shortCompanies = '';
                var scIdx = -1;
                for (var k3 = 0; k3 < cleanLines.length; k3++) {
                    if (/^Список коротких компаний/i.test(cleanLines[k3])) { scIdx = k3; break; }
                }
                if (scIdx !== -1) {
                    var labelLine = cleanLines[scIdx];
                    var colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        var afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) shortCompanies = afterColon;
                        else {
                            for (var m = scIdx + 1; m < cleanLines.length; m++) {
                                if (cleanLines[m] && !/^(Отделы|Список коротких|Структурная)/i.test(cleanLines[m])) {
                                    shortCompanies = cleanLines[m]; break;
                                }
                            }
                        }
                    }
                }
                var departments = '';
                var deptIdx = -1;
                for (var k4 = 0; k4 < cleanLines.length; k4++) {
                    if (/^Отделы/i.test(cleanLines[k4])) { deptIdx = k4; break; }
                }
                if (deptIdx !== -1) {
                    var labelLine2 = cleanLines[deptIdx];
                    var colonIdx2 = labelLine2.indexOf(':');
                    if (colonIdx2 !== -1) {
                        var afterColon2 = labelLine2.substring(colonIdx2 + 1).trim();
                        if (afterColon2) departments = afterColon2;
                        else {
                            for (var m2 = deptIdx + 1; m2 < cleanLines.length; m2++) {
                                if (cleanLines[m2] && !/^(Отделы|Список коротких|Структурная)/i.test(cleanLines[m2])) {
                                    departments = cleanLines[m2]; break;
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
            for (var i = 0; i < markers.length; i++) {
                var pos = text.indexOf(markers[i]);
                while (pos !== -1) {
                    parts.push({ marker: markers[i], start: pos });
                    pos = text.indexOf(markers[i], pos + 1);
                }
            }
            parts.sort(function(a, b) { return a.start - b.start; });
            for (var i = 0; i < parts.length; i++) {
                var start = parts[i].start + parts[i].marker.length;
                var nextStart = (i + 1 < parts.length) ? parts[i+1].start : text.length;
                var section = text.substring(start, nextStart);
                var s = section.match(/Фамилия\s*[:\u2013-]?\s*([^\n]+)/i);
                var n = section.match(/Имя\s*[:\u2013-]?\s*([^\n]+)/i);
                var p = section.match(/Отчество\s*[:\u2013-]?\s*([^\n]+)/i);
                var num = section.match(/Номер\s*[:\u2013-]?\s*([^\n]+)/i);
                var exp = section.match(/Срок действия\s*[:\u2013-]?\s*([^\n]+)/i);
                results.push({
                    surname: s ? s[1].trim() : '',
                    name: n ? n[1].trim() : '',
                    patronymic: p ? p[1].trim() : '',
                    number: num ? num[1].trim() : '',
                    expiry: exp ? exp[1].trim() : '',
                    marker: parts[i].marker
                });
            }
            return results;
        }

        function getPassportRF() {
            var section = text.split('Паспорт РФ')[1];
            if (!section) return '';
            var match = section.match(/Номер\s*[:\u2013-]?\s*([^\n]+)/i);
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

        console.log('[SMARTWAY] Данные извлечены:', fullName);
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

        for (var i = 0; i < types.length; i++) {
            (function(t) {
                var btn = document.createElement('button');
                btn.dataset.type = t.id;
                btn.textContent = t.label;
                btn.className = 'type-btn';
                btn.style.cssText = 'background:#fff;border:1px solid #ccc;border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;transition:0.2s;flex:1;white-space:nowrap;';
                btn.onmouseover = function() { this.style.background = '#e8f5e9'; };
                btn.onmouseout = function() { this.style.background = '#fff'; };
                btn.onclick = function() {
                    var allBtns = document.querySelectorAll('#smartway-panel .type-btn');
                    for (var j = 0; j < allBtns.length; j++) allBtns[j].style.background = '#fff';
                    this.style.background = '#c8e6c9';
                    generateCard(t.id);
                };
                typeSelector.appendChild(btn);
            })(types[i]);
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

        document.getElementById('smartway-close').onclick = function() { panel.style.display = 'none'; };

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
        console.log('[SMARTWAY] Панель создана');
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
                for (var i = 0; i < passports.length; i++) {
                    var p = passports[i];
                    if (i > 0) result = result + '\n---\n';
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
            console.log('[SMARTWAY] Карточка сгенерирована, длина:', lastCardText.length);
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
        console.log('[SMARTWAY] Горячие клавиши установлены: Ctrl+1, Ctrl+2, Ctrl+3');
    }

    function init() {
        console.log('[SMARTWAY] Инициализация...');
        createToggleButton();
        setupHotkeys();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
