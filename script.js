// 金币记录器应用
class CoinTracker {
    constructor() {
        this.coinData = this.loadData();
        this.totalChart = null;
        this.dailyChart = null;
        this.currentTheme = this.loadTheme();
        this.achievements = this.loadAchievements();
        this.streakData = this.loadStreakData();
        this.challengeData = this.loadChallengeData();
        this.simpleIntegration = null;
        // 不在这里初始化，等待外部调用
    }

    // 获取北京时间日期字符串（YYYY-MM-DD格式）
    getBeijingDate() {
        // 使用Intl API获取准确的北京时间（推荐方法）
        const now = new Date();
        try {
            // 方法1：使用Intl.DateTimeFormat（最准确）
            const beijingDate = new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(now).replace(/\//g, '-');

            return beijingDate;
        } catch (error) {
            // 备用方法：手动计算（如果Intl不可用）
            console.warn('Intl API不可用，使用备用方法:', error);
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const beijingTime = new Date(utc + (8 * 60 * 60 * 1000));
            return beijingTime.toISOString().split('T')[0];
        }
    }

    // 获取昨天的北京时间日期字符串
    getBeijingYesterdayDate() {
        try {
            // 方法1：使用Intl API计算昨天的北京时间
            const now = new Date();
            const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 减去一天

            const yesterdayBeijingDate = new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(yesterday).replace(/\//g, '-');

            return yesterdayBeijingDate;
        } catch (error) {
            // 备用方法：手动计算昨天的北京时间
            console.warn('计算昨天日期时Intl API不可用，使用备用方法:', error);
            const today = this.getBeijingDate();
            const date = new Date(today + 'T00:00:00+08:00');
            date.setDate(date.getDate() - 1);
            return date.toISOString().split('T')[0];
        }
    }

    // 初始化应用
    async init() {
        
        // 先确保内容可见并可交互
        this.hideAllSkeletons();

        this.applyTheme(this.currentTheme);
        this.bindEvents();
        this.updateDisplay();
        this.renderHistory();
        this.updateAchievements();
        this.updateStreakDisplay();
        this.updateChallengeDisplay();
        this.initCharts();
        this.checkAchievements(); // 检查是否有新成就可以解锁
        this.startTimeUpdate(); // 开始更新时间显示
        
        // 绑定批量录入模态框事件
        this.bindBatchModalEvents();
        
        // 初始化简单集成
        await this.initSimpleIntegration();
    }

    // 初始化简单集成
    async initSimpleIntegration() {
        try {
            // 动态导入简单集成模块
            const { simpleIntegration } = await import('./simple-integration.js');
            this.simpleIntegration = simpleIntegration;
            
            // 等待简单集成初始化完成
            await this.simpleIntegration.init();
            
            // 监听认证状态变化
            if (this.simpleIntegration) {
                this.simpleIntegration.onAuthStateChange?.((user) => {
                    if (user) {
                        this.enableCloudSync();
                    } else {
                        this.disableCloudSync();
                    }
                });
            }
        } catch (error) {
            console.error('简单集成初始化失败:', error);
            // 继续使用本地模式
        }
    }

    // 绑定事件监听器
    bindEvents() {
        // 表单提交
        const coinForm = document.getElementById('coinForm');
        coinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCoinRecord();
        });

        // 标签页切换
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // 导出数据
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => {
            this.exportData();
        });

        // 清空记录
        const clearBtn = document.getElementById('clearBtn');
        clearBtn.addEventListener('click', () => {
            this.clearAllData();
        });

        // 重置缩放
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        resetZoomBtn.addEventListener('click', () => {
            this.resetAllZooms();
        });

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });

        // 补签按钮
        const makeupRecordBtn = document.getElementById('makeupRecordBtn');
        makeupRecordBtn.addEventListener('click', () => {
            this.makeupYesterdayRecord();
        });

        // 挑战刷新按钮
        const refreshChallengeBtn = document.getElementById('refreshChallengeBtn');
        refreshChallengeBtn.addEventListener('click', () => {
            this.refreshChallengeDisplay();
        });

        // 挑战设定按钮
        const setChallengeBtn = document.getElementById('setChallengeBtn');
        setChallengeBtn.addEventListener('click', () => {
            this.showChallengeModal();
        });

        // 批量录入按钮
        const batchInputBtn = document.getElementById('batchInputBtn');
        batchInputBtn.addEventListener('click', () => {
            this.showBatchInputModal();
        });

        // 数据校验按钮
        const validateDataBtn = document.getElementById('validateDataBtn');
        validateDataBtn.addEventListener('click', () => {
            this.validateData();
        });

        // 批量录入模态框事件
        this.setupBatchInputModalEvents();
    }

    // 添加金币记录
    addCoinRecord() {
        const coinAmount = document.getElementById('coinAmount').value;
        const note = document.getElementById('note').value;

        if (!coinAmount || coinAmount < 0) {
            this.showMessage('请输入有效的金币数量', 'error');
            return;
        }

        const today = this.getBeijingDate();
        const lastRecord = this.coinData.length > 0 ? this.coinData[this.coinData.length - 1] : null;

        // 检查是否已经是今天的数据
        if (lastRecord && lastRecord.date === today) {
            if (confirm('今天已经记录过金币，是否更新记录？')) {
                this.updateTodayRecord(parseInt(coinAmount), note);
            }
        } else {
            this.createNewRecord(parseInt(coinAmount), note, today);
        }

        this.updateDisplay();
        this.renderHistory();
        this.updateCharts();
        this.updateStreakDisplay();
        this.updateChallengeDisplay();
        this.checkAchievements();
        this.showMessage('金币记录成功！', 'success');
        
        // 提醒用户及时上传到云端
        this.remindUploadToCloud();
    }

    // 创建新记录
    createNewRecord(coins, note, date) {
        // 如果是第一条记录，差值为0；否则计算与前一天的差值
        const previousCoins = this.coinData.length > 0 ? this.coinData[this.coinData.length - 1].coins : 0;
        const difference = this.coinData.length > 0 ? coins - previousCoins : 0;

        const record = {
            date,
            coins,
            difference,
            note: note || '',
            timestamp: Date.now() // UTC时间戳，用于排序和合并
        };

        this.coinData.push(record);

        // 更新连击数据 - 修复：每天有记录就更新连击
        this.updateStreakForDate(date);

        this.saveData();
        this.saveStreakData();

        // 更新挑战显示
        this.updateChallengeDisplay();

        // 同步到云端
        this.syncToCloud('addRecord', record);
    }

    // 获取昨天的日期字符串（北京时间）
    getYesterdayDate() {
        return this.getBeijingYesterdayDate();
    }

    // 更新指定日期的连击数据
    updateStreakForDate(date) {
        const today = this.getBeijingDate();

        // 如果是今天的记录
        if (date === today) {
            this.streakData.todayCompleted = true;
        }

        // 计算连击逻辑
        if (this.streakData.lastRecordDate === null) {
            // 第一次记录
            this.streakData.currentStreak = 1;
        } else {
            // 检查是否是连续的一天
            const lastRecordDate = new Date(this.streakData.lastRecordDate + 'T00:00:00+08:00');
            const currentRecordDate = new Date(date + 'T00:00:00+08:00');
            const dayDiff = Math.floor((currentRecordDate - lastRecordDate) / (1000 * 60 * 60 * 24));

            if (dayDiff === 1) {
                // 连续的一天，连击+1
                this.streakData.currentStreak += 1;
            } else if (dayDiff > 1) {
                // 不连续，重置连击
                this.streakData.currentStreak = 1;
            }
            // dayDiff === 0 表示同一天，不改变连击
        }

        this.streakData.lastRecordDate = date;

        // 更新最长连击
        if (this.streakData.currentStreak > this.streakData.longestStreak) {
            this.streakData.longestStreak = this.streakData.currentStreak;
        }
    }

    // 更新今天的记录
    updateTodayRecord(coins, note) {
        const lastRecord = this.coinData[this.coinData.length - 1];
        const today = this.getBeijingDate();

        // 如果是第一条记录，差值为0；否则计算与前一天的差值
        const previousCoins = this.coinData.length > 1 ? this.coinData[this.coinData.length - 2].coins : 0;
        lastRecord.coins = coins;
        lastRecord.difference = this.coinData.length > 1 ? coins - previousCoins : 0;
        lastRecord.note = note;
        lastRecord.timestamp = Date.now();

        // 更新连击数据（如果是今天的记录）
        if (lastRecord.date === today) {
            this.updateStreakForDate(today);
        }

        this.saveData();
        this.saveStreakData();

        // 更新挑战显示
        this.updateChallengeDisplay();

        // 同步到云端
        this.syncToCloud('updateRecord', lastRecord);
    }

    // 更新显示
    updateDisplay() {
        if (this.coinData.length === 0) {
            this.showEmptyStats();
            return;
        }

        // 按时间排序，找到最新的记录
        const sortedRecords = [...this.coinData].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            return timeB.getTime() - timeA.getTime();
        });
        const lastRecord = sortedRecords[0];

        // 更新今日统计（带动画效果）
        this.animateNumber('todayCoins', lastRecord.coins);
        this.animateNumber('difference', lastRecord.difference);
        this.animateNumber('totalCoins', this.calculateTotal());
        this.animateNumber('recordDays', this.coinData.length);

        // 设置差值的颜色
        const differenceElement = document.getElementById('difference');
        differenceElement.className = 'stat-value';
        if (lastRecord.difference > 0) {
            differenceElement.classList.add('positive');
        } else if (lastRecord.difference < 0) {
            differenceElement.classList.add('negative');
        }
    }

    // 显示空状态统计
    showEmptyStats() {
        document.getElementById('todayCoins').textContent = '-';
        document.getElementById('difference').textContent = '-';
        document.getElementById('totalCoins').textContent = '0';
        document.getElementById('recordDays').textContent = '0';
    }

    // 渲染历史记录
    renderHistory() {
        const historyList = document.getElementById('historyList');

        if (this.coinData.length === 0) {
            historyList.innerHTML = '<div class="empty-state">暂无历史记录，快来记录第一笔金币吧！</div>';
            return;
        }

        // 找到最早的记录（按时间戳排序）
        const sortedRecords = [...this.coinData].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            return timeA.getTime() - timeB.getTime();
        });
        const earliestRecord = sortedRecords[0];

        historyList.innerHTML = this.coinData.map((record, index) => {
            // 判断是否为首次记录（基于时间戳，而不是索引）
            const isFirstRecord = record === earliestRecord;
            
            return `
            <div class="history-item" data-index="${index}">
                <div class="history-content">
                    <div class="history-date">${this.formatDate(record.date)}</div>
                    <div class="history-coins">金币: ${record.coins}</div>
                    <div class="history-note">${record.note || '无备注'}</div>
                </div>
                <div class="history-actions">
                    <div class="history-difference ${record.difference > 0 ? 'positive' : record.difference < 0 ? 'negative' : 'neutral'}">
                        ${isFirstRecord ? '首次记录' : this.formatDifference(record.difference)}
                    </div>
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="coinTracker.editRecord(${index})" title="编辑">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="delete-btn" onclick="coinTracker.deleteRecord(${index})" title="删除">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    // 初始化图表
    initCharts() {
        // 总金币趋势图
        this.initTotalChart();

        // 每日变化图
        this.initDailyChart();

        // 周统计图
        this.initWeeklyChart();

        // 月统计图
        this.initMonthlyChart();

        this.updateCharts();
    }

    initTotalChart() {
        const ctx = document.getElementById('totalChart').getContext('2d');
        this.totalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '总金币数',
                    data: [],
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '金币总数趋势图'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '日期'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '总金币数'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initDailyChart() {
        const ctx = document.getElementById('dailyChart').getContext('2d');
        this.dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '每日变化',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '每日金币变化图'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '日期'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '每日变化'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }


    initWeeklyChart() {
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        this.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '周总金币',
                    data: [],
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '周统计图表'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initMonthlyChart() {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        this.monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '月总金币',
                    data: [],
                    backgroundColor: '#9b59b6',
                    borderColor: '#8e44ad',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '月统计图表'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }


    // 更新图表数据
    updateCharts() {
        if (this.coinData.length === 0) {
            this.clearAllCharts();
            return;
        }

        // 更新总金币趋势图
        this.updateTotalChart();

        // 更新每日变化图
        this.updateDailyChart();

        // 更新周统计图
        this.updateWeeklyChart();

        // 更新月统计图
        this.updateMonthlyChart();
    }

    clearAllCharts() {
        const charts = [
            this.totalChart, this.dailyChart,
            this.weeklyChart, this.monthlyChart
        ];

        charts.forEach(chart => {
            if (chart) {
                chart.data.labels = [];
                chart.data.datasets.forEach(dataset => {
                    dataset.data = [];
                });
                chart.update();
            }
        });
    }

    updateTotalChart() {
        // 按日期排序数据
        const sortedData = [...this.coinData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = sortedData.map(record => this.formatDate(record.date));
        const totalData = sortedData.map(record => record.coins);

        this.totalChart.data.labels = labels;
        this.totalChart.data.datasets[0].data = totalData;
        this.totalChart.update();
    }

    updateDailyChart() {
        // 按日期排序数据
        const sortedData = [...this.coinData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const dailyLabels = sortedData.map(record => this.formatDate(record.date));
        const dailyData = sortedData.map(record => record.difference);

        this.dailyChart.data.labels = dailyLabels;
        this.dailyChart.data.datasets[0].data = dailyData;
        this.dailyChart.update();
    }


    updateWeeklyChart() {
        const weeklyData = this.calculateWeeklyStats();
        const labels = weeklyData.map(week => `第${week.week}周`);

        this.weeklyChart.data.labels = labels;
        this.weeklyChart.data.datasets[0].data = weeklyData.map(week => week.total);
        this.weeklyChart.update();
    }

    updateMonthlyChart() {
        const monthlyData = this.calculateMonthlyStats();
        const labels = monthlyData.map(month => `${month.year}-${month.month.toString().padStart(2, '0')}`);

        this.monthlyChart.data.labels = labels;
        this.monthlyChart.data.datasets[0].data = monthlyData.map(month => month.total);
        this.monthlyChart.update();
    }


    // 计算周统计（自然周，显示周末的数额）
    calculateWeeklyStats() {
        const weeks = {};
        this.coinData.forEach(record => {
            const date = new Date(record.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            // 使用Intl API确保周起始日期是北京时间
            let weekKey;
            try {
                weekKey = new Intl.DateTimeFormat('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(weekStart).replace(/\//g, '-');
            } catch (error) {
                // 备用方法
                const beijingWeekStart = new Date(weekStart.getTime() + (8 * 60 * 60 * 1000));
                weekKey = beijingWeekStart.toISOString().split('T')[0];
            }

            if (!weeks[weekKey]) {
                weeks[weekKey] = { 
                    total: 0, 
                    count: 0, 
                    weekStart: weekKey,
                    records: []
                };
            }
            weeks[weekKey].total += record.coins;
            weeks[weekKey].count++;
            weeks[weekKey].records.push(record);
        });

        // 计算每周末的数额（该周最后一天的金币数）
        return Object.entries(weeks)
            .map(([weekStart, data], index) => {
                // 按日期排序，获取该周最后一天的金币数
                const sortedRecords = data.records.sort((a, b) => new Date(a.date) - new Date(b.date));
                const lastRecord = sortedRecords[sortedRecords.length - 1];
                
                return {
                    week: index + 1,
                    total: lastRecord ? lastRecord.coins : 0,
                    weekStart: weekStart
                };
            })
            .slice(-8); // 只显示最近8周
    }

    // 计算月统计（自然月，显示月末的数额）
    calculateMonthlyStats() {
        const months = {};
        this.coinData.forEach(record => {
            // 确保正确处理时区，北京时间日期字符串 + 北京时区标识
            const date = new Date(record.date + 'T00:00:00+08:00');
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

            if (!months[monthKey]) {
                months[monthKey] = { 
                    total: 0, 
                    count: 0, 
                    year: date.getFullYear(), 
                    month: date.getMonth() + 1,
                    records: []
                };
            }
            months[monthKey].total += record.coins;
            months[monthKey].count++;
            months[monthKey].records.push(record);
        });

        // 计算每月末的数额（该月最后一天的金币数）
        return Object.values(months)
            .map(month => {
                // 按日期排序，获取该月最后一天的金币数
                const sortedRecords = month.records.sort((a, b) => new Date(a.date) - new Date(b.date));
                const lastRecord = sortedRecords[sortedRecords.length - 1];
                
                return {
                    ...month,
                    total: lastRecord ? lastRecord.coins : 0
                };
            })
            .slice(-6); // 只显示最近6个月
    }

    // 切换图表标签页
    switchTab(tabName) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const charts = document.querySelectorAll('.chart-container canvas');

        tabBtns.forEach(btn => btn.classList.remove('active'));
        charts.forEach(chart => chart.style.display = 'none');

        event.target.classList.add('active');

        document.getElementById(tabName).style.display = 'block';
    }

    // 导出数据
    exportData() {
        if (this.coinData.length === 0) {
            this.showMessage('暂无数据可导出', 'warning');
            return;
        }

        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `金币记录_${this.getBeijingDate()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showMessage('数据导出成功！', 'success');
        }
    }

    // 生成CSV内容
    generateCSV() {
        const headers = ['日期', '金币数', '差值', '备注'];
        const rows = this.coinData.map(record => [
            record.date,
            record.coins,
            record.difference,
            record.note
        ]);

        const csvArray = [headers, ...rows];
        return csvArray.map(row =>
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    // 清空所有数据
    clearAllData() {
        if (confirm('确定要清空所有记录吗？此操作不可撤销！')) {
            this.coinData = [];
            this.saveData();
            this.updateDisplay();
            this.renderHistory();
            this.updateCharts();
            this.showMessage('所有数据已清空', 'info');
        }
    }

    // 工具方法
    calculateTotal() {
        if (this.coinData.length === 0) {
            return 0;
        }
        
        // 按时间排序，找到最新的记录
        const sortedRecords = [...this.coinData].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            return timeB.getTime() - timeA.getTime();
        });
        
        return sortedRecords[0].coins || 0;
    }

    // 计算当前金币数（最新记录的金币数）
    calculateCurrentCoins() {
        if (!this.coinData || this.coinData.length === 0) {
            return 0;
        }
        
        // 按时间戳排序，获取最新的记录（不修改原数组）
        const sortedRecords = [...this.coinData].sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeB.getTime() - timeA.getTime(); // 降序排列，最新的在前
        });

        // 返回最新记录的金币数
        return sortedRecords[0].coins || 0;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatDifference(diff) {
        if (diff === 0) return '0';
        return diff > 0 ? `+${diff}` : diff.toString();
    }

    showMessage(message, type) {
        // 获取或创建消息容器
        let container = document.querySelector('.message-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'message-container';
            document.body.appendChild(container);
        }

        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;

        // 添加到容器
        container.appendChild(messageEl);

        // 显示动画
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 10);

        // 自动隐藏
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
                // 如果容器为空，删除容器
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, 3000);
    }

    loadData() {
        try {
            const data = localStorage.getItem('coinTrackerData');
            const parsedData = data ? JSON.parse(data) : [];
            // 确保数据按日期排序
            return parsedData.sort((a, b) => new Date(a.date) - new Date(b.date));
        } catch (error) {
            console.error('加载数据失败:', error);
            return [];
        }
    }

    saveData() {
        try {
            localStorage.setItem('coinTrackerData', JSON.stringify(this.coinData));
        } catch (error) {
            console.error('保存数据失败:', error);
            this.showMessage('数据保存失败', 'error');
        }
    }

    // 编辑记录
    editRecord(index) {
        const record = this.coinData[index];
        const newCoins = prompt('请输入新的金币数量：', record.coins);
        const newNote = prompt('请输入新的备注：', record.note || '');

        if (newCoins === null || newNote === null) return;

        const coins = parseInt(newCoins);
        if (isNaN(coins) || coins < 0) {
            this.showMessage('请输入有效的金币数量', 'error');
            return;
        }

        // 计算新的差值
        // 如果是第一条记录，差值为0；否则计算与前一天的差值
        const previousCoins = index > 0 ? this.coinData[index - 1].coins : 0;
        record.coins = coins;
        record.difference = index > 0 ? coins - previousCoins : 0;
        record.note = newNote.trim();
        record.timestamp = Date.now();

        // 更新后续记录的差值
        this.updateSubsequentDifferences(index);

        this.saveData();
        this.updateDisplay();
        this.renderHistory();
        this.updateCharts();
        this.updateChallengeDisplay();
        
        // 重新检查成就系统（编辑记录后需要重新验证成就状态）
        this.checkAchievements();
        this.updateAchievements();
        
        this.showMessage('记录更新成功！', 'success');
    }

    // 删除记录
    deleteRecord(index) {
        if (!confirm('确定要删除这条记录吗？')) return;

        const record = this.coinData[index];
        
        // 删除指定记录
        this.coinData.splice(index, 1);

        // 重新计算后续记录的差值
        if (index < this.coinData.length) {
            this.updateSubsequentDifferences(index - 1);
        }

        this.saveData();
        this.updateDisplay();
        this.renderHistory();
        this.updateCharts();
        this.updateChallengeDisplay();
        
        // 重新检查成就系统（重要：删除记录后需要重新验证成就状态）
        this.checkAchievements();
        this.updateAchievements();
        
        this.showMessage('记录删除成功！', 'success');

        // 同步到云端
        this.syncToCloud('deleteRecord', record);
    }

    // 更新后续记录的差值
    updateSubsequentDifferences(startIndex) {
        for (let i = startIndex; i < this.coinData.length; i++) {
            const current = this.coinData[i];
            const previous = i > 0 ? this.coinData[i - 1].coins : 0;
            current.difference = current.coins - previous;
        }
    }

    // 数字动画效果
    animateNumber(elementId, targetValue, duration = 1000) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = parseInt(element.textContent) || 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数让动画更自然
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);

            // 特殊处理差值显示
            if (elementId === 'difference') {
                element.textContent = this.formatDifference(currentValue);
            } else {
                element.textContent = currentValue;
            }

            // 添加更新动画类
            if (progress === 1) {
                element.classList.add('updated');
                setTimeout(() => {
                    element.classList.remove('updated');
                }, 600);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    // 重置所有图表的缩放和平移
    resetAllZooms() {
        const charts = [
            this.totalChart, this.dailyChart,
            this.weeklyChart, this.monthlyChart
        ];

        charts.forEach(chart => {
            if (chart) {
                // 检查图表是否有重置缩放的方法
                if (typeof chart.resetZoom === 'function') {
                    chart.resetZoom();
                } else if (chart.resetZoomPan) {
                    // 某些版本的 Chart.js zoom 插件使用不同的方法名
                    chart.resetZoomPan();
                } else {
                    // 如果没有重置方法，重新渲染图表
                    chart.update('none');
                }
            }
        });

        this.showMessage('图表视图已重置', 'info');
    }

    // 主题相关方法
    loadTheme() {
        const savedTheme = localStorage.getItem('coinTrackerTheme');
        return savedTheme || 'light';
    }

    saveTheme(theme) {
        localStorage.setItem('coinTrackerTheme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.showMessage(`已切换到${newTheme === 'light' ? '亮色' : '暗黑'}主题`, 'info');
    }

    // 骨架屏相关方法
    showAllSkeletons() {
        const skeletonIds = ['inputSkeleton', 'statsSkeleton', 'streakSkeleton', 'challengeSkeleton', 'achievementsSkeleton', 'chartSkeleton', 'historySkeleton'];
        skeletonIds.forEach(id => {
            const skeleton = document.getElementById(id);
            if (skeleton) {
                skeleton.style.display = 'block';
            }
        });

        // 隐藏内容区域
        const contentIds = ['inputContent', 'statsContent', 'streakContent', 'challengeContent', 'achievementsContent', 'chartContent', 'historyContent'];
        contentIds.forEach(id => {
            const content = document.getElementById(id);
            if (content) {
                content.classList.add('loading');
            }
        });
    }

    hideAllSkeletons() {
        const skeletonIds = ['inputSkeleton', 'statsSkeleton', 'streakSkeleton', 'challengeSkeleton', 'achievementsSkeleton', 'chartSkeleton', 'historySkeleton'];
        skeletonIds.forEach(id => {
            const skeleton = document.getElementById(id);
            if (skeleton) {
                skeleton.style.display = 'none';
            }
        });

        // 显示内容区域
        const contentIds = ['inputContent', 'statsContent', 'streakContent', 'challengeContent', 'achievementsContent', 'chartContent', 'historyContent'];
        contentIds.forEach(id => {
            const content = document.getElementById(id);
            if (content) {
                content.classList.remove('loading');
            }
        });
    }

    // 连击数据相关方法
    loadStreakData() {
        try {
            const streakData = localStorage.getItem('coinTrackerStreak');
            return streakData ? JSON.parse(streakData) : this.getDefaultStreakData();
        } catch (error) {
            console.error('加载连击数据失败:', error);
            return this.getDefaultStreakData();
        }
    }

    saveStreakData() {
        try {
            localStorage.setItem('coinTrackerStreak', JSON.stringify(this.streakData));
        } catch (error) {
            console.error('保存连击数据失败:', error);
        }
    }

    getDefaultStreakData() {
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastRecordDate: null,
            todayCompleted: false
        };
    }

    updateStreakDisplay() {
        const today = this.getBeijingDate();

        // 检查是否跨天
        if (this.streakData.lastRecordDate !== null && this.streakData.lastRecordDate !== today) {
            const yesterdayStr = this.getBeijingYesterdayDate();

            // 检查昨天是否有记录
            const hasYesterdayRecord = this.coinData.some(record => record.date === yesterdayStr);

            if (!hasYesterdayRecord) {
                // 昨天没记录，说明连击中断，重置连击为0
                this.streakData.currentStreak = 0;
            }
            // 如果昨天有记录，连击保持不变，等今天记录时再更新

            // 重置今天的完成状态，为新的一天做准备
            this.streakData.todayCompleted = false;
        }

        // 更新显示
        document.getElementById('currentStreak').textContent = `${this.streakData.currentStreak}天`;
        document.getElementById('longestStreak').textContent = `${this.streakData.longestStreak}天`;
        document.getElementById('todayComplete').textContent = this.streakData.todayCompleted ? '已完成' : '未完成';

        // 设置今日完成状态的颜色
        const todayCompleteElement = document.getElementById('todayComplete');
        todayCompleteElement.className = 'streak-value';
        if (this.streakData.todayCompleted) {
            todayCompleteElement.classList.add('completed');
        }

        // 显示/隐藏补签按钮
        const makeupBtn = document.getElementById('makeupRecordBtn');
        const yesterdayStr = this.getBeijingYesterdayDate();

        // 如果昨天没记录且今天还没记录且有历史记录，显示补签按钮
        if (!this.streakData.todayCompleted && this.coinData.length > 0) {
            const lastRecord = this.coinData[this.coinData.length - 1];
            if (lastRecord.date !== today && lastRecord.date !== yesterdayStr) {
                makeupBtn.style.display = 'block';
            } else {
                makeupBtn.style.display = 'none';
            }
        } else {
            makeupBtn.style.display = 'none';
        }

        this.saveStreakData();
    }

    makeupYesterdayRecord() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.getBeijingYesterdayDate();

        // 检查昨天是否已经有记录
        const hasYesterdayRecord = this.coinData.some(record => record.date === yesterdayStr);

        if (hasYesterdayRecord) {
            this.showMessage('昨天已经有记录了！', 'warning');
            return;
        }

        // 提示用户输入昨天的金币数量
        const coins = prompt('请输入昨天的金币数量：');
        if (coins === null) return;

        const coinAmount = parseInt(coins);
        if (isNaN(coinAmount) || coinAmount < 0) {
            this.showMessage('请输入有效的金币数量', 'error');
            return;
        }

        // 创建昨天的记录
        this.createNewRecord(coinAmount, '补签记录', yesterdayStr);

        // 更新连击数据
        this.streakData.currentStreak += 1;
        if (this.streakData.currentStreak > this.streakData.longestStreak) {
            this.streakData.longestStreak = this.streakData.currentStreak;
        }
        this.streakData.lastRecordDate = yesterdayStr;

        // 更新显示
        this.updateDisplay();
        this.renderHistory();
        this.updateCharts();
        this.updateStreakDisplay();
        this.updateChallengeDisplay();
        this.checkAchievements();

        this.showMessage('补签成功！连击已恢复', 'success');
    }

    // 挑战数据相关方法
    loadChallengeData() {
        try {
            const challengeData = localStorage.getItem('coinTrackerChallenge');
            return challengeData ? JSON.parse(challengeData) : this.getDefaultChallengeData();
        } catch (error) {
            console.error('加载挑战数据失败:', error);
            return this.getDefaultChallengeData();
        }
    }

    saveChallengeData() {
        try {
            localStorage.setItem('coinTrackerChallenge', JSON.stringify(this.challengeData));
        } catch (error) {
            console.error('保存挑战数据失败:', error);
        }
    }

    getDefaultChallengeData() {
        return {
            target: 0,
            startDate: null,
            endDate: null,
            currentProgress: 0,
            completed: false,
            completedDate: null
        };
    }

    updateChallengeDisplay() {
        const challengeInfo = document.getElementById('currentChallengeInfo');
        const noChallengeInfo = document.getElementById('noChallengeInfo');

        if (this.challengeData.target > 0) {
            // 有挑战 - 自动更新当前进度
            this.challengeData.currentProgress = this.calculateTotal();
            
            challengeInfo.style.display = 'block';
            noChallengeInfo.style.display = 'none';

            document.getElementById('challengeTarget').textContent = this.challengeData.target;
            document.getElementById('challengeProgress').textContent = this.challengeData.currentProgress;

            const percentage = Math.min((this.challengeData.currentProgress / this.challengeData.target) * 100, 100);
            document.getElementById('challengePercentage').textContent = `${percentage.toFixed(2)}%`;

            const progressFill = document.getElementById('challengeProgressFill');
            progressFill.style.width = `${percentage}%`;

            // 根据进度改变颜色
            if (percentage >= 100) {
                progressFill.style.background = 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)';
            } else if (percentage >= 75) {
                progressFill.style.background = 'linear-gradient(90deg, #f39c12 0%, #e67e22 100%)';
            } else {
                progressFill.style.background = 'linear-gradient(90deg, var(--accent-color) 0%, #27ae60 100%)';
            }
        } else {
            // 没有挑战
            challengeInfo.style.display = 'none';
            noChallengeInfo.style.display = 'block';
        }

        this.saveChallengeData();
    }

    // 刷新挑战显示（手动刷新用）
    refreshChallengeDisplay() {
        if (this.challengeData.target > 0) {
            // 重新计算当前进度
            this.challengeData.currentProgress = this.calculateTotal();

            // 更新显示
            this.updateChallengeDisplay();

            // 显示刷新成功消息
            this.showMessage('挑战进度已刷新！', 'success');
        } else {
            this.showMessage('当前没有设定挑战', 'warning');
        }
    }

    showChallengeModal() {
        const modal = document.getElementById('challengeModal');
        if (!modal) {
            console.error('未找到挑战模态框');
            return;
        }

        // 设置当前值
        const targetInput = document.getElementById('challengeTargetInput');
        if (targetInput) {
            targetInput.value = this.challengeData.target || '';
        }

        // 显示模态框
        modal.style.display = 'flex';

        // 添加事件监听器
        const closeBtn = modal.querySelector('.challenge-modal-close');
        const cancelBtn = document.getElementById('cancelChallengeBtn');
        const confirmBtn = document.getElementById('confirmChallengeBtn');
        const backdrop = modal.querySelector('.modal-backdrop');

        const closeModal = () => this.closeChallengeModal();

        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;
        if (backdrop) {
            backdrop.onclick = (e) => {
                if (e.target === backdrop) {
                    closeModal();
                }
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const targetInput = document.getElementById('challengeTargetInput');
                const target = parseInt(targetInput.value);

                if (isNaN(target) || target < 100) {
                    this.showMessage('请输入有效目标金币数量（至少100）', 'error');
                    return;
                }

                this.setChallenge(target);
                this.closeChallengeModal();
            };
        }
    }

    setChallenge(target) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 1); // 默认1个月挑战

        this.challengeData = {
            target: target,
            startDate: today.toISOString(),
            endDate: endDate.toISOString(),
            currentProgress: this.calculateTotal(),
            completed: false,
            completedDate: null
        };

        this.updateChallengeDisplay();
        this.showMessage(`🎯 挑战设定成功！目标：${target}金币`, 'success');
    }

    closeChallengeModal() {
        const modal = document.getElementById('challengeModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 设置批量录入模态框事件
    setupBatchInputModalEvents() {
        // 预览按钮事件
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const coinsInput = document.getElementById('batchCoins');

        if (startDateInput && endDateInput && coinsInput) {
            const previewBtn = document.createElement('button');
            previewBtn.id = 'previewBatchBtn';
            previewBtn.className = 'batch-preview-btn';
            previewBtn.textContent = '预览数据';
            previewBtn.style.cssText = `
                background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                font-family: 'Inter', sans-serif;
                font-weight: 500;
                margin-top: 10px;
                transition: all 0.3s ease;
            `;

            // 插入到备注输入框后面
            const noteInput = document.getElementById('batchNote');
            noteInput.parentNode.insertBefore(previewBtn, noteInput.nextSibling);

            previewBtn.addEventListener('click', () => {
                this.previewBatchData();
            });

            // 添加输入变化监听
            [startDateInput, endDateInput, coinsInput].forEach(input => {
                input.addEventListener('input', () => {
                    const previewSection = document.getElementById('batchPreview');
                    if (previewSection) {
                        previewSection.style.display = 'none';
                    }
                });
            });
        }

        // 确认和取消按钮事件
        const cancelBtn = document.getElementById('cancelBatchBtn');
        const confirmBtn = document.getElementById('confirmBatchBtn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeBatchInputModal();
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.executeBatchInput();
            });
        }
    }

    // 批量录入相关方法
    showBatchInputModal() {
        const modal = document.getElementById('batchInputModal');
        if (modal) {
            // 设置默认日期（北京时间）
            // 这里不需要重新计算，因为getBeijingDate()和getBeijingYesterdayDate()已经处理了时区

            document.getElementById('startDate').value = this.getBeijingYesterdayDate();
            document.getElementById('endDate').value = this.getBeijingDate();

            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        }
    }

    // 绑定批量录入模态框事件
    bindBatchModalEvents() {
        const modal = document.getElementById('batchInputModal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.batch-input-close');
        const backdrop = modal.querySelector('.batch-input-backdrop');

        if (closeBtn) {
            // 移除之前的事件监听器
            closeBtn.onclick = null;
            // 重新绑定事件
            closeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('批量录入关闭按钮被点击');
                this.closeBatchInputModal();
            };
        }

        if (backdrop) {
            // 移除之前的事件监听器
            backdrop.onclick = null;
            // 重新绑定事件
            backdrop.onclick = (e) => {
                if (e.target === backdrop) {
                    console.log('批量录入背景被点击');
                    this.closeBatchInputModal();
                }
            };
        }
    }

    closeBatchInputModal() {
        const modal = document.getElementById('batchInputModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    previewBatchData() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const coins = document.getElementById('batchCoins').value;
        const note = document.getElementById('batchNote').value;

        if (!startDate || !endDate || !coins) return;

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            this.showMessage('开始日期不能晚于结束日期', 'error');
            return;
        }

        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const previewList = document.getElementById('batchPreviewList');
        const previewSection = document.getElementById('batchPreview');

        previewList.innerHTML = '';

        for (let i = 0; i < days; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(currentDate.getDate() + i);
            // 使用Intl API确保正确计算北京时间日期
            let dateStr;
            try {
                dateStr = new Intl.DateTimeFormat('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(currentDate).replace(/\//g, '-');
            } catch (error) {
                // 备用方法
                const beijingDate = new Date(currentDate.getTime() + (8 * 60 * 60 * 1000));
                dateStr = beijingDate.toISOString().split('T')[0];
            }

            // 检查是否已有记录
            const existingRecord = this.coinData.find(record => record.date === dateStr);
            const status = existingRecord ? '⚠️ 已有记录' : '✅ 新记录';

            const item = document.createElement('div');
            item.className = 'batch-preview-item';
            item.textContent = `${dateStr}: ${coins}金币 ${note ? `(${note})` : ''} - ${status}`;
            previewList.appendChild(item);
        }

        previewSection.style.display = 'block';
    }

    executeBatchInput() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const coins = document.getElementById('batchCoins').value;
        const note = document.getElementById('batchNote').value;

        if (!startDate || !endDate || !coins) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            this.showMessage('开始日期不能晚于结束日期', 'error');
            return;
        }

        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        let successCount = 0;
        let skipCount = 0;

        for (let i = 0; i < days; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(currentDate.getDate() + i);
            // 使用Intl API确保正确计算北京时间日期
            let dateStr;
            try {
                dateStr = new Intl.DateTimeFormat('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(currentDate).replace(/\//g, '-');
            } catch (error) {
                // 备用方法
                const beijingDate = new Date(currentDate.getTime() + (8 * 60 * 60 * 1000));
                dateStr = beijingDate.toISOString().split('T')[0];
            }

            // 检查是否已有记录
            const existingRecord = this.coinData.find(record => record.date === dateStr);
            if (existingRecord) {
                skipCount++;
                continue;
            }

            // 创建新记录
            this.createNewRecord(parseInt(coins), note, dateStr);
            successCount++;
        }

        this.closeBatchInputModal();

        if (successCount > 0) {
            this.updateDisplay();
            this.renderHistory();
            this.updateCharts();
            this.updateStreakDisplay();
            this.updateChallengeDisplay();
            this.checkAchievements();
        }

        this.showMessage(`批量录入完成！新增${successCount}条记录${skipCount > 0 ? `，跳过${skipCount}条已有记录` : ''}`, 'success');
    }

    // 成就系统方法
    loadAchievements() {
        try {
            const achievements = localStorage.getItem('coinTrackerAchievements');
            return achievements ? JSON.parse(achievements) : this.getDefaultAchievements();
        } catch (error) {
            console.error('加载成就数据失败:', error);
            return this.getDefaultAchievements();
        }
    }

    saveAchievements() {
        try {
            localStorage.setItem('coinTrackerAchievements', JSON.stringify(this.achievements));
        } catch (error) {
            console.error('保存成就数据失败:', error);
        }
    }

    getDefaultAchievements() {
        return {
            first_record: { unlocked: false, unlockedDate: null },
            week_streak: { unlocked: false, unlockedDate: null },
            month_streak: { unlocked: false, unlockedDate: null },
            hundred_days: { unlocked: false, unlockedDate: null },
            // 等级成就系统
            novice_level: { unlocked: false, unlockedDate: null },
            silver_level: { unlocked: false, unlockedDate: null },
            gold_level: { unlocked: false, unlockedDate: null },
            black_gold_level: { unlocked: false, unlockedDate: null },
            legend_level: { unlocked: false, unlockedDate: null },
            bronze_legend_level: { unlocked: false, unlockedDate: null },
            silver_legend_level: { unlocked: false, unlockedDate: null },
            gold_legend_level: { unlocked: false, unlockedDate: null },
            black_gold_legend_level: { unlocked: false, unlockedDate: null }
        };
    }

    checkAchievements() {
        if (!this.achievements || typeof this.achievements !== 'object') {
            console.warn('成就数据无效，重新加载默认成就');
            this.achievements = this.getDefaultAchievements();
        }
        
        // 确保所有成就字段都存在
        const defaultAchievements = this.getDefaultAchievements();
        Object.keys(defaultAchievements).forEach(key => {
            if (!this.achievements[key]) {
                this.achievements[key] = defaultAchievements[key];
            }
        });
        
        const newUnlocked = [];
        const totalCoins = this.calculateTotal();
        const recordDays = this.coinData.length;
        const currentStreak = this.calculateCurrentStreak();

        // 检查首次记录成就（基于时间排序，只有最早的记录才算首次记录）
        if (recordDays >= 1 && !this.achievements.first_record.unlocked) {
            // 按时间排序，找到最早的记录
            const sortedRecords = [...this.coinData].sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
                const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
                return timeA.getTime() - timeB.getTime();
            });
            
            // 检查最早的记录是否是最新的记录（即只有一条记录的情况）
            const earliestRecord = sortedRecords[0];
            const latestRecord = sortedRecords[sortedRecords.length - 1];
            
            // 只有一条记录时，或者最早的记录就是最新的记录时，才触发首次记录成就
            if (recordDays === 1 || earliestRecord === latestRecord) {
                this.unlockAchievement('first_record');
                newUnlocked.push('first_record');
            }
        }

        // 检查连续记录成就
        if (currentStreak >= 7 && !this.achievements.week_streak.unlocked) {
            this.unlockAchievement('week_streak');
            newUnlocked.push('week_streak');
        }

        if (currentStreak >= 30 && !this.achievements.month_streak.unlocked) {
            this.unlockAchievement('month_streak');
            newUnlocked.push('month_streak');
        }

        if (currentStreak >= 100 && !this.achievements.hundred_days.unlocked) {
            this.unlockAchievement('hundred_days');
            newUnlocked.push('hundred_days');
        }

        // 检查等级成就（基于当前金币数）
        const currentCoins = this.calculateCurrentCoins();
        
        if (currentCoins >= 0 && !this.achievements.novice_level.unlocked) {
            this.unlockAchievement('novice_level');
            newUnlocked.push('novice_level');
        }

        if (currentCoins >= 1000 && !this.achievements.silver_level.unlocked) {
            this.unlockAchievement('silver_level');
            newUnlocked.push('silver_level');
        }

        if (currentCoins >= 5000 && !this.achievements.gold_level.unlocked) {
            this.unlockAchievement('gold_level');
            newUnlocked.push('gold_level');
        }

        if (currentCoins >= 15000 && !this.achievements.black_gold_level.unlocked) {
            this.unlockAchievement('black_gold_level');
            newUnlocked.push('black_gold_level');
        }

        if (currentCoins >= 30000 && !this.achievements.legend_level.unlocked) {
            this.unlockAchievement('legend_level');
            newUnlocked.push('legend_level');
        }

        if (currentCoins >= 40000 && !this.achievements.bronze_legend_level.unlocked) {
            this.unlockAchievement('bronze_legend_level');
            newUnlocked.push('bronze_legend_level');
        }

        if (currentCoins >= 50000 && !this.achievements.silver_legend_level.unlocked) {
            this.unlockAchievement('silver_legend_level');
            newUnlocked.push('silver_legend_level');
        }

        if (currentCoins >= 70000 && !this.achievements.gold_legend_level.unlocked) {
            this.unlockAchievement('gold_legend_level');
            newUnlocked.push('gold_legend_level');
        }

        if (currentCoins >= 100000 && !this.achievements.black_gold_legend_level.unlocked) {
            this.unlockAchievement('black_gold_legend_level');
            newUnlocked.push('black_gold_legend_level');
        }

        // 显示成就解锁提示
        if (newUnlocked.length > 0) {
            setTimeout(() => {
                newUnlocked.forEach(achievementId => {
                    this.showAchievementUnlock(achievementId);
                });
            }, 500);
        }
    }

    calculateCurrentStreak() {
        if (this.coinData.length === 0) return 0;

        // 按时间排序，确保正确的连击计算
        const sortedRecords = [...this.coinData].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            return timeB.getTime() - timeA.getTime(); // 降序排列，最新的在前
        });

        let streak = 1;
        const today = this.getBeijingDate();

        for (let i = 0; i < sortedRecords.length - 1; i++) {
            // 将日期字符串转换为日期对象，确保正确处理时区
            const currentDateStr = sortedRecords[i].date + 'T00:00:00+08:00'; // 北京时间
            const prevDateStr = sortedRecords[i + 1].date + 'T00:00:00+08:00'; // 北京时间

            const currentDate = new Date(currentDateStr);
            const prevDate = new Date(prevDateStr);
            const dayDiff = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));

            if (dayDiff === 1) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    unlockAchievement(achievementId) {
        if (!this.achievements || typeof this.achievements !== 'object') {
            console.warn('成就数据无效，重新加载默认成就');
            this.achievements = this.getDefaultAchievements();
        }
        
        this.achievements[achievementId] = {
            unlocked: true,
            unlockedDate: new Date().toISOString() // 虽然是UTC时间，但对于成就解锁时间来说影响不大
        };
        this.saveAchievements();
    }

    showAchievementUnlock(achievementId) {
        const achievementNames = {
            first_record: '首次记录',
            week_streak: '坚持7天',
            month_streak: '坚持30天',
            hundred_days: '百日坚持',
            // 等级成就名称
            novice_level: '新手',
            silver_level: '白银',
            gold_level: '黄金',
            black_gold_level: '黑金',
            legend_level: '传奇',
            bronze_legend_level: '青铜传奇',
            silver_legend_level: '白银传奇',
            gold_legend_level: '黄金传奇',
            black_gold_legend_level: '黑金传奇'
        };

        // 创建成就解锁动画元素
        this.createAchievementUnlockAnimation(achievementNames[achievementId]);

        // 显示提示消息
        setTimeout(() => {
            this.showMessage(`🎉 成就解锁：${achievementNames[achievementId]}！`, 'success');
        }, 500);
    }

    createAchievementUnlockAnimation(achievementName) {
        const animationContainer = document.createElement('div');
        animationContainer.className = 'achievement-animation';
        animationContainer.innerHTML = `
            <div class="achievement-popup">
                <div class="achievement-icon-large">🏆</div>
                <div class="achievement-text">
                    <div class="achievement-title">成就解锁！</div>
                    <div class="achievement-name">${achievementName}</div>
                </div>
                <div class="achievement-particles">
                    <span class="particle">✨</span>
                    <span class="particle">🎉</span>
                    <span class="particle">⭐</span>
                    <span class="particle">💫</span>
                </div>
            </div>
        `;

        document.body.appendChild(animationContainer);

        // 触发动画
        setTimeout(() => {
            animationContainer.classList.add('show');
        }, 100);

        // 移除动画元素
        setTimeout(() => {
            animationContainer.classList.add('hide');
            setTimeout(() => {
                if (animationContainer.parentNode) {
                    animationContainer.parentNode.removeChild(animationContainer);
                }
            }, 500);
        }, 3000);
    }

    updateAchievements() {
        if (!this.achievements || typeof this.achievements !== 'object') {
            console.warn('成就数据无效，重新加载默认成就');
            this.achievements = this.getDefaultAchievements();
        }
        
        Object.keys(this.achievements).forEach(achievementId => {
            const statusElement = document.getElementById(`${achievementId}_status`);
            const achievementElement = document.querySelector(`[data-achievement="${achievementId}"]`);

            if (statusElement && achievementElement) {
                if (this.achievements[achievementId].unlocked) {
                    statusElement.textContent = '🏆';
                    statusElement.classList.add('unlocked');
                    achievementElement.classList.add('unlocked');

                    // 添加点击事件查看获取时间
                    achievementElement.style.cursor = 'pointer';
                    achievementElement.title = `点击查看获取时间`;
                    achievementElement.onclick = () => this.showAchievementDetails(achievementId);
                } else {
                    statusElement.textContent = '🔒';
                    achievementElement.classList.remove('unlocked');
                    achievementElement.style.cursor = 'default';
                    achievementElement.onclick = null;
                }
            }
        });
    }

    // 显示成就详情弹窗
    showAchievementDetails(achievementId) {
        if (!this.achievements || typeof this.achievements !== 'object') {
            console.warn('成就数据无效，重新加载默认成就');
            this.achievements = this.getDefaultAchievements();
        }
        
        const achievement = this.achievements[achievementId];
        if (!achievement || !achievement.unlocked) return;

        const achievementNames = {
            first_record: '首次记录',
            week_streak: '坚持7天',
            month_streak: '坚持30天',
            hundred_days: '百日坚持',
            // 等级成就名称
            novice_level: '新手',
            silver_level: '白银',
            gold_level: '黄金',
            black_gold_level: '黑金',
            legend_level: '传奇',
            bronze_legend_level: '青铜传奇',
            silver_legend_level: '白银传奇',
            gold_legend_level: '黄金传奇',
            black_gold_legend_level: '黑金传奇'
        };

        const unlockDate = new Date(achievement.unlockedDate);
        const formattedDate = unlockDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        this.createAchievementModal(achievementNames[achievementId], formattedDate);
    }

    // 创建成就详情弹窗
    createAchievementModal(achievementName, unlockDate) {
        // 如果弹窗已存在，先移除
        const existingModal = document.querySelector('.achievement-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'achievement-modal';
        modal.innerHTML = `
            <div class="achievement-modal-backdrop">
                <div class="achievement-modal-content">
                    <button class="achievement-modal-close">&times;</button>
                    <div class="achievement-modal-icon">🏆</div>
                    <div class="achievement-modal-title">成就详情</div>
                    <div class="achievement-modal-name">${achievementName}</div>
                    <div class="achievement-modal-date">📅 获取时间：${unlockDate}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        const closeBtn = modal.querySelector('.achievement-modal-close');
        const backdrop = modal.querySelector('.achievement-modal-backdrop');

        closeBtn.onclick = () => this.closeAchievementModal();
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                this.closeAchievementModal();
            }
        };

        // 触发动画
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }

    // 关闭成就弹窗
    closeAchievementModal() {
        const modal = document.querySelector('.achievement-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    // 云端同步相关方法
    enableCloudSync() {
        // 可以在这里添加云端同步的UI指示
    }

    disableCloudSync() {
        // 可以在这里移除云端同步的UI指示
    }

    // 同步数据到云端
    async syncToCloud(type, data) {
        if (!this.simpleIntegration || !this.simpleIntegration.isLoggedIn()) {
            return;
        }

        try {
            // 这里可以调用云端同步服务
            // 由于模块导入的限制，这里先留空
            // 实际实现会在simple-integration.js中处理
            console.log('同步到云端:', type, data);
            
            // 如果用户已加入排行榜，同步用户数据到排行榜
            if (this.simpleIntegration && typeof this.simpleIntegration.syncUserDataToLeaderboard === 'function') {
                await this.simpleIntegration.syncUserDataToLeaderboard();
            }
        } catch (error) {
            console.error('云端同步失败:', error);
        }
    }

    // 开始更新时间显示
    startTimeUpdate() {
        this.updateCurrentTime();
        // 每分钟更新一次时间
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000); // 60秒 = 1分钟
    }

    // 更新当前时间显示
    updateCurrentTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            timeElement.textContent = timeString;
        }
    }

    // 提醒用户上传到云端
    remindUploadToCloud() {
        // 检查用户是否已登录
        if (window.simpleIntegration && window.simpleIntegration.getCurrentUser()) {
            // 用户已登录，检查是否有未同步的数据
            const lastSync = localStorage.getItem('lastCloudSync');
            const now = Date.now();
            
            // 如果超过1小时没有同步，提醒用户
            if (!lastSync || (now - parseInt(lastSync)) > 60 * 60 * 1000) {
                setTimeout(() => {
                    this.showMessage('💡 提示：记得及时上传数据到云端，避免数据丢失', 'info', 8000);
                }, 2000);
            }
        } else {
            // 用户未登录，提醒登录并上传
            setTimeout(() => {
                this.showMessage('💡 提示：登录后可上传数据到云端，避免数据丢失', 'info', 8000);
            }, 2000);
        }
    }

    // 数据校验方法
    async validateData() {
        const validateBtn = document.getElementById('validateDataBtn');
        const validationResult = document.getElementById('validationResult');
        const validationStatusIcon = document.getElementById('validationStatusIcon');
        const validationStatusText = document.getElementById('validationStatusText');
        const validationDetails = document.getElementById('validationDetails');

        // 检查用户是否已登录
        if (!this.simpleIntegration || !this.simpleIntegration.isLoggedIn()) {
            this.showMessage('请先登录后再进行数据校验', 'warning');
            return;
        }

        // 检查是否正在同步中
        if (this.simpleIntegration.syncService && this.simpleIntegration.syncService.syncInProgress) {
            this.showMessage('数据正在同步中，请稍后再试', 'warning');
            return;
        }

        // 显示校验中状态
        validateBtn.disabled = true;
        validateBtn.innerHTML = '<span class="btn-icon">⏳</span><span>校验中...</span>';
        validationResult.style.display = 'block';
        validationStatusIcon.textContent = '⏳';
        validationStatusText.textContent = '正在校验数据...';
        validationDetails.innerHTML = '';

        try {
            // 等待一小段时间确保云端数据已更新（特别是刚刚上传后）
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 获取本地数据
            const localData = this.getLocalDataForValidation();
            
            // 获取云端数据
            const cloudData = await this.getCloudDataForValidation();
            
            // 比较数据
            const validationResult = this.compareData(localData, cloudData);
            
            // 显示校验结果
            this.displayValidationResult(validationResult);
            
        } catch (error) {
            console.error('数据校验失败:', error);
            validationStatusIcon.textContent = '❌';
            validationStatusText.textContent = '校验失败';
            validationDetails.innerHTML = `
                <div class="validation-summary error">
                    <strong>校验失败：</strong>${error.message}
                </div>
            `;
        } finally {
            // 恢复按钮状态
            validateBtn.disabled = false;
            validateBtn.innerHTML = '<span class="btn-icon">🔍</span><span>开始校验</span>';
        }
    }

    // 获取本地数据用于校验
    getLocalDataForValidation() {
        return {
            coinRecords: JSON.parse(localStorage.getItem('coinTrackerData') || '[]'),
            streakData: JSON.parse(localStorage.getItem('coinTrackerStreak') || 'null'),
            achievements: JSON.parse(localStorage.getItem('coinTrackerAchievements') || 'null'),
            challengeData: JSON.parse(localStorage.getItem('coinTrackerChallenge') || 'null'),
            lastSync: localStorage.getItem('lastCloudSync') || null
        };
    }

    // 获取云端数据用于校验
    async getCloudDataForValidation() {
        if (!this.simpleIntegration || !this.simpleIntegration.syncService) {
            throw new Error('云端同步服务不可用');
        }

        const readResult = await this.simpleIntegration.syncService.readBin();
        if (!readResult.success) {
            throw new Error(readResult.message);
        }

        return readResult.data;
    }

    // 比较本地和云端数据
    compareData(localData, cloudData) {
        const result = {
            isConsistent: true,
            issues: [],
            summary: {
                coinRecords: { local: 0, cloud: 0, consistent: true },
                streakData: { consistent: true },
                achievements: { consistent: true },
                challengeData: { consistent: true },
                lastSync: { consistent: true }
            }
        };

        // 比较金币记录
        const localRecords = localData.coinRecords || [];
        const cloudRecords = cloudData.coinRecords || [];
        
        result.summary.coinRecords.local = localRecords.length;
        result.summary.coinRecords.cloud = cloudRecords.length;
        
        if (localRecords.length !== cloudRecords.length) {
            result.isConsistent = false;
            result.summary.coinRecords.consistent = false;
            result.issues.push({
                type: 'count_mismatch',
                category: 'coinRecords',
                message: `金币记录数量不一致：本地${localRecords.length}条，云端${cloudRecords.length}条`
            });
        }

        // 比较具体记录内容
        const localRecordsMap = new Map(localRecords.map(r => [r.date, r]));
        const cloudRecordsMap = new Map(cloudRecords.map(r => [r.date, r]));
        
        // 检查本地独有的记录
        for (const [date, record] of localRecordsMap) {
            if (!cloudRecordsMap.has(date)) {
                result.isConsistent = false;
                result.issues.push({
                    type: 'missing_in_cloud',
                    category: 'coinRecords',
                    message: `云端缺少记录：${date} (${record.coins}金币)`
                });
            }
        }
        
        // 检查云端独有的记录
        for (const [date, record] of cloudRecordsMap) {
            if (!localRecordsMap.has(date)) {
                result.isConsistent = false;
                result.issues.push({
                    type: 'missing_in_local',
                    category: 'coinRecords',
                    message: `本地缺少记录：${date} (${record.coins}金币)`
                });
            }
        }
        
        // 检查记录内容差异（忽略时间戳差异，只比较核心数据）
        for (const [date, localRecord] of localRecordsMap) {
            const cloudRecord = cloudRecordsMap.get(date);
            if (cloudRecord) {
                // 创建比较用的记录副本，排除时间戳
                const localCompare = {
                    date: localRecord.date,
                    coins: localRecord.coins,
                    difference: localRecord.difference,
                    note: localRecord.note || ''
                };
                const cloudCompare = {
                    date: cloudRecord.date,
                    coins: cloudRecord.coins,
                    difference: cloudRecord.difference,
                    note: cloudRecord.note || ''
                };
                
                if (JSON.stringify(localCompare) !== JSON.stringify(cloudCompare)) {
                    result.isConsistent = false;
                    result.issues.push({
                        type: 'content_mismatch',
                        category: 'coinRecords',
                        message: `记录内容不一致：${date}`
                    });
                }
            }
        }

        // 比较连击数据（忽略时间戳差异）
        const localStreak = localData.streakData;
        const cloudStreak = cloudData.streakData;
        
        if (localStreak && cloudStreak) {
            // 创建比较用的连击数据副本，排除可能的时间戳差异
            const localStreakCompare = {
                currentStreak: localStreak.currentStreak,
                longestStreak: localStreak.longestStreak,
                lastRecordDate: localStreak.lastRecordDate,
                todayCompleted: localStreak.todayCompleted
            };
            const cloudStreakCompare = {
                currentStreak: cloudStreak.currentStreak,
                longestStreak: cloudStreak.longestStreak,
                lastRecordDate: cloudStreak.lastRecordDate,
                todayCompleted: cloudStreak.todayCompleted
            };
            
            if (JSON.stringify(localStreakCompare) !== JSON.stringify(cloudStreakCompare)) {
                result.isConsistent = false;
                result.summary.streakData.consistent = false;
                result.issues.push({
                    type: 'content_mismatch',
                    category: 'streakData',
                    message: '连击数据不一致'
                });
            }
        }

        // 比较成就数据
        const localAchievements = localData.achievements;
        const cloudAchievements = cloudData.achievements;
        
        if (localAchievements && cloudAchievements) {
            // 比较成就的解锁状态，忽略解锁时间
            const localAchievementsCompare = {};
            const cloudAchievementsCompare = {};
            
            Object.keys(localAchievements).forEach(key => {
                localAchievementsCompare[key] = {
                    unlocked: localAchievements[key].unlocked
                };
            });
            
            Object.keys(cloudAchievements).forEach(key => {
                cloudAchievementsCompare[key] = {
                    unlocked: cloudAchievements[key].unlocked
                };
            });
            
            if (JSON.stringify(localAchievementsCompare) !== JSON.stringify(cloudAchievementsCompare)) {
                result.isConsistent = false;
                result.summary.achievements.consistent = false;
                result.issues.push({
                    type: 'content_mismatch',
                    category: 'achievements',
                    message: '成就数据不一致'
                });
            }
        }

        // 比较挑战数据
        const localChallenge = localData.challengeData;
        const cloudChallenge = cloudData.challengeData;
        
        if (localChallenge && cloudChallenge) {
            // 创建比较用的挑战数据副本，排除时间戳差异
            const localChallengeCompare = {
                target: localChallenge.target,
                startDate: localChallenge.startDate,
                endDate: localChallenge.endDate,
                currentProgress: localChallenge.currentProgress,
                completed: localChallenge.completed
            };
            const cloudChallengeCompare = {
                target: cloudChallenge.target,
                startDate: cloudChallenge.startDate,
                endDate: cloudChallenge.endDate,
                currentProgress: cloudChallenge.currentProgress,
                completed: cloudChallenge.completed
            };
            
            if (JSON.stringify(localChallengeCompare) !== JSON.stringify(cloudChallengeCompare)) {
                result.isConsistent = false;
                result.summary.challengeData.consistent = false;
                result.issues.push({
                    type: 'content_mismatch',
                    category: 'challengeData',
                    message: '挑战数据不一致'
                });
            }
        }

        // 比较lastSync时间戳（允许一定的时差）
        const localLastSync = localData.lastSync;
        const cloudLastSync = cloudData.lastSync;
        
        if (localLastSync && cloudLastSync) {
            const localTime = new Date(localLastSync).getTime();
            const cloudTime = new Date(cloudLastSync).getTime();
            const timeDiff = Math.abs(localTime - cloudTime);
            
            // 允许5分钟的时间差（考虑网络延迟和服务器时间差）
            if (timeDiff > 5 * 60 * 1000) {
                result.isConsistent = false;
                result.summary.lastSync.consistent = false;
                result.issues.push({
                    type: 'timestamp_mismatch',
                    category: 'lastSync',
                    message: `同步时间戳差异较大：本地${localLastSync}，云端${cloudLastSync}`
                });
            }
        }

        return result;
    }

    // 显示校验结果
    displayValidationResult(result) {
        const validationStatusIcon = document.getElementById('validationStatusIcon');
        const validationStatusText = document.getElementById('validationStatusText');
        const validationDetails = document.getElementById('validationDetails');

        if (result.isConsistent) {
            validationStatusIcon.textContent = '✅';
            validationStatusText.textContent = '数据一致';
            validationDetails.innerHTML = `
                <div class="validation-summary success">
                    <strong>校验通过：</strong>云端和本地数据完全一致
                </div>
                <div class="validation-item">
                    <span class="validation-item-label">金币记录</span>
                    <span class="validation-item-value success">${result.summary.coinRecords.local} 条</span>
                </div>
                <div class="validation-item">
                    <span class="validation-item-label">连击数据</span>
                    <span class="validation-item-value success">一致</span>
                </div>
                <div class="validation-item">
                    <span class="validation-item-label">成就数据</span>
                    <span class="validation-item-value success">一致</span>
                </div>
                <div class="validation-item">
                    <span class="validation-item-label">挑战数据</span>
                    <span class="validation-item-value success">一致</span>
                </div>
            `;
        } else {
            validationStatusIcon.textContent = '⚠️';
            validationStatusText.textContent = '发现不一致';
            
            let issuesHtml = '';
            result.issues.forEach(issue => {
                const severity = issue.type === 'count_mismatch' ? 'error' : 'warning';
                issuesHtml += `
                    <div class="validation-item">
                        <span class="validation-item-label">${issue.category}</span>
                        <span class="validation-item-value ${severity}">${issue.message}</span>
                    </div>
                `;
            });

            validationDetails.innerHTML = `
                <div class="validation-summary warning">
                    <strong>发现 ${result.issues.length} 个问题：</strong>云端和本地数据存在不一致
                </div>
                ${issuesHtml}
                <div class="validation-item">
                    <span class="validation-item-label">建议操作</span>
                    <span class="validation-item-value">请进行数据同步以解决不一致问题</span>
                </div>
            `;
        }
    }
}

// 触摸设备优化
function optimizeForTouchDevices() {
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // 防止触摸滚动时触发缩放
    document.addEventListener('touchstart', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    });

    // 为触摸设备添加触摸反馈
    const buttons = document.querySelectorAll('button, .tab-btn');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        button.addEventListener('touchend', function() {
            this.style.transform = '';
        });
    });

    // 优化输入框体验
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            // 滚动到可视区域（移动端优化）
            setTimeout(() => {
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 优化触摸设备体验
    optimizeForTouchDevices();

    // 创建 CoinTracker 实例并初始化
    window.coinTracker = new CoinTracker();
    window.coinTracker.init();
});
