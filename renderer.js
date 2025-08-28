// 导入electron的ipcRenderer模块
const { ipcRenderer } = require('electron')

// 从localStorage中获取'codes'和'names'的数据
let codes = getStorageData('codes')
let names = getStorageData('names')

// 初始化界面边界
initBounds();

// 如果codes和names数组都非空，则获取股票数据
if(codes.length > 0 && names.length > 0){
    getStockData(true, codes.join(','));
}

function getStorageData(key) {
    let data = localStorage.getItem(key);
    if (data === null || data === '') {
        return [];
    } else {
        return data.split(',');
    }
}

// 存储当前值等于MA60的股票信息
let alertedStocks = new Set(); // 使用Set来存储已提醒的股票
let alertMessages = []; // 存储待提醒的股票信息

// 更新股票数据
function updateStockData(stock) {
    let symbol = stock['symbol']; // 获取股票代码
    let tr = document.querySelector(`#table tr td[id^="${symbol}"]`).parentNode; // 获取对应的表格行
    if (!tr) {
        tr = createStockTr(stock); // 如果行不存在，创建新行
    }

    // 获取对应的单元格
    let tdCurrent = tr.querySelector(`td#${symbol}current`);
    let tdPercent = tr.querySelector(`td#${symbol}percent`);
    let tdMA10 = tr.querySelector(`td#${symbol}ma10`);
    let tdMA20 = tr.querySelector(`td#${symbol}ma20`);
    let tdMA60 = tr.querySelector(`td#${symbol}ma60`);

    // 确保股票数据存在
    if (stock) {
        // 更新单元格内容，若数据不存在则显示'N/A'
        tdCurrent.innerHTML = stock['current'] !== undefined ? stock['current'] : 'N/A';
        tdPercent.innerHTML = stock['percent'] !== undefined ? stock['percent'] + '%' : 'N/A';
        
        // 保留两位小数（不再使用雪球ma覆盖我们计算的均线）
        // if (stock['ma10'] !== undefined) {
        //     tdMA10.innerHTML = Number(stock['ma10']).toFixed(2);
        // }
        // if (stock['ma20'] !== undefined) {
        //     tdMA20.innerHTML = Number(stock['ma20']).toFixed(2);
        // }
        // if (stock['ma60'] !== undefined) {
        //     tdMA60.innerHTML = Number(stock['ma60']).toFixed(2);
        // }

        // 检查当前股价是否触达MA60并添加提醒
        checkForAlerts(stock['current'], stock['ma10'], stock['ma20'], stock['ma60'], symbol);
        // 检查提醒价
        checkAlertPrice(stock['current'], symbol);
    }
}

// 检查是否触达MA60并添加提醒
function checkForAlerts(currentPrice, ma10, ma20, ma60, symbol) {
    if (currentPrice !== undefined) {
        // 检查10日均线
        if (ma10 !== undefined && (currentPrice >= ma10 * 0.99 && currentPrice <= ma10 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达10日均线: ${ma10}`); // 提醒用户
        }
        // 检查20日均线
        if (ma20 !== undefined && (currentPrice >= ma20 * 0.99 && currentPrice <= ma20 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达20日均线: ${ma20}`); // 提醒用户
        }
        // 检查60日均线
        if (ma60 !== undefined && (currentPrice >= ma60 * 0.99 && currentPrice <= ma60 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达60日均线: ${ma60}`); // 提醒用户
        }
    }
}

// 在每次更新后检查并展示弹窗
function checkAndShowAlerts() {
    if (alertMessages.length > 0) {
        alert(alertMessages.join('\n'));
        alertMessages = []; // 清空数组
    }
}

// 定义计算MA60的时间间隔（以毫秒为单位）
const interval = 30 * 60 * 1000; // 30分钟
const tradingHours = {
    morning: { start: '09:30', end: '11:30' },
    afternoon: { start: '13:00', end: '15:00' }
};

// 检查当前时间是否在交易时间内
function isMarketOpen() {
    const now = new Date();
    const currentDay = now.getDay(); // 0: 星期日, 1: 星期一, ..., 6: 星期六
    const currentTime = now.toTimeString().slice(0, 5); // 获取当前时间 HH:MM

    // 检查是否是工作日
    if (currentDay === 0 || currentDay === 6) {
        return false; // 周末不交易
    }

    // 检查是否在上午或下午的交易时间内
    return (currentTime >= tradingHours.morning.start && currentTime <= tradingHours.morning.end) ||
           (currentTime >= tradingHours.afternoon.start && currentTime <= tradingHours.afternoon.end);
}

// 计算MA60值
function calculateMA60ForAll() {
    if (codes.length > 0) {
        codes.forEach(symbol => {
            calculateAndUpdateMA60(symbol); // 计算并更新MA60
        });
    }
}

// 启动时立即计算一次MA60
calculateMA60ForAll();

// 启动时设置第一个计算时间
function startMA60Calculation() {
    // 每隔30分钟计算MA60
    setInterval(() => {
        if (isMarketOpen()) {
            calculateMA60ForAll(); // 在交易时间内计算MA60
        }
    }, interval);
}

// 启动计算
startMA60Calculation();

// 每3秒获取股票数据（如果需要）
setInterval(() => {
    if (isMarketOpen() && codes.length > 0) {
        getStockData(false, codes.join(',')); // 获取股票数据
    }
}, 3000);

// 获取股票数据
function getStockData(needCreate, symbols) {
    fetch('https://stock.xueqiu.com/v5/stock/realtime/quotec.json?symbol=' + symbols)
        .then((response) => {
            if (!response.ok) {
                throw new Error('网络响应不正常');
            }
            return response.json();
        })
        .then((json) => {
            let length = json.data.length;
            for (let i = 0; i < length; i++) {
                const stock = json.data[i];
                if (needCreate) {
                    createStockTr(stock);
                }
                updateStockData(stock);
                // 计算并更新MA60值
                calculateAndUpdateMA60(stock.symbol);
            }
        })
        .catch((error) => {
            console.error('获取股票数据失败:', error);
        });
}

function getCloseValues(symbol, scales) {
    const promises = scales.map(scale => {
        const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=240&ma=${scale}&datalen=240`;
        console.log(`请求URL: ${url}`); // 添加URL调试信息
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('请求失败');
                }
                return response.json();
            })
            .then(klineData => {
                console.log(`获取${symbol}的${scale}日数据:`, klineData.length, '条记录');
                if (klineData && klineData.length > 0) {
                    // 在交易时段剔除当日K线，避免与券商口径差异
                    try {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const dd = String(today.getDate()).padStart(2, '0');
                        const todayStr = `${yyyy}-${mm}-${dd}`;
                        const lastIdx = klineData.length - 1;
                        if (klineData[lastIdx] && klineData[lastIdx].day === todayStr && isMarketOpen()) {
                            klineData = klineData.slice(0, -1);
                        }
                    } catch (e) {
                        console.warn('处理当日K线时出错:', e);
                    }
                    // 获取收盘价数据
                    const closePrices = klineData.map(item => parseFloat(item.close));
                    console.log(`收盘价数据:`, closePrices);
                    return closePrices;
                }
                return [];
            })
            .catch(error => {
                console.error(`请求失败（scale=${scale}）:`, error);
                return [];
            });
    });

    return Promise.all(promises);
}

function calculateMA60(closeValuesList) {
    const scales = [10, 20, 60];
    return closeValuesList.map((closeValues, index) => {
        const scale = scales[index];
        if (closeValues.length < scale) {
            console.log(`数据不足以计算 ${scale}日均线，需要${scale}条数据，实际只有${closeValues.length}条`);
            return null;
        }
        // 取最近scale天的收盘价计算均线
        const recentPrices = closeValues.slice(-scale);
        const sum = recentPrices.reduce((acc, val) => acc + val, 0);
        const maValue = sum / scale;
        console.log(`${scale}日均线计算:`, recentPrices, `平均值:`, maValue.toFixed(2));
        return Math.round(maValue * 100) / 100; // 保留两位小数
    });
}

function calculateAndUpdateMA60(symbol) {
    const scales = [10, 20, 60];

    getCloseValues(symbol, scales)
        .then(closeValuesList => {
            const maList = calculateMA60(closeValuesList);
            updateMA60InTable(symbol, maList);
        });
}

// 更新表格中的MA60值（优化后）
function updateMA60InTable(symbol, ma60List) {
    const scales = [10, 20, 60];
    console.log(`更新${symbol}的均线数据:`, ma60List); // 添加调试信息
    ma60List.forEach((ma60, index) => {
        if (ma60 !== null) {
            const scale = scales[index];
            const tdMA60 = document.getElementById(`${symbol}ma${scale}`);
            console.log(`查找元素ID: ${symbol}ma${scale}, 找到元素:`, tdMA60); // 添加调试信息
            if (tdMA60) {
                const currentValue = parseFloat(tdMA60.innerHTML) || null;
                const newValue = parseFloat(ma60.toFixed(2));
                
                // 只有当新值与当前值不同时才更新
                if (currentValue === null || newValue !== currentValue) {
                    tdMA60.innerHTML = newValue.toFixed(2);
                    console.log(`更新${symbol}的${scale}日均线为:`, newValue.toFixed(2)); // 添加调试信息
                }
            } else {
                console.log(`未找到元素: ${symbol}ma${scale}`); // 添加调试信息
            }
        }
    });
}

// 获取输入框元素
let input = document.getElementById('input');
let inputVisible = false;

// 监听输入框的键盘事件
input.addEventListener('keydown', (e) => {
    if (e.key == "Enter") {
        let value = e.target.value;
        let keys = value.split(' ');
        if (keys[0] == 'add' && keys.length > 2) {
            let isHeld = keys.includes('h'); // 检查是否有 'h'
            // 判断最后一个参数是否为浮点数（提醒价）
            let lastParam = keys[keys.length - 1];
            let alertPrice = null;
            if (!isNaN(parseFloat(lastParam)) && isFinite(lastParam)) {
                alertPrice = parseFloat(lastParam);
            }
            // 处理参数
            let startIdx = 1;
            let endIdx = keys.length - (alertPrice !== null ? 1 : 0) - (isHeld ? 1 : 0);
            for (let i = startIdx; i < endIdx; i += 2) {
                let name = keys[i];
                let code = keys[i + 1];
                if (name && code) {
                    let index = codes.indexOf(code);
                    if (index === -1) {
                        // 如果股票不在列表中，添加股票
                        names.push(name);
                        codes.push(code);
                        if (isHeld) {
                            localStorage.setItem(code + '_held', 'true'); // 标记为持仓股票
                        }
                        if (alertPrice !== null) {
                            localStorage.setItem(code + '_alert_price', alertPrice);
                        }
                        getStockData(true, code);
                    } else {
                        if (isHeld) {
                            localStorage.setItem(code + '_held', 'true');
                            updateStockRowHighlight(code);
                        }
                        if (alertPrice !== null) {
                            localStorage.setItem(code + '_alert_price', alertPrice);
                        }
                    }
                }
            }
            sortTableByHeldStatus();
        } else if (keys[0] == 'remove' && keys.length > 1) {
            let index = names.indexOf(keys[1]);
            if (index !== -1) {
                let code = codes[index];
                names.splice(index, 1);
                codes.splice(index, 1);
                
                // 通过股票代码查找并删除对应的表格行
                let targetRow = document.querySelector(`#table tr td[id^="${code}"]`);
                if (targetRow) {
                    targetRow.parentNode.remove();
                }
                
                // 移除相关localStorage
                localStorage.removeItem(code + '_alert_price');
                localStorage.removeItem(code + '_alerted');
                localStorage.removeItem(code + '_held'); // 清理持仓标记
                
                getStockData(false, codes.join(','));
            }
        } else if (keys[0] == 'clear') {
            names = [];
            codes = [];
            let table = document.getElementById('table');
            let length = table.childNodes.length;
            for (let i = 2; i < length; i++) {
                table.removeChild(table.childNodes[2]);
            }
            // 清除所有提醒价和已提醒标记
            Object.keys(localStorage).forEach(key => {
                if (key.endsWith('_alert_price') || key.endsWith('_alerted')) {
                    localStorage.removeItem(key);
                }
            });
            getStockData(false, codes.join(','));
        }
        localStorage.setItem('codes', codes.join(','));
        localStorage.setItem('names', names.join(','));
        e.target.value = '';
    }
});

function updateStockRowHighlight(symbol) {
    let tr = document.querySelector(`#table tr td[id^="${symbol}"]`).parentNode;
    if (localStorage.getItem(symbol + '_held') === 'true') {
        tr.classList.add('held-stock'); // 添加高亮样式
    } else {
        tr.classList.remove('held-stock'); // 移除高亮样式
    }
}

function sortTableByHeldStatus() {
    let table = document.getElementById('table');
    let rows = Array.from(table.querySelectorAll('tr')).slice(1); // 跳过表头
    let heldRows = rows.filter(row => row.classList.contains('held-stock'));
    let nonHeldRows = rows.filter(row => !row.classList.contains('held-stock'));

    // 清空表格
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    // 先添加高亮行，再添加非高亮行
    heldRows.forEach(row => table.appendChild(row));
    nonHeldRows.forEach(row => table.appendChild(row));
}

function createStockTr(stock) {
    let symbol = stock['symbol'];
    let index = codes.indexOf(symbol);
    let stockName = names[index];
    let tr = document.createElement('tr');

    let tdSymbol = document.createElement('td');
    tdSymbol.innerHTML = stockName;
    tdSymbol.className = 'tdStart';

    let tdCurrent = document.createElement('td');
    tdCurrent.setAttribute('id', symbol + 'current');
    tdCurrent.className = 'tdCenter';

    let tdPercent = document.createElement('td');
    tdPercent.setAttribute('id', symbol + 'percent');
    tdPercent.className = 'tdCenter';

    // 创建MA60单元格
    let tdMA10 = document.createElement('td');
    tdMA10.setAttribute('id', symbol + 'ma10');
    tdMA10.className = 'tdEnd col-10';

    let tdMA20 = document.createElement('td');
    tdMA20.setAttribute('id', symbol + 'ma20');
    tdMA20.className = 'tdEnd col-20';

    let tdMA60 = document.createElement('td');
    tdMA60.setAttribute('id', symbol + 'ma60');
    tdMA60.className = 'tdEnd col-60';

    tr.appendChild(tdSymbol);
    tr.appendChild(tdCurrent);
    tr.appendChild(tdPercent);
    tr.appendChild(tdMA10); // 添加MA10单元格
    tr.appendChild(tdMA20);  // 添加MA20单元格
    tr.appendChild(tdMA60); // 添加MA60单元格

    document.getElementById('table').appendChild(tr);
    return tr;
}

// 初始化界面边界
function initBounds(){
    let width =localStorage.getItem('width')
    let height =localStorage.getItem('height')
    if(width == null || width == ''){
        width = 300;
    }else
        width = Number.parseInt(width)
    if(height == null || height == ''){
        height = 360;
    }else
        height = Number.parseInt(height )
    
    ipcRenderer.send('content-bounds', {
        width:width,
        height:height,
    })

    ipcRenderer.on('save-content-bounds', (event, arg) => {
        console.log(arg) 
        localStorage.setItem('width',arg.width)
        localStorage.setItem('height',arg.height)
    })
}

// 监听全局键盘事件，用于切换输入框的显示隐藏
window.addEventListener('keyup', (event)=>{
    if(event.key == 'Alt'){
        console.log('输入命令')
        input.style.visibility = inputVisible  ? 'hidden':'visible'
        inputVisible = !inputVisible;
    }
}, true)

let lastPrices = {}; // 用于记录每只股票的上一次价格

function checkAlertPrice(currentPrice, symbol) {
    let alertPrice = localStorage.getItem(symbol + '_alert_price');
    let alerted = localStorage.getItem(symbol + '_alerted');
    let idx = codes.indexOf(symbol);
    let name = names[idx] || symbol;
    if (alertPrice !== null && alerted !== 'true') {
        let price = parseFloat(alertPrice);
        let lastPrice = lastPrices[symbol];
        if (
            lastPrice !== undefined &&
            ((lastPrice < price && currentPrice >= price) || (lastPrice > price && currentPrice <= price))
        ) {
            alert(
                `RunDLL\n\nError in C:\\WINDOWS\\system32\\PcaSvc.dll\nMissing entry: ${name} reached alert price ${price}`
            );
            localStorage.setItem(symbol + '_alerted', 'true');
        }
        lastPrices[symbol] = currentPrice; // 更新上一次价格
    }
}