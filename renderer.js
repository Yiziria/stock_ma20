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


// 存储当前值等于MA20的股票信息
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
    let tdMA20_30 = tr.querySelector(`td#${symbol}ma20_30`);
    let tdMA20_60 = tr.querySelector(`td#${symbol}ma20_60`);
    let tdMA20_120 = tr.querySelector(`td#${symbol}ma20_120`);

    // 确保股票数据存在
    if (stock) {
        // 更新单元格内容，若数据不存在则显示'N/A'
        tdCurrent.innerHTML = stock['current'] !== undefined ? stock['current'] : 'N/A';
        tdPercent.innerHTML = stock['percent'] !== undefined ? stock['percent'] + '%' : 'N/A';
        tdMA20_30.innerHTML = stock['ma20_30'] !== undefined ? stock['ma20_30'] : 'N/A';
        tdMA20_60.innerHTML = stock['ma20_60'] !== undefined ? stock['ma20_60'] : 'N/A';
        tdMA20_120.innerHTML = stock['ma20_120'] !== undefined ? stock['ma20_120'] : 'N/A';

        // 检查当前股价是否触达MA20并添加提醒
        checkForAlerts(stock['current'], stock['ma20_30'], stock['ma20_60'], stock['ma20_120'], symbol);
    }
}

// 检查是否触达MA20并添加提醒
function checkForAlerts(currentPrice, ma20_30, ma20_60, ma20_120, symbol) {
    if (currentPrice !== undefined) {
        // 检查30分钟MA20
        if (ma20_30 !== undefined && (currentPrice >= ma20_30 * 0.99 && currentPrice <= ma20_30 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达30分钟MA20: ${ma20_30}`); // 提醒用户
        }
        // 检查60分钟MA20
        if (ma20_60 !== undefined && (currentPrice >= ma20_60 * 0.99 && currentPrice <= ma20_60 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达60分钟MA20: ${ma20_60}`); // 提醒用户
        }
        // 检查120分钟MA20
        if (ma20_120 !== undefined && (currentPrice >= ma20_120 * 0.99 && currentPrice <= ma20_120 * 1.01)) {
            alert(`股票 ${symbol} 的股价触达120分钟MA20: ${ma20_120}`); // 提醒用户
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

// 定义计算MA20的时间间隔（以毫秒为单位）
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

// 计算MA20值
function calculateMA20ForAll() {
    if (codes.length > 0) {
        codes.forEach(symbol => {
            calculateAndUpdateMA20(symbol); // 计算并更新MA20
        });
    }
}

// 启动时立即计算一次MA20
calculateMA20ForAll();

// 启动时设置第一个计算时间
function startMA20Calculation() {
    // 每隔30分钟计算MA20
    setInterval(() => {
        if (isMarketOpen()) {
            calculateMA20ForAll(); // 在交易时间内计算MA20
        }
    }, interval);
}

// 启动计算
startMA20Calculation();

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
                // 计算并更新MA20值
                calculateAndUpdateMA20(stock.symbol);
            }
        })
        .catch((error) => {
            console.error('获取股票数据失败:', error);
        });
}



function getCloseValues(symbol, scales, ma, datalen) {
    const promises = scales.map(scale => {
        const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=${scale}&ma=${ma}&datalen=${datalen}`;
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('请求失败');
                }
                return response.json();
            })
            .then(klineData => {
                return klineData.map(item => parseFloat(item.close));
            })
            .catch(error => {
                console.error(`请求失败（scale=${scale}）:`, error);
                return [];
            });
    });

    return Promise.all(promises);
}

function calculateMA20(closeValuesList) {
    const ma20List = closeValuesList.map(closeValues => {
        if (closeValues.length < 20) {
            console.log("数据不足以计算 MA20");
            return null;
        }
        const ma20 = closeValues.reduce((sum, value) => sum + value, 0) / closeValues.length;
        return Math.round(ma20 * 100) / 100;
    });
    return ma20List;
}

function calculateAndUpdateMA20(symbol) {
    const scales = [30, 60, 120]; // 需要获取的scale值
    const ma = "no";
    const datalen = 20;

    getCloseValues(symbol, scales, ma, datalen)
        .then(closeValuesList => {
            const ma20List = calculateMA20(closeValuesList);
            console.log("MA20 值列表:", ma20List);
            updateMA20InTable(symbol, ma20List);
        });
}

// 更新表格中的MA20值
function updateMA20InTable(symbol, ma20List) {
    const scales = [30, 60, 120];
    ma20List.forEach((ma20, index) => {
        if (ma20 !== null) {
            const scale = scales[index];
            const tdMA20 = document.getElementById(`${symbol}ma20_${scale}`);
            if (tdMA20) { // 确保tdMA20存在
                tdMA20.innerHTML = ma20; // 更新MA20值
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
            let isHeld = keys[keys.length - 1] === 'h'; // 检查最后一个参数是否是 'h'
            for (let i = 1; i < keys.length - (isHeld ? 1 : 0); i += 2) {
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
                        getStockData(true, code);
                    } else if (isHeld) {
                        // 如果股票已在列表中，且本次是持仓股票，则标记为高亮
                        localStorage.setItem(code + '_held', 'true');
                        updateStockRowHighlight(code); // 更新高亮状态
                    }
                }
            }
            sortTableByHeldStatus(); // 按持仓状态排序
        } else if (keys[0] == 'remove' && keys.length > 1) {
            let index = names.indexOf(keys[1]);
            if (index !== -1) {
                names.splice(index, 1);
                codes.splice(index, 1);
                let table = document.getElementById('table');
                table.removeChild(table.childNodes[index + 2]);
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

    // 创建MA20单元格
    let tdMA20_30 = document.createElement('td');
    tdMA20_30.setAttribute('id', symbol + 'ma20_30');
    tdMA20_30.className = 'tdEnd';

    let tdMA20_60 = document.createElement('td');
    tdMA20_60.setAttribute('id', symbol + 'ma20_60');
    tdMA20_60.className = 'tdEnd';

    let tdMA20_120 = document.createElement('td');
    tdMA20_120.setAttribute('id', symbol + 'ma20_120');
    tdMA20_120.className = 'tdEnd';

    tr.appendChild(tdSymbol);
    tr.appendChild(tdCurrent);
    tr.appendChild(tdPercent);
    tr.appendChild(tdMA20_30); // 添加MA20_30单元格
    tr.appendChild(tdMA20_60);  // 添加MA20_60单元格
    tr.appendChild(tdMA20_120); // 添加MA20_120单元格

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