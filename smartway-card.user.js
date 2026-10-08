// ==UserScript==
// @name         Карточка сотрудника Smartway
// @namespace    https://smartway.today/
// @version      1.3
// @description  Извлекает данные сотрудника и формирует карточку (Стандартная / ЖД / Страховка)
// @author       Smartway
// @match        https://bo.sandbox.smartway.today/*
// @match        https://bo.smartway.today/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://cdn.jsdelivr.net/gh/HorrorStoryy/smartway-card@main/smartway-card.meta.js
// @downloadURL  https://cdn.jsdelivr.net/gh/HorrorStoryy/smartway-card@main/smartway-card.user.js
// @supportURL   https://github.com/HorrorStoryy/smartway-card/issues
// ==/UserScript==

(function() {
    'use strict';

    let cachedData = null;
    let lastCardText = '';

    // ---------- КНОПКА-ТРИГГЕР ----------
    function createToggleButton() {
        const oldBtn = document.getElementById('smartway-toggle');
        if (oldBtn) oldBtn.remove();
        const toggle = document.createElement('button');
        toggle.id = 'smartway-toggle';
        toggle.textContent = '📋';
        toggle.style.cssText = `position: fixed; top: 100px; right: 20px; z-index: 999999; background: #4CAF50; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 24px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.3); transition: 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.8;`;
        toggle.onmouseover = () => { toggle.style.opacity = '1'; toggle.style.transform = 'scale(1.05)'; };
        toggle.onmouseout = () => { toggle.style.opacity = '0.8'; toggle.style.transform = 'scale(1)'; };
        toggle.onclick = () => {
            let panel = document.getElementById('smartway-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel.style.display === 'block' && !cachedData) {
                    cachedData = parsePageData();
                }
            } else {
                createPanel();
            }
        };
        document.body.appendChild(toggle);
    }

    // ---------- ПАРСИНГ СТРАНИЦЫ ----------
    function parsePageData() {
        const text = document.body.innerText;

        function findValue(label) {
            const regex = new RegExp(label.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '\\s[:–-]?\\s*([^\\n]+)', 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        }

        function cleanFullName(raw) {
            if (!raw) return '';
            let cleaned = raw.replace(/done_outline/gi, '').trim();
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            return cleaned;
        }

        function getShortCompanies() {
            const accountIndex = text.indexOf('АККАУНТЫ');
            if (accountIndex === -1) return '';
            const endMarkers = ['БОНУСНЫЕ КАРТЫ', 'ДОКУМЕНТЫ', 'TRAVEL ПОЛИТИКИ', 'ПРАВА'];
            let endPos = text.length;
            for (let marker of endMarkers) {
                const idx = text.indexOf(marker, accountIndex);
                if (idx !== -1 && idx < endPos) endPos = idx;
            }
            const section = text.substring(accountIndex, endPos);
            if (/Структурная группа/i.test(section)) {
                return parseStructuredGroups(section);
            }
            const startLabel = 'Список коротких компаний:';
            const startPos = section.indexOf(startLabel);
            if (startPos === -1) return '';
            let pos = startPos + startLabel.length;
            while (pos < section.length && (section[pos] === ' ' || section[pos] === '\n' || section[pos] === '\r')) pos++;
            const oldEndMarkers = ['Отделы:', 'Структурная группа'];
            let oldEndPos = section.length;
            for (let marker of oldEndMarkers) {
                const idx = section.indexOf(marker, pos);
                if (idx !== -1 && idx < oldEndPos) oldEndPos = idx;
            }
            return section.substring(pos, oldEndPos).trim();
        }

        function parseStructuredGroups(section) {
            const parts = section.split(/(?=Структурная группа)/i).map(p => p.trim()).filter(p => p);
            const results = [];
            for (let part of parts) {
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
                        if (afterColon) {
                            shortCompanies = afterColon;
                        } else {
                            for (let i = scIdx + 1; i < lines.length; i++) {
                                if (lines[i] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[i])) {
                                    shortCompanies = lines[i];
                                    break;
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
                        if (afterColon) {
                            departments = afterColon;
                        } else {
                            for (let i = deptIdx + 1; i < lines.length; i++) {
                                if (lines[i] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[i])) {
                                    departments = lines[i];
                                    break;
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
            for (let marker of markers) {
                let pos = text.indexOf(marker);
                while (pos !== -1) {
                    parts.push({ marker, start: pos });
                    pos = text.indexOf(marker, pos + 1);
                }
            }
            parts.sort((a, b) => a.start - b.start);
            for (let i = 0; i < parts.length; i++) {
                const start = parts[i].start + parts[i].marker.length;
                const nextStart = (i + 1 < parts.length) ? parts[i+1].start : text.length;
                const section = text.substring(start, nextStart);
                const surnameMatch = section.match(/Фамилия\s*[:–-]?\s*([^\n]+)/i);
                const nameMatch = section.match(/Имя\s*[:–-]?\s*([^\n]+)/i);
                const patronymicMatch = section.match(/Отчество\s*[:–-]?\s*([^\n]+)/i);
                const numberMatch = section.match(/Номер\s*[:–-]?\s*([^\n]+)/i);
                const expiryMatch = section.match(/Срок действия\s*[:–-]?\s*([^\n]+)/i);
                results.push({
                    surname: surnameMatch ? surnameMatch[1].trim() : '',
                    name: nameMatch ? nameMatch[1].trim() : '',
                    patronymic: patronymicMatch ? patronymicMatch[1].trim() : '',
                    number: numberMatch ? numberMatch[1].trim() : '',
                    expiry: expiryMatch ? expiryMatch[1].trim() : '',
                    marker: parts[i].marker
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
            const months = {
                'янв':'01','фев':'02','мар':'03','апр':'04','мая':'05','май':'05',
                'июн':'06','июл':'07','авг':'08','сен':'09','окт':'10','ноя':'11','дек':'12',
                'января':'01','февраля':'02','марта':'03','апреля':'04','мая':'05',
                'июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12'
            };
            const match = raw.match(/(\d+)\s*([а-яё]+).?\s*(\d{4})\s*г?.?/i);
            if (!match) return '';
            const day = match[1].padStart(2, '0');
            const monthKey = match[2].toLowerCase();
            const month = months[monthKey] || months[monthKey.slice(0,3)] || '00';
            if (month === '00') return '';
            const year = match[3];
            return `${day}.${month}.${year}`;
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

        return {
            link: window.location.href,
            fullName, dateString, phone, citizenship, email, costCenter, shortCompanies,
            passportRF, foreignPassports, isRussian
        };
    }

    // ---------- СОЗДАНИЕ ПАНЕЛИ ----------
    function createPanel() {
        const existing = document.getElementById('smartway-panel');
        if (existing) {
            existing.style.display = 'block';
            return;
        }
        const panel = document.createElement('div');
        panel.id = 'smartway-panel';
        panel.style.cssText = `position: fixed; top: 80px; right: 
