// ==UserScript==
// @name         Карточка сотрудника Smartway
// @namespace    https://smartway.today/
// @version      1.4
// @description  Извлекает данные сотрудника и формирует карточку (Стандартная / ЖД / Страховка)
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

    console.log('[SMARTWAY] Скрипт загружен, версия 1.4');
    console.log('[SMARTWAY] URL страницы:', window.location.href);

    let cachedData = null;
    let lastCardText = '';

    function createToggleButton() {
        console.log('[SMARTWAY] Создаю кнопку...');
        const oldBtn = document.getElementById('smartway-toggle');
        if (oldBtn) oldBtn.remove();
        const toggle = document.createElement('button');
        toggle.id = 'smartway-toggle';
        toggle.textContent = '[K]';
        toggle.title = 'Карточка сотрудника (Ctrl+1/2/3)';
        toggle.style.cssText = 'position:fixed;top:100px;right:20px;z-index:999999;background:#4CAF50;color:#fff;border:none;border-radius:50%;width:50px;height:50px;font-size:18px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);transition:0.2s;display:flex;align-items:center;justify-content:center;opacity:0.8;font-weight:bold;';
        toggle.onmouseover = function() { this.style.opacity = '1'; this.style.transform = 'scale(1.05)'; };
        toggle.onmouseout = function() { this.style.opacity = '0.8'; this.style.transform = 'scale(1)'; };
        toggle.onclick = function() {
            let panel = document.getElementById('smartway-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel.style.display === 'block' && !cachedData) cachedData = parsePageData();
            } else {
                createPanel();
            }
        };
        document.body.appendChild(toggle);
        console.log('[SMARTWAY] Кнопка создана успешно!');
    }

    function parsePageData() {
        const text = document.body.innerText;
        function findValue(label) {
            const regex = new RegExp(label.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '\\s[:–-]?\\s*([^\\n]+)', 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        }
        function cleanFullName(raw) {
            if (!raw) return '';
            return raw.replace(/done_outline/gi, '').replace(/\s+/g, ' ').trim();
        }
        function getShortCompanies() {
            const accountIndex = text.indexOf('АККАУНТЫ');
            if (accountIndex === -1) return '';
            const endMarkers = ['БОНУСНЫЕ КАРТЫ', 'ДОКУМЕНТЫ', 'TRAVEL ПОЛИТИКИ', 'ПРАВА'];
            let endPos = text.length;
            for (let i = 0; i < endMarkers.length; i++) {
                const idx = text.indexOf(endMarkers[i], accountIndex);
                if (idx !== -1 && idx < endPos) endPos = idx;
            }
            const section = text.substring(accountIndex, endPos);
            if (/Структурная группа/i.test(section)) return parseStructuredGroups(section);
            const startLabel = 'Список коротких компаний:';
            const startPos = section.indexOf(startLabel);
            if (startPos === -1) return '';
            let pos = startPos + startLabel.length;
            while (pos < section.length && (section[pos] === ' ' || section[pos] === '\n' || section[pos] === '\r')) pos++;
            const oldEndMarkers = ['Отделы:', 'Структурная группа'];
            let oldEndPos = section.length;
            for (let i = 0; i < oldEndMarkers.length; i++) {
                const idx = section.indexOf(oldEndMarkers[i], pos);
                if (idx !== -1 && idx < oldEndPos) oldEndPos = idx;
            }
            return section.substring(pos, oldEndPos).trim();
        }
        function parseStructuredGroups(section) {
            const parts = section.split(/(?=Структурная группа)/i).map(p => p.trim()).filter(p => p);
            const results = [];
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!/^Структурная группа/i.test(part)) continue;
                const lines = part.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
                const groupHeader = lines.find(l => /^Структурная группа/i.test(l)) || '';
                let shortCompanies = '';
                const scIdx = lines.findIndex(l => /^Список коротких компаний/i.test(l));
                if (scIdx !== -1) {
                    const labelLine = lines[scIdx];
                    const colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        const afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) shortCompanies = afterColon;
                        else {
                            for (let j = scIdx + 1; j < lines.length; j++) {
                                if (lines[j] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[j])) {
                                    shortCompanies = lines[j]; break;
                                }
                            }
                        }
                    }
                }
                let departments = '';
                const deptIdx = lines.findIndex(l => /^Отделы/i.test(l));
                if (deptIdx !== -1) {
                    const labelLine = lines[deptIdx];
                    const colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        const afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) departments = afterColon;
                        else {
                            for (let j = deptIdx + 1; j < lines.length; j++) {
                                if (lines[j] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[j])) {
                                    departments = lines[j]; break;
                                }
                            }
                        }
                    }
                }
                let groupText = groupHeader;
                if (shortCompanies) groupText += '\nСписок коротких компаний: ' + shortCompanies;
                if (departments) groupText += '\nОтделы: ' + departments;
                results.push(groupText);
            }
            return results.join('\n\n');
        }
        function getForeignPassports() {
            const results = [];
            const markers = ['Загран.паспорт', 'Паспорт иностранного гр-на'];
            let parts = [];
            for (let i = 0; i < markers.length; i++) {
                let pos = text.indexOf(markers[i]);
                while (pos !== -1) { parts.push({ marker: markers[i], start: pos }); pos = text.indexOf(markers[i], pos + 1); }
            }
            parts.sort((a, b) => a.start - b.start);
            for (let i = 0; i < parts.length; i++) {
                const start = parts[i].start + parts[i].marker.length;
                const nextStart = (i + 1 < parts.length) ? parts[i+1].start : text.length;
                const section = text.substring(start, nextStart);
                const s = section.match(/Фамилия\s*[:–-]?\s*([^\n]+)/i);
                const n = section.match(/Имя\s*[:–-]?\s*([^\n]+)/i);
                const p = section.match(/Отчество\s*[:–-]?\s*([^\n]+)/i);
                const num = section.match(/Номер\s*[:–-]?\s*([^\n]+)/i);
                const exp = section.match(/Срок действия\s*[:–-]?\s*([^\n]+)/i);
                results.push({
                    surname: s ? s[1].trim() : '', name: n ? n[1].trim() : '',
                    patronymic: p ? p[1].trim() : '', number: num ? num[1].trim() : '',
                    expiry: exp ? exp[1].trim() : '', marker: parts[i].marker
                });
            }
            return results;
        }
        function getPassportRF() {
            const section = text.split('Паспорт РФ')[1];
            if (!section) return '';
            const match = section.match(/Номер\s*[:–-]?\s*([^\n]+)/i);
            return match ? match[1].trim() : '';
        }
        function formatDate(raw) {
            if (!raw) return '';
            if (/^\d{2}.\d{2}.\d{4}$/.test(raw.trim())) return raw.trim();
            const months = {'янв':'01','фев':'02','мар':'03','апр':'04','мая':'05','май':'05','июн':'06','июл':'07','авг':'08','сен':'09','окт':'10','ноя':'11','дек':'12','января':'01','февраля':'02','марта':'03','апреля':'04','июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12'};
            const match = raw.match(/(\d+)\s*([а-яё]+).?\s*(\d{4})\s*г?.?/i);
            if (!match) return '';
            const day = match[1].padStart(2, '0');
            const month = months[match[2].toLowerCase()] || months[match[2].toLowerCase().slice(0,3)] || '00';
            if (month === '00') return '';
            return day + '.' + month + '.' + match[3];
        }

        const fullNameRaw = findValue('ФИО');
        const fullName = cleanFullName(fullNameRaw);
        const birthDateRaw = findValue('Дата рождения');
        const citizenship = findValue('Гражданство');
        const phone = findValue('Телефон');
        const email = findValue('Email') || findValue('Email:');
        const costCenter = findValue('Центр затрат по умолчанию');
        const shortCompanies = getShortCompanies();
        const formattedDate = formatDate(birthDateRaw);
        const dateString = (birthDateRaw && formattedDate) ? birthDateRaw + ' (' + formattedDate + ')' : birthDateRaw || '';
        const passportRF = getPassportRF();
        const foreignPassports = getForeignPassports();
        const isRussian = citizenship.toLowerCase().includes('россия') || citizenship.toLowerCase().includes('russia');

        console.log('[SMARTWAY] Данные извлечены:', fullName);
        return { link: window.location.href, fullName, dateString, phone, citizenship, email, costCenter, shortCompanies, passportRF, foreignPassports, isRussian };
    }

    function createPanel() {
        const existing = document.getElementById('smartway-panel');
        if (existing) { existing.style.display = 'block'; return; }
        const panel = document.createElement('div');
        panel.id = 'smartway-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;z-index:999999;width:380px;max-height:70vh;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e0e0e0;';
        const header = document.createElement('div');
        header.style.cssText = 'background:#4CAF50;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        header.innerHTML = '<span style="font-weight:bold;font-size:16px;">Карточка сотрудника</span><button id="smartway-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">X</button>';
        panel.appendChild(header);
        const typeSelector = document.createElement('div');
        typeSelector.style.cssText = 'display:flex;gap:6px;padding:10px 12px;background:#f9f9f9;border-bottom:1px solid #eee;flex-wrap:wrap;';
        const types = [{id:'standard',label:'Стандартная'},{id:'rail',label:'ЖД'},{id:'insurance',label:'Страховка'}];
        types.forEach(function(t) {
            const btn = document.createElement('button');
            btn.dataset.type = t.id;
            btn.textContent = t.label;
            btn.className = 'type-btn';
            btn.style.cssText = 'background:#fff;border:1px solid #ccc;border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;transition:0.2s;flex:1;white-space:nowrap;';
            btn.onmouseover = function() { this.style.background = '#e8f5e9'; };
            btn.onmouseout = function() { this.style.background = '#fff'; };
            btn.onclick = function() {
                document.querySelectorAll('#smartway-panel .type-btn').forEach(function(b) { b.style.background = '#fff'; });
                this.style.background = '#c8e6c9';
                generateCard(t.id);
            };
            typeSelector.appendChild(btn);
        });
        panel.appendChild(typeSelector);
        const contentArea = document.createElement('div');
        contentArea.id = 'smartway-content';
        contentArea.style.cssText = 'padding:12px 16px;overflow-y:auto;flex:1;background:#fafafa;min-height:100px;max-height:40vh;font-size:13px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;font-family:Courier New,monospace;';
        contentArea.textContent = 'Выберите тип карточки';
        panel.appendChild(contentArea);
        const copyBtn = document.createElement('button');
        copyBtn.id = 'smartway-copy';
        copyBtn.textContent = 'Копировать';
        copyBtn.style.cssText = 'margin:8px 16px 16px;padding:8px 0;background:#4CAF50;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold;';
        copyBtn.onmouseover = function() { this.style.background = '#45a049'; };
        copyBtn.onmouseout = function() { this.style.background = '#4CAF50'; };
        copyBtn.onclick = function() {
            if (!lastCardText || lastCardText === 'Выберите тип карточки' || lastCardText === 'Загрузка...') return;
            const ta = document.createElement('textarea');
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
        let isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
            panel.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            let left = e.clientX - offsetX, top = e.clientY - offsetY;
            left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, left));
            top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, top));
            panel.style.left = left + 'px'; panel.style.top = top + 'px'; panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() { if (isDragging) { isDragging = false; panel.style.cursor = 'default'; } });
        document.body.appendChild(panel);
        if (!cachedData) cachedData = parsePageData();
        console.log('[SMARTWAY] Панель создана');
    }

    function generateCard(type) {
        const contentArea = document.getElementById('smartway-content');
        if (!contentArea) return;
        if (!cachedData) cachedData = parsePageData();
        const data = cachedData;
        if (!data) { contentArea.textContent = 'Не удалось извлечь данные'; lastCardText = ''; return; }
        contentArea.textContent = 'Загрузка...';
        lastCardText = '';
        setTimeout(function() {
            let cardText = '';
            const link = data.link, fullName = data.fullName, dateString = data.dateString, phone = data.phone,
                  citizenship = data.citizenship, email = data.email, costCenter = data.costCenter,
                  shortCompanies = data.shortCompanies, passportRF = data.passportRF,
                  foreignPassports = data.foreignPassports, isRussian = data.isRussian;
            function formatPassports(passports) {
                if (!passports || passports.length === 0) return '';
                let result = '';
                passports.forEach(function(p, index) {
                    if (index > 0) result += '\n---\n';
                    result += p.marker + ':\n' + p.surname + '\n' + p.name;
                    if (p.patronymic) result += '\n' + p.patronymic;
                    result += '\n' + p.number + '\n' + p.expiry;
                });
                return result;
            }
            if (type === 'standard') {
                if (isRussian) {
                    cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone + '\n' + passportRF + '\n\n' + shortCompanies;
                    if (costCenter) cardText += '\n\nЦЗ: **' + costCenter + '**';
                } else {
                    let foreignPart = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nПаспорт иностранного гр-на не найден';
                    cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone + '\n\n' + citizenship + foreignPart + '\n\n' + shortCompanies;
                    if (costCenter) cardText += '\n\nЦЗ: **' + costCenter + '**';
                }
            } else if (type === 'rail') {
                let foreignPart = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nЗагран.паспорт не найден';
                cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone;
                if (!isRussian) cardText += '\n\n' + citizenship;
                cardText += foreignPart + '\n\n' + shortCompanies;
                if (costCenter) cardText += '\n\nЦЗ: **' + costCenter + '**';
            } else if (type === 'insurance') {
                let foreignPart = foreignPassports.length > 0 ? '\n\n' + formatPassports(foreignPassports) : '\n\nЗагран.паспорт не найден';
                cardText = link + '\n\n' + fullName + '\n' + dateString + '\n' + phone;
                if (isRussian) cardText += '\n' + passportRF; else cardText += '\n\n' + citizenship;
                cardText += '\n\nEmail: ' + email + foreignPart + '\n\n' + shortCompanies;
                if (costCenter) cardText += '\n\nЦЗ: **' + costCenter + '**';
            }
            lastCardText = cardText;
            contentArea.textContent = cardText;
            console.log('[SMARTWAY] Карточка сгенерирована, длина:', lastCardText.length);
        }, 50);
    }

    function openPanelAndGenerate(type) {
        let panel = document.getElementById('smartway-panel');
        if (!panel) { createPanel(); panel = document.getElementById('smartway-panel'); }
        else panel.style.display = 'block';
        if (!cachedData) cachedData = parsePageData();
        const btn = document.querySelector('#smartway-panel .type-btn[data-type="' + type + '"]');
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
