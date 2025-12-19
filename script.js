// ===== КОНСТАНТЫ И КОНФИГУРАЦИЯ =====
const chartsModule = {
    // Конфигурация графиков
    config: {
        colors: {
            category10: [
                '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
            ],
            set1: [
                '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
                '#ffff33', '#a65628', '#f781bf', '#999999'
            ],
            set2: [
                '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854',
                '#ffd92f', '#e5c494', '#b3b3b3'
            ],
            set3: [
                '#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3',
                '#fdb462', '#b3de69', '#fccde5', '#d9d9d9'
            ],
            tableau10: [
                '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
                '#edc949', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'
            ]
        },
        defaultExclude: ['NTC', 'ntc']
    },
    
    // DOM элементы графиков
    dom: {
        chartsSection: document.getElementById('chartsSection'),
        chartsContainer: document.getElementById('chartsContainer'),
        generateChartsBtn: document.getElementById('generateChartsBtn'),
        downloadAllChartsBtn: document.getElementById('downloadAllChartsBtn'),
        exportChartsDataBtn: document.getElementById('exportChartsDataBtn'),
        excludeSamplesInput: document.getElementById('excludeSamples'),
        colorSchemeSelect: document.getElementById('colorScheme'),
        chartOrientationSelect: document.getElementById('chartOrientation'),
        showValuesCheckbox: document.getElementById('showValues'),
        sortByValueCheckbox: document.getElementById('sortByValue')
    },
    
    // Сгенерированные графики
    charts: [],
    
    // Инициализация модуля графиков
    init() {
        this.dom.generateChartsBtn.addEventListener('click', () => this.generateCharts());
        this.dom.downloadAllChartsBtn.addEventListener('click', () => this.downloadAllCharts());
        this.dom.exportChartsDataBtn.addEventListener('click', () => this.exportChartsData());
        
        // Установка значения по умолчанию для исключений
        this.dom.excludeSamplesInput.value = this.config.defaultExclude.join(', ');
    },
    
    // Генерация всех графиков
    generateCharts() {
        if (!state.normalizedData || Object.keys(state.normalizedData).length === 0) {
            utils.showMessage('Сначала выполните нормировку данных', 'error');
            return;
        }
        
        // Показываем секцию графиков
        this.dom.chartsSection.style.display = 'block';
        
        // Очищаем контейнер
        this.dom.chartsContainer.innerHTML = '<div class="loading-chart"><div class="loading-spinner"></div>Генерация графиков...</div>';
        
        // Даем время на отрисовку загрузки
        setTimeout(() => {
            try {
                // Получаем настройки
                const excludeSamples = this.getExcludedSamples();
                const colorScheme = this.dom.colorSchemeSelect.value;
                const orientation = this.dom.chartOrientationSelect.value;
                const showValues = this.dom.showValuesCheckbox.checked;
                const sortByValue = this.dom.sortByValueCheckbox.checked;
                
                // Фильтруем данные для графиков
                const chartData = this.prepareChartData(excludeSamples);
                
                if (Object.keys(chartData).length === 0) {
                    this.showNoDataMessage();
                    return;
                }
                
                // Генерируем графики
                this.createCharts(chartData, { colorScheme, orientation, showValues, sortByValue });
                
                // Прокручиваем к графикам
                this.dom.chartsSection.scrollIntoView({ behavior: 'smooth' });
                
                utils.showMessage(`Сгенерировано ${Object.keys(chartData).length} графиков`, 'success');
                
            } catch (error) {
                console.error('Ошибка при генерации графиков:', error);
                utils.showMessage('Ошибка при генерации графиков: ' + error.message, 'error');
            }
        }, 100);
    },
    
    // Получение списка исключенных образцов
    getExcludedSamples() {
        const input = this.dom.excludeSamplesInput.value;
        if (!input.trim()) return this.config.defaultExclude;
        
        return input.split(',')
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0)
            .concat(this.config.defaultExclude);
    },
    
    // Подготовка данных для графиков
    prepareChartData(excludeSamples) {
        const chartData = {};
        const excludedSet = new Set(excludeSamples);
        
        for (const target in state.normalizedData) {
            // Пропускаем контрольный ген нормировки
            if (target === state.normalizationGene) continue;
            
            // Пропускаем NTC (уже в excludedSet, но для надежности)
            if (target.toUpperCase().includes('NTC')) continue;
            
            const samplesData = state.normalizedData[target];
            const chartSamples = {};
            
            // Фильтруем данные по образцам
            for (const sample in samplesData) {
                const sampleLower = sample.toLowerCase();
                let shouldExclude = false;
                
                // Проверяем, нужно ли исключить этот образец
                for (const excluded of excludedSet) {
                    if (sampleLower.includes(excluded)) {
                        shouldExclude = true;
                        break;
                    }
                }
                
                if (!shouldExclude) {
                    const data = samplesData[sample];
                    if (data.normalizedMean !== null && data.normalizedMean !== undefined) {
                        chartSamples[sample] = data.normalizedMean;
                    }
                }
            }
            
            // Добавляем в данные для графика, если есть хотя бы один образец
            if (Object.keys(chartSamples).length > 0) {
                chartData[target] = chartSamples;
            }
        }
        
        return chartData;
    },
    
    // Создание графиков
    createCharts(chartData, options) {
        // Очищаем контейнер
        this.dom.chartsContainer.innerHTML = '';
        this.charts = [];
        
        // Получаем цвета
        const colors = this.config.colors[options.colorScheme] || this.config.colors.category10;
        
        // Создаем график для каждого Target
        for (const [targetIndex, target] of Object.keys(chartData).entries()) {
            const chartId = `chart-${target.replace(/\s+/g, '-').toLowerCase()}`;
            const samplesData = chartData[target];
            
            // Создаем карточку графика
            const chartCard = this.createChartCard(target, chartId, samplesData);
            
            // Добавляем в контейнер
            this.dom.chartsContainer.appendChild(chartCard);
            
            // Создаем график
            setTimeout(() => {
                const chart = this.createSingleChart(chartId, target, samplesData, colors, options);
                if (chart) {
                    this.charts.push({ target, chart });
                }
            }, 50 * targetIndex); // Небольшая задержка для анимации
        }
        
        // Если графиков нет, показываем сообщение
        if (Object.keys(chartData).length === 0) {
            this.showNoDataMessage();
        }
    },
    
    // Создание карточки для графика
    createChartCard(target, chartId, samplesData) {
        const card = document.createElement('div');
        card.className = 'chart-card';
        
        // Рассчитываем статистику
        const values = Object.values(samplesData);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        
        card.innerHTML = `
            <div class="chart-header">
                <h3 class="chart-title">${target}</h3>
                <button class="chart-download" data-chart-id="${chartId}">
                    📥 Скачать
                </button>
            </div>
            <div class="chart-body">
                <div class="chart-wrapper">
                    <canvas id="${chartId}" class="chart-canvas"></canvas>
                </div>
                <div class="chart-stats">
                    <div class="chart-stat">
                        <span class="chart-stat-label">Образцов:</span>
                        <span class="chart-stat-value">${values.length}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="chart-stat-label">Максимум:</span>
                        <span class="chart-stat-value">${maxValue.toFixed(4)}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="chart-stat-label">Минимум:</span>
                        <span class="chart-stat-value">${minValue.toFixed(4)}</span>
                    </div>
                    <div class="chart-stat">
                        <span class="chart-stat-label">Среднее:</span>
                        <span class="chart-stat-value">${avgValue.toFixed(4)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем обработчик для кнопки скачивания
        card.querySelector('.chart-download').addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadChart(chartId, target);
        });
        
        // Добавляем обработчик для скачивания по клику на график
        card.querySelector('.chart-body').addEventListener('click', () => {
            this.downloadChart(chartId, target);
        });
        
        return card;
    },
    
    // Создание одного графика
    createSingleChart(chartId, target, samplesData, colors, options) {
        const canvas = document.getElementById(chartId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        // Подготавливаем данные
        let labels = Object.keys(samplesData);
        let data = Object.values(samplesData);
        
        // Сортируем по значению, если нужно
        if (options.sortByValue) {
            const sorted = labels
                .map((label, index) => ({ label, value: data[index] }))
                .sort((a, b) => b.value - a.value);
            
            labels = sorted.map(item => item.label);
            data = sorted.map(item => item.value);
        }
        
        // Создаем массив цветов
        const backgroundColors = labels.map((_, index) => 
            colors[index % colors.length] + 'CC' // Добавляем прозрачность
        );
        
        const borderColors = labels.map((_, index) => 
            colors[index % colors.length]
        );
        
        // Конфигурация графика
        const config = {
            type: options.orientation === 'horizontal' ? 'bar' : 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `Нормированное значение (${target})`,
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: options.orientation === 'horizontal' ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed[options.orientation === 'horizontal' ? 'x' : 'y'].toFixed(6)}`;
                            }
                        }
                    },
                    datalabels: options.showValues ? {
                        display: true,
                        color: '#2c3e50',
                        font: {
                            weight: 'bold',
                            size: 10
                        },
                        anchor: 'end',
                        align: 'end',
                        formatter: (value) => value.toFixed(4)
                    } : undefined
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: options.orientation === 'horizontal' ? 'Нормированное значение' : 'Образец',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: options.orientation === 'horizontal' ? 0 : 45,
                            minRotation: options.orientation === 'horizontal' ? 0 : 45
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: options.orientation === 'horizontal' ? 'Образец' : 'Нормированное значение',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        };
        
        // Создаем график
        try {
            return new Chart(ctx, config);
        } catch (error) {
            console.error(`Ошибка при создании графика для ${target}:`, error);
            return null;
        }
    },
    
    // Скачивание одного графика
    downloadChart(chartId, target) {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        
        // Создаем временный canvas с лучшим качеством
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Устанавливаем размеры для высокого качества
        tempCanvas.width = canvas.width * 2;
        tempCanvas.height = canvas.height * 2;
        
        // Копируем содержимое
        tempCtx.scale(2, 2);
        tempCtx.drawImage(canvas, 0, 0);
        
        // Создаем ссылку для скачивания
        const link = document.createElement('a');
        link.download = `График_${target}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
        
        utils.showMessage(`График "${target}" скачан!`, 'success');
    },
    
    // Скачивание всех графиков
    async downloadAllCharts() {
        if (this.charts.length === 0) {
            utils.showMessage('Нет графиков для скачивания', 'error');
            return;
        }
        
        utils.showMessage(`Начинаю скачивание ${this.charts.length} графиков...`, 'info');
        
        // Создаем ZIP архив
        const zip = new JSZip();
        
        for (const { target, chart } of this.charts) {
            try {
                // Получаем данные графика в формате PNG
                const imageData = chart.toBase64Image();
                
                // Добавляем в ZIP
                const fileName = `График_${target}.png`;
                zip.file(fileName, imageData.split(',')[1], { base64: true });
                
            } catch (error) {
                console.error(`Ошибка при сохранении графика ${target}:`, error);
            }
        }
        
        // Генерируем и скачиваем ZIP
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Графики_ПЦР_${new Date().toISOString().split('T')[0]}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
            
            utils.showMessage(`Все графики скачаны в ZIP архиве!`, 'success');
        });
    },
    
    // Экспорт данных графиков в Excel
    exportChartsData() {
        if (!state.normalizedData) {
            utils.showMessage('Нет данных для экспорта', 'error');
            return;
        }
        
        try {
            const wb = XLSX.utils.book_new();
            const excludeSamples = this.getExcludedSamples();
            const chartData = this.prepareChartData(excludeSamples);
            
            // Создаем данные для экспорта
            const excelData = [];
            
            // Заголовок
            excelData.push(['Данные для графического анализа ПЦР']);
            excelData.push(['Дата анализа:', new Date().toLocaleString('ru-RU')]);
            excelData.push(['Ген нормировки:', state.normalizationGene]);
            excelData.push(['Исключенные образцы:', this.dom.excludeSamplesInput.value]);
            excelData.push([]);
            
            // Создаем сводную таблицу
            const allSamples = new Set();
            for (const target in chartData) {
                Object.keys(chartData[target]).forEach(sample => allSamples.add(sample));
            }
            
            const sortedSamples = Array.from(allSamples).sort();
            
            // Заголовки таблицы
            const headers = ['Target', ...sortedSamples, 'Среднее', 'Максимум', 'Минимум'];
            excelData.push(headers);
            
            // Данные по каждому Target
            for (const target in chartData) {
                const row = [target];
                const values = [];
                
                // Значения для каждого образца
                for (const sample of sortedSamples) {
                    const value = chartData[target][sample] || '';
                    row.push(value !== '' ? value : '');
                    if (value !== '') values.push(value);
                }
                
                // Статистика
                if (values.length > 0) {
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    const max = Math.max(...values);
                    const min = Math.min(...values);
                    
                    row.push(avg, max, min);
                } else {
                    row.push('', '', '');
                }
                
                excelData.push(row);
            }
            
            // Создаем лист
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            
            // Настраиваем ширину колонок
            const colWidths = [
                { wch: 20 }, // Target
                ...sortedSamples.map(() => ({ wch: 12 })), // Образцы
                { wch: 12 }, // Среднее
                { wch: 12 }, // Максимум
                { wch: 12 }  // Минимум
            ];
            ws['!cols'] = colWidths;
            
            // Добавляем лист в книгу
            XLSX.utils.book_append_sheet(wb, ws, "Chart Data");
            
            // Сохраняем файл
            XLSX.writeFile(wb, `Данные_для_графиков_ПЦР_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            utils.showMessage('Данные для графиков успешно экспортированы!', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте данных графиков:', error);
            utils.showMessage('Ошибка при экспорте данных графиков', 'error');
        }
    },
    
    // Показ сообщения об отсутствии данных
    showNoDataMessage() {
        this.dom.chartsContainer.innerHTML = `
            <div class="no-data-message">
                <div class="no-data-icon">📊</div>
                <h3>Нет данных для графиков</h3>
                <p>Проверьте настройки нормировки и исключения образцов.</p>
                <p>Возможно, все образцы были исключены или данные отсутствуют.</p>
            </div>
        `;
    },
    
    // Очистка графиков
    clearCharts() {
        this.charts.forEach(({ chart }) => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = [];
        this.dom.chartsContainer.innerHTML = '';
    }
};
const CONFIG = {
    START_ROW: 26, // 27 строка в Excel (индекс 26)
    DEFAULT_GENE: '36b4',
    DECIMAL_PLACES: 10,
    ALLOWED_FORMATS: ['.xlsx', '.xls', '.csv']
};

// ===== ГЛОБАЛЬНОЕ СОСТОЯНИЕ =====
const state = {
    pcrData: null,
    normalizedData: null,
    normalizationGene: CONFIG.DEFAULT_GENE,
    currentFile: null
};

// ===== DOM ЭЛЕМЕНТЫ =====
const dom = {
    // Форма
    excelFileInput: document.getElementById('excelFile'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    normalizationGeneInput: document.getElementById('normalizationGene'),
    updateNormBtn: document.getElementById('updateNormBtn'),
    
    // Результаты
    resultsSection: document.getElementById('resultsSection'),
    meanTabBtn: document.getElementById('meanTabBtn'),
    normTabBtn: document.getElementById('normTabBtn'),
    meanTab: document.getElementById('meanTab'),
    normTab: document.getElementById('normTab'),
    meanTable: document.getElementById('meanTable'),
    normTable: document.getElementById('normTable'),
    textOutput: document.getElementById('textOutput'),
    
    // Контролы
    exportBtn: document.getElementById('exportBtn'),
    exportNormBtn: document.getElementById('exportNormBtn'),
    copyBtn: document.getElementById('copyBtn'),
    resetBtn: document.getElementById('resetBtn'),
    fileInfo: document.getElementById('fileInfo')
};

// ===== УТИЛИТЫ =====
const utils = {
    // Форматирование значения Cq
    formatCqValue(value) {
        if (value === 0) return '0';
        if (isNaN(value) || value === undefined || value === null) return '';
        return value.toFixed(CONFIG.DECIMAL_PLACES).replace('.', ',');
    },
    
    // Чтение Excel файла
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const arrayData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        defval: null
                    });
                    resolve(arrayData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },
    
    // Проверка файла
    validateFile(file) {
        if (!file) {
            throw new Error('Файл не выбран');
        }
        
        const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!CONFIG.ALLOWED_FORMATS.includes(extension)) {
            throw new Error(`Неподдерживаемый формат файла. Допустимые форматы: ${CONFIG.ALLOWED_FORMATS.join(', ')}`);
        }
        
        return true;
    },
    
    // Показ сообщения
    showMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error' : 'success';
        messageDiv.textContent = text;
        messageDiv.style.marginTop = '1rem';
        
        dom.fileInfo.innerHTML = '';
        dom.fileInfo.appendChild(messageDiv);
        
        if (type !== 'error') {
            setTimeout(() => messageDiv.remove(), 3000);
        }
    },
    
    // Установка состояния загрузки
    setLoading(isLoading) {
        if (isLoading) {
            dom.analyzeBtn.classList.add('loading');
            dom.analyzeBtn.disabled = true;
        } else {
            dom.analyzeBtn.classList.remove('loading');
            dom.analyzeBtn.disabled = false;
        }
    }
};

// ===== ОБРАБОТКА ДАННЫХ ПЦР =====
const pcrProcessor = {
    // Основная функция обработки
    processData(rawData, startRow) {
        console.log('=== Начало обработки данных ===');
        
        // Поиск заголовков
        const headerRow = rawData[startRow];
        if (!headerRow || headerRow.length === 0) {
            throw new Error(`Строка ${startRow + 1} не найдена или пуста в файле`);
        }
        
        // Поиск индексов колонок
        const columnIndexes = this.findColumnIndexes(headerRow);
        
        // Обработка данных
        const groupedData = this.groupData(rawData, startRow, columnIndexes);
        
        // Расчет средних значений
        const processedData = this.calculateMeans(groupedData);
        
        console.log('=== Обработка завершена ===');
        return processedData;
    },
    
    // Поиск индексов колонок
    findColumnIndexes(headerRow) {
        let targetIndex = -1, sampleIndex = -1, cqIndex = -1;
        
        for (let i = 0; i < headerRow.length; i++) {
            const cellValue = String(headerRow[i] || '').trim();
            
            if (cellValue.toLowerCase() === 'target') targetIndex = i;
            if (cellValue.toLowerCase() === 'sample') sampleIndex = i;
            if (cellValue === 'Cq' || cellValue === 'CQ' || cellValue === 'cq') cqIndex = i;
        }
        
        if (targetIndex === -1 || sampleIndex === -1 || cqIndex === -1) {
            throw new Error('Не найдены необходимые колонки: Target, Sample, Cq');
        }
        
        return { targetIndex, sampleIndex, cqIndex };
    },
    
    // Группировка данных
    groupData(rawData, startRow, columnIndexes) {
        const { targetIndex, sampleIndex, cqIndex } = columnIndexes;
        const result = {};
        
        for (let i = startRow + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            
            const target = row[targetIndex];
            const sample = row[sampleIndex];
            const cqValue = row[cqIndex];
            
            if (!sample || !target) continue;
            
            const sampleStr = String(sample).trim();
            const targetStr = String(target).trim();
            
            // Обработка значения Cq
            let numericCq = this.parseCqValue(cqValue);
            
            // Группировка по Target → Sample
            if (!result[targetStr]) result[targetStr] = {};
            if (!result[targetStr][sampleStr]) result[targetStr][sampleStr] = [];
            
            result[targetStr][sampleStr].push(numericCq);
        }
        
        return result;
    },
    
    // Парсинг значения Cq
    parseCqValue(cqValue) {
        if (cqValue === undefined || cqValue === null || cqValue === '') {
            return 0;
        }
        
        if (String(cqValue).toUpperCase().includes('UNDETERMINED')) {
            return 0;
        }
        
        const cqStr = String(cqValue).replace(',', '.');
        const numericCq = parseFloat(cqStr);
        
        return isNaN(numericCq) ? 0 : numericCq;
    },
    
    // Расчет средних значений
    calculateMeans(groupedData) {
        const result = {};
        
        for (const target in groupedData) {
            result[target] = {};
            
            for (const sample in groupedData[target]) {
                const values = groupedData[target][sample];
                const nonZeroValues = values.filter(val => val !== 0);
                
                let mean;
                if (values.length === 0) {
                    mean = 0;
                } else if (values.length === 1) {
                    mean = values[0];
                } else if (nonZeroValues.length === 0) {
                    mean = 0;
                } else if (nonZeroValues.length === 1) {
                    mean = nonZeroValues[0];
                } else {
                    mean = nonZeroValues.reduce((sum, val) => sum + val, 0) / nonZeroValues.length;
                }
                
                result[target][sample] = {
                    values: values,
                    mean: mean
                };
            }
        }
        
        return result;
    },
    
    // Нормировка данных
    normalizeData(data, controlGene) {
        if (!data || Object.keys(data).length === 0) return {};
        
        // Поиск контрольного гена
        if (!data[controlGene]) {
            const availableGenes = Object.keys(data);
            const similarGene = availableGenes.find(gene => 
                gene.toLowerCase() === controlGene.toLowerCase()
            );
            if (similarGene) controlGene = similarGene;
            else return {};
        }
        
        const normalizedResult = {};
        
        for (const target in data) {
            normalizedResult[target] = {};
            
            for (const sample in data[target]) {
                const targetData = data[target][sample];
                
                if (target === controlGene) {
                    // Контрольный ген
                    normalizedResult[target][sample] = {
                        ...targetData,
                        normalizedMean: targetData.mean,
                        isControlGene: true
                    };
                } else {
                    // Обычный ген
                    const controlGeneData = data[controlGene][sample];
                    
                    if (!controlGeneData || targetData.mean === 0 || controlGeneData.mean === 0) {
                        normalizedResult[target][sample] = {
                            ...targetData,
                            normalizedMean: null,
                            isControlGene: false
                        };
                    } else {
                        const deltaCq = targetData.mean - controlGeneData.mean;
                        const normalizedValue = Math.pow(2, -deltaCq);
                        
                        normalizedResult[target][sample] = {
                            ...targetData,
                            normalizedMean: normalizedValue,
                            isControlGene: false,
                            deltaCq: deltaCq
                        };
                    }
                }
            }
        }
        
        return normalizedResult;
    }
};

// ===== ПОЛЬЗОВАТЕЛЬСКИЙ ИНТЕРФЕЙС =====
const ui = {
    // Отображение результатов
    displayResults(data, normalizedData = null) {
        if (!data || Object.keys(data).length === 0) {
            this.showError('Нет данных для отображения');
            return;
        }
        
        // Показываем секцию результатов
        dom.resultsSection.style.display = 'block';
        
        // Обновляем таблицы
        this.updateMeanTable(data);
        
        if (normalizedData) {
            this.updateNormalizedTable(normalizedData);
        }
        
        // Обновляем текстовый вывод
        this.updateTextOutput(data, normalizedData);
        
        // Прокручиваем к результатам
        dom.resultsSection.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Обновление таблицы средних значений
    updateMeanTable(data) {
        const html = this.createMeanTableHTML(data);
        dom.meanTable.innerHTML = html;
    },
    
    // Обновление таблицы нормированных значений
    updateNormalizedTable(normalizedData) {
        const html = this.createNormalizedTableHTML(normalizedData);
        dom.normTable.innerHTML = html;
    },
    
    // Создание HTML для таблицы средних значений
    createMeanTableHTML(data) {
        const sortedTargets = this.sortTargets(data);
        let html = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Target (Ген)</th>
                        <th>Sample (Образец)</th>
                        <th>Cq 1</th>
                        <th>Cq 2</th>
                        <th style="background: #f1c40f; color: #2c3e50;">Среднее Cq</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedTargets.forEach(target => {
            const sortedSamples = Object.keys(data[target]).sort();
            const isControlGene = target === state.normalizationGene;
            const isNTC = target.toUpperCase().includes('NTC');
            
            const targetBgColor = isNTC ? '#c0392b' : (isControlGene ? '#27ae60' : '#34495e');
            
            html += `
                <tr style="background-color: ${targetBgColor};">
                    <td colspan="5" style="color: white; font-weight: bold; border: none;">
                        ${target}
                        ${isControlGene ? ' <span style="font-size: 0.9em;">(ген нормировки)</span>' : ''}
                        ${isNTC ? ' <span style="font-size: 0.9em;">(контроль без матрицы)</span>' : ''}
                    </td>
                </tr>
            `;
            
            sortedSamples.forEach((sample, sampleIndex) => {
                const sampleData = data[target][sample];
                const value1 = utils.formatCqValue(sampleData.values[0]);
                const value2 = utils.formatCqValue(sampleData.values[1]);
                const meanValue = utils.formatCqValue(sampleData.mean);
                
                let rowStyle = sampleIndex % 2 === 0 ? 'background-color: #f8f9fa;' : '';
                if (sampleData.mean === 0) rowStyle = 'background-color: #ffeaa7;';
                
                const meanCellBg = isControlGene ? '#d5f4e6' : 
                                 (sampleData.mean === 0 ? '#ffeaa7' : '#e8f4f8');
                
                html += `
                    <tr style="${rowStyle}">
                        <td></td>
                        <td style="font-weight: 500;">${sample}</td>
                        <td style="text-align: center; font-family: monospace;">${value1}</td>
                        <td style="text-align: center; font-family: monospace;">${value2}</td>
                        <td style="text-align: center; font-weight: bold; font-family: monospace; background: ${meanCellBg};">${meanValue}</td>
                    </tr>
                `;
            });
        });
        
        html += `</tbody></table></div>`;
        return html;
    },
    
    // Создание HTML для таблицы нормированных значений
    createNormalizedTableHTML(normalizedData) {
        if (!normalizedData || Object.keys(normalizedData).length === 0) {
            return '<div class="error">Нет данных для нормировки</div>';
        }
        
        const sortedTargets = this.sortTargetsForNormalization(normalizedData);
        let html = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Target (Ген)</th>
                        <th>Sample (Образец)</th>
                        <th style="background: #f1c40f; color: #2c3e50;">Среднее Cq</th>
                        <th style="background: #e74c3c; color: white;">Нормированное</th>
                        <th style="background: #9b59b6; color: white;">ΔCq</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedTargets.forEach(target => {
            const sortedSamples = Object.keys(normalizedData[target]).sort();
            const isControlGene = target === state.normalizationGene;
            const isNTC = target.toUpperCase().includes('NTC');
            
            const targetBgColor = isNTC ? '#c0392b' : (isControlGene ? '#27ae60' : '#34495e');
            
            html += `
                <tr style="background-color: ${targetBgColor};">
                    <td colspan="5" style="color: white; font-weight: bold; border: none;">
                        ${target}
                        ${isControlGene ? ' <span style="font-size: 0.9em;">(ген нормировки)</span>' : ''}
                    </td>
                </tr>
            `;
            
            sortedSamples.forEach((sample, sampleIndex) => {
                const sampleData = normalizedData[target][sample];
                const meanValue = utils.formatCqValue(sampleData.mean);
                
                let normalizedValue = '—';
                let deltaCqValue = '—';
                
                if (!isControlGene && !isNTC && sampleData.normalizedMean !== null) {
                    normalizedValue = sampleData.normalizedMean.toFixed(6);
                    deltaCqValue = sampleData.deltaCq ? sampleData.deltaCq.toFixed(4) : '—';
                } else if (isControlGene) {
                    deltaCqValue = '0.0000';
                }
                
                let rowStyle = sampleIndex % 2 === 0 ? 'background-color: #f8f9fa;' : '';
                
                html += `
                    <tr style="${rowStyle}">
                        <td></td>
                        <td style="font-weight: 500;">${sample}</td>
                        <td style="text-align: center; font-family: monospace; background: #e8f4f8;">${meanValue}</td>
                        <td style="text-align: center; font-family: monospace; font-weight: bold; background: #ffcccc;">${normalizedValue}</td>
                        <td style="text-align: center; font-family: monospace; background: #e8ccff;">${deltaCqValue}</td>
                    </tr>
                `;
            });
        });
        
        html += `</tbody></table></div>`;
        return html;
    },
    
    // Сортировка генов
    sortTargets(data) {
        return Object.keys(data).sort((a, b) => {
            const aIsNTC = a.toUpperCase().includes('NTC');
            const bIsNTC = b.toUpperCase().includes('NTC');
            if (aIsNTC && !bIsNTC) return -1;
            if (!aIsNTC && bIsNTC) return 1;
            return a.localeCompare(b);
        });
    },
    
    // Сортировка генов для нормировки
    sortTargetsForNormalization(normalizedData) {
        return Object.keys(normalizedData).sort((a, b) => {
            const aIsControl = a === state.normalizationGene;
            const bIsControl = b === state.normalizationGene;
            const aIsNTC = a.toUpperCase().includes('NTC');
            const bIsNTC = b.toUpperCase().includes('NTC');
            
            if (aIsControl && !bIsControl) return -1;
            if (!aIsControl && bIsControl) return 1;
            if (aIsNTC && !bIsNTC) return -1;
            if (!aIsNTC && bIsNTC) return 1;
            return a.localeCompare(b);
        });
    },
    
    // Обновление текстового вывода
    updateTextOutput(data, normalizedData = null) {
        let text = '';
        const sortedTargets = this.sortTargets(data);
        
        // Средние значения
        text += '=== СРЕДНИЕ ЗНАЧЕНИЯ Cq ===\n\n';
        sortedTargets.forEach(target => {
            text += `${target}\n`;
            const sortedSamples = Object.keys(data[target]).sort();
            sortedSamples.forEach(sample => {
                const sampleData = data[target][sample];
                const value1 = utils.formatCqValue(sampleData.values[0]);
                const value2 = utils.formatCqValue(sampleData.values[1]);
                const meanValue = utils.formatCqValue(sampleData.mean);
                text += `\t${sample}\t${value1}\t${value2}\t${meanValue}\n`;
            });
            text += '\n';
        });
        
        // Нормированные значения
        if (normalizedData) {
            text += `\n=== НОРМИРОВАННЫЕ ЗНАЧЕНИЯ (по гену ${state.normalizationGene}) ===\n\n`;
            const sortedNormTargets = this.sortTargetsForNormalization(normalizedData);
            
            sortedNormTargets.forEach(target => {
                text += `${target}\n`;
                const sortedSamples = Object.keys(normalizedData[target]).sort();
                const isControlGene = target === state.normalizationGene;
                
                sortedSamples.forEach(sample => {
                    const sampleData = normalizedData[target][sample];
                    const meanValue = utils.formatCqValue(sampleData.mean);
                    
                    if (isControlGene) {
                        text += `\t${sample}\t${meanValue}\t—\t—\n`;
                    } else {
                        const normValue = sampleData.normalizedMean !== null ? 
                            sampleData.normalizedMean.toFixed(6) : '—';
                        const deltaCq = sampleData.deltaCq !== undefined ? 
                            sampleData.deltaCq.toFixed(4) : '—';
                        text += `\t${sample}\t${meanValue}\t${normValue}\tΔCq=${deltaCq}\n`;
                    }
                });
                text += '\n';
            });
        }
        
        // Отображение в интерфейсе
        dom.textOutput.innerHTML = `
            <div class="text-output-content">
                <pre>${text}</pre>
            </div>
            <div style="padding: 1rem; background: #2c3e50;">
                <button id="copyTextBtn" class="btn btn-secondary" style="margin-right: 1rem;">
                    <span class="btn-icon">📋</span>
                    Копировать текст
                </button>
                <button id="downloadTextBtn" class="btn btn-secondary">
                    <span class="btn-icon">💾</span>
                    Скачать как файл
                </button>
            </div>
        `;
        
        // Назначаем обработчики для новых кнопок
        document.getElementById('copyTextBtn').addEventListener('click', this.copyTextToClipboard.bind(this, text));
        document.getElementById('downloadTextBtn').addEventListener('click', this.downloadTextFile.bind(this, text));
    },
    
    // Копирование текста в буфер обмена
    copyTextToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            utils.showMessage('Текст успешно скопирован в буфер обмена!', 'success');
        }).catch(err => {
            console.error('Ошибка при копировании:', err);
            utils.showMessage('Не удалось скопировать текст', 'error');
        });
    },
    
    // Скачивание текстового файла
    downloadTextFile(text) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pcr_results_${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    // Показать ошибку
    showError(message) {
        utils.showMessage(message, 'error');
    },
    
    // Переключение вкладок
    switchTab(tabName) {
        // Обновляем кнопки
        dom.meanTabBtn.classList.remove('active');
        dom.normTabBtn.classList.remove('active');
        
        // Скрываем все вкладки
        dom.meanTab.classList.remove('active');
        dom.normTab.classList.remove('active');
        
        // Показываем выбранную вкладку
        if (tabName === 'mean') {
            dom.meanTabBtn.classList.add('active');
            dom.meanTab.classList.add('active');
        } else {
            dom.normTabBtn.classList.add('active');
            dom.normTab.classList.add('active');
        }
    }
};

// ===== ЭКСПОРТ В EXCEL =====
const excelExporter = {
    // Экспорт средних значений
    exportToExcel() {
        if (!state.pcrData || Object.keys(state.pcrData).length === 0) {
            utils.showMessage('Нет данных для экспорта', 'error');
            return;
        }
        
        try {
            const wb = XLSX.utils.book_new();
            const excelData = [];
            
            // Заголовок
            excelData.push(['Результаты анализа ПЦР']);
            excelData.push(['Дата анализа:', new Date().toLocaleString('ru-RU')]);
            excelData.push(['Группировка по Target']);
            excelData.push([]);
            
            // Данные
            const sortedTargets = ui.sortTargets(state.pcrData);
            sortedTargets.forEach(target => {
                excelData.push([`Target: ${target}`]);
                excelData.push(['Sample', 'Cq 1', 'Cq 2', 'Среднее Cq']);
                
                const sortedSamples = Object.keys(state.pcrData[target]).sort();
                sortedSamples.forEach(sample => {
                    const sampleData = state.pcrData[target][sample];
                    excelData.push([
                        sample,
                        sampleData.values[0] || '',
                        sampleData.values[1] || '',
                        sampleData.mean
                    ]);
                });
                excelData.push([]);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, "PCR Results");
            XLSX.writeFile(wb, `PCR_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            utils.showMessage('Файл успешно экспортирован!', 'success');
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            utils.showMessage('Ошибка при экспорте в Excel', 'error');
        }
    },
    
    // Экспорт нормированных данных
    exportNormalizedToExcel() {
        if (!state.normalizedData || Object.keys(state.normalizedData).length === 0) {
            utils.showMessage('Нет нормированных данных для экспорта', 'error');
            return;
        }
        
        try {
            const wb = XLSX.utils.book_new();
            const excelData = [];
            
            // Заголовок
            excelData.push(['Нормированные результаты анализа ПЦР']);
            excelData.push(['Ген нормировки:', state.normalizationGene]);
            excelData.push(['Дата анализа:', new Date().toLocaleString('ru-RU')]);
            excelData.push(['Формула нормировки: 2^(-ΔCq), где ΔCq = Cq_гена - Cq_' + state.normalizationGene]);
            excelData.push([]);
            
            // Данные
            const sortedTargets = ui.sortTargetsForNormalization(state.normalizedData);
            sortedTargets.forEach(target => {
                excelData.push([`Target: ${target}`]);
                excelData.push(['Sample', 'Cq 1', 'Cq 2', 'Среднее Cq', 'ΔCq', 'Нормированное значение']);
                
                const sortedSamples = Object.keys(state.normalizedData[target]).sort();
                sortedSamples.forEach(sample => {
                    const sampleData = state.normalizedData[target][sample];
                    excelData.push([
                        sample,
                        sampleData.values[0] || '',
                        sampleData.values[1] || '',
                        sampleData.mean,
                        sampleData.deltaCq || '',
                        sampleData.normalizedMean || ''
                    ]);
                });
                excelData.push([]);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, "Normalized PCR Results");
            XLSX.writeFile(wb, `PCR_Normalized_${state.normalizationGene}_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            utils.showMessage('Нормированные данные успешно экспортированы!', 'success');
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            utils.showMessage('Ошибка при экспорте нормированных данных', 'error');
        }
    }
};

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
const eventHandlers = {
    // Анализ данных
    async handleAnalyze() {
        try {
            const file = dom.excelFileInput.files[0];
            utils.validateFile(file);
            
            utils.setLoading(true);
            utils.showMessage('Обработка файла...', 'info');
            
            // Чтение файла
            const rawData = await utils.readExcelFile(file);
            
            // Обработка данных
            state.pcrData = pcrProcessor.processData(rawData, CONFIG.START_ROW);
            
            // Нормировка
            const normGene = dom.normalizationGeneInput.value.trim() || CONFIG.DEFAULT_GENE;
            state.normalizationGene = normGene;
            state.normalizedData = pcrProcessor.normalizeData(state.pcrData, normGene);
            
            // Отображение результатов
            ui.displayResults(state.pcrData, state.normalizedData);
            
            utils.showMessage('Файл успешно обработан!', 'success');
            
        } catch (error) {
            console.error('Ошибка:', error);
            utils.showMessage(error.message, 'error');
        } finally {
            utils.setLoading(false);
        }
    },

    handleCopyToClipboard() {
    const textDiv = document.querySelector('.text-output-content pre');
    if (!textDiv) {
        utils.showMessage('Нет текста для копирования', 'error');
        return;
        }
    
    ui.copyTextToClipboard(textDiv.textContent);
    },
    
    // Обновление нормировки
    handleUpdateNormalization() {
        if (!state.pcrData) {
            utils.showMessage('Сначала загрузите и проанализируйте данные', 'error');
            return;
        }
        
        const newGene = dom.normalizationGeneInput.value.trim();
        if (!newGene) {
            utils.showMessage('Введите ген для нормировки', 'error');
            return;
        }
        
        state.normalizationGene = newGene;
        state.normalizedData = pcrProcessor.normalizeData(state.pcrData, newGene);
        
        // Обновляем отображение
        ui.updateNormalizedTable(state.normalizedData);
        ui.updateTextOutput(state.pcrData, state.normalizedData);
        ui.switchTab('norm');
        
        // Очищаем графики (если они есть)
        chartsModule.clearCharts();
        
        utils.showMessage(`Нормировка обновлена по гену ${newGene}`, 'success');
    },
    
    // При новом анализе
    handleReset() {
        if (confirm('Вы уверены, что хотите начать новый анализ? Все текущие данные и графики будут потеряны.')) {
            location.reload();
        }
    }
};
    
// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
function init() {
    console.log('Инициализация приложения...');
    
    // Назначаем обработчики событий
    dom.analyzeBtn.addEventListener('click', () => eventHandlers.handleAnalyze());
    dom.updateNormBtn.addEventListener('click', () => eventHandlers.handleUpdateNormalization());
    dom.exportBtn.addEventListener('click', () => excelExporter.exportToExcel());
    dom.exportNormBtn.addEventListener('click', () => excelExporter.exportNormalizedToExcel());
    dom.copyBtn.addEventListener('click', () => eventHandlers.handleCopyToClipboard());
    dom.resetBtn.addEventListener('click', () => eventHandlers.handleReset());
    
    // Обработчики вкладок
    dom.meanTabBtn.addEventListener('click', () => ui.switchTab('mean'));
    dom.normTabBtn.addEventListener('click', () => ui.switchTab('norm'));
    
    // Обработчик изменения файла
    dom.excelFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            dom.fileInfo.innerHTML = `
                <div style="padding: 0.5rem; background: rgba(52, 152, 219, 0.1); border-radius: 4px;">
                    📄 <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)
                </div>
            `;
        }
    });
    
    // Инициализация модуля графиков
    chartsModule.init();
    
    console.log('Приложение инициализировано');
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', init);